# MecFinders Backend — Deployment Runbook

Step-by-step guide to take this backend from a laptop to a production server that
handles 1000+ concurrent users (Tier 2: multi-process + Redis).

- **Why** each piece exists → see [`SCALING.md`](./SCALING.md).
- **How** to actually set it up → this file.

> Read this top-to-bottom the first time. After that it's a checklist.

---

## 0. What you're building

```
                     ┌─────────────────────────────────────────┐
   Phone apps ──────▶│  Nginx (TLS, :443)   reverse proxy       │
   Admin panel ─────▶│  - sticky sessions for websockets        │
                     └───────────────┬─────────────────────────┘
                                     │ (http :5000, loopback)
                     ┌───────────────▼─────────────────────────┐
                     │  PM2 cluster — N Node processes           │
                     │  (server.js, one per CPU core)            │
                     └───┬───────────────┬───────────────┬──────┘
                         │               │               │
                 ┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼───────┐
                 │  MongoDB     │  │  Redis      │  │ Cloudinary  │
                 │  Atlas       │  │ (adapter +  │  │ (images)    │
                 │              │  │ lock+cache) │  │             │
                 └──────────────┘  └─────────────┘  └─────────────┘
```

Redis is what makes running **more than one Node process** safe:
- **Socket.IO adapter** → realtime events reach clients on any process.
- **Leader-lock** → only one process runs the dispatch sweeper.
- **Shared cache** → all processes share cached reference data.

---

## 1. Prerequisites

**Server** (any cloud VM — AWS EC2, DigitalOcean, Hetzner, etc.):
- Ubuntu 22.04 or 24.04 LTS (this guide assumes Ubuntu/Debian)
- 2 vCPU / 4 GB RAM minimum for Tier 2 (start here; scale the box up before out)
- A domain name pointing at the server's public IP (for TLS)
- Ports open: 22 (SSH), 80 (HTTP→HTTPS redirect), 443 (HTTPS). **Do NOT** expose
  5000 (Node) or 6379 (Redis) to the internet.

**External services** (already used by the app):
- MongoDB Atlas cluster (M10+ recommended for production; M0 free tier caps at
  ~500 connections and has no SLA)
- Cloudinary account (image storage)
- Razorpay keys (when you go live with online payments)

---

## 2. Prepare the code for deploy (on your laptop)

The repo has no commits yet. Get it into version control first — it makes every
future deploy a `git pull` instead of a manual copy.

```bash
cd /home/anger/Projects/mecfinders

# root .gitignore so secrets / deps never get committed
cat > .gitignore <<'EOF'
node_modules/
.env
.env.local
*.log
coverage/
.DS_Store
# Next.js build output
.next/
out/
# Capacitor native build artifacts
android/app/build/
ios/App/build/
EOF

git add -A
git commit -m "Initial commit: backend + apps + admin panel"

# create a PRIVATE repo on GitHub, then:
git remote add origin git@github.com:<you>/mecfinders.git
git branch -M main
git push -u origin main
```

> `backend/.gitignore` already excludes `node_modules`, `.env`, `coverage`, `*.log`.
> Double-check `git status` shows **no `.env`** before pushing.

---

## 3. Provision the server

SSH in, then install the runtime.

```bash
# --- Node.js 20 LTS (Express 5 + Mongoose 9 need Node 18+; 20 LTS is the safe pick) ---
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version    # should print v20.x

# --- build tools (some npm deps compile native bits) ---
sudo apt-get install -y build-essential git

# --- PM2 process manager ---
sudo npm install -g pm2
```

---

## 4. Install & secure Redis

```bash
sudo apt-get install -y redis-server
```

Harden it — Redis must **never** be reachable from the internet:

```bash
sudo nano /etc/redis/redis.conf
```
Set / confirm:
```
bind 127.0.0.1 ::1          # localhost only
protected-mode yes
requirepass <a-long-random-password>   # generate: openssl rand -base64 32
maxmemory 256mb
maxmemory-policy allkeys-lru            # evict old cache keys under pressure
```
```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server
redis-cli -a '<password>' ping   # → PONG
```

> **Managed alternative:** Upstash / AWS ElastiCache / Redis Cloud. Skip the
> install above and just use the connection URL they give you. For a single box,
> local Redis is simplest.

---

## 5. Get the code onto the server

```bash
cd ~
git clone git@github.com:<you>/mecfinders.git
cd mecfinders/backend
npm ci --omit=dev        # clean, reproducible install (uses package-lock.json)
```

> If you didn't set up GitHub, `rsync` from your laptop instead:
> `rsync -avz --exclude node_modules --exclude .env ~/Projects/mecfinders/ user@SERVER:~/mecfinders/`

---

## 6. Configure environment

**Never copy your dev `.env`.** Create a fresh production one from the template:

```bash
cp .env.example .env
nano .env
```

Fill in for production:

| Var | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` (kept behind Nginx) |
| `MONGODB_URI` | your Atlas SRV URI |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | fresh 32+ char random strings (`openssl rand -base64 48`) — **different from dev** |
| `SUPERADMIN_*` | real admin creds |
| `ADMIN_PANEL_URL` | your admin panel's real URL |
| `REDIS_URL` | `redis://:<password>@127.0.0.1:6379` (note the password) |
| `TRUST_PROXY` | `true` (we're behind Nginx) |
| `MONGO_MAX_POOL` | see the pool math below |
| `RAZORPAY_*` | live keys when payments go live |

**Connection-pool math (important):** `instances × MONGO_MAX_POOL` must stay under
your Atlas tier's connection limit. On a 2-core box PM2 runs 2 processes, so
`2 × 50 = 100` connections — fine for M10 (~1500) and even M0 (~500). If you bump
to a 4-core box, either keep `MONGO_MAX_POOL=50` (→200) or lower it.

Also: in **Atlas → Network Access**, whitelist the server's public IP (or the VPC).

---

## 7. Start the cluster with PM2

`ecosystem.config.js` is already in the repo.

```bash
cd ~/mecfinders/backend
pm2 start ecosystem.config.js --env production

pm2 status                 # all instances "online"
pm2 logs mecfinders-api    # watch boot logs
pm2 save                   # remember this process list
pm2 startup                # prints a command — run it to auto-start on reboot
```

Confirm the scaling wiring actually engaged — the logs should show:
```
Redis initialising for multi-process scaling
Socket.IO using Redis adapter (multi-process realtime enabled)
Dispatch sweeper started (every 5000ms)
```
And exactly **one** process should be doing sweeps (the leader-lock holder). The
others stay quiet — that's correct.

To reload after a code update with **zero downtime**:
```bash
git pull && npm ci --omit=dev && pm2 reload mecfinders-api
```

---

## 8. Nginx reverse proxy + TLS

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/mecfinders
```

Paste (full config is also in `SCALING.md`):

```nginx
upstream mecfinders_api {
    ip_hash;                    # sticky sessions — keeps a websocket on one process
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    location / { return 301 https://$host$request_uri; }   # force HTTPS
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # certbot fills in the ssl_certificate lines below

    client_max_body_size 2m;    # matches JSON_BODY_LIMIT (1mb) + headroom

    location / {
        proxy_pass http://mecfinders_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;         # websocket upgrade
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mecfinders /etc/nginx/sites-enabled/
sudo nginx -t                      # test config
sudo systemctl reload nginx

# free TLS cert (auto-renews)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

Because `TRUST_PROXY=true`, the app now sees real client IPs (rate limiting +
logs work correctly).

---

## 9. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'    # 80 + 443
sudo ufw enable
sudo ufw status                # 5000 and 6379 must NOT be listed
```

---

## 10. Point the apps at production

In each frontend's `lib/api.ts`, replace the ngrok base URL with
`https://api.yourdomain.com`, then rebuild:

```bash
# customer + provider apps (Capacitor static export)
npm run build && npx cap sync

# admin panel — set its API rewrite target to the prod URL, then build/deploy
```

Rebuild the Android/iOS apps so the new URL ships.

---

## 11. Smoke test (do this before announcing)

```bash
curl https://api.yourdomain.com/api/health
# → {"success":true,"db":"up","redis":"up",...}   ← redis MUST say "up" in Tier 2
```

Then manually run one full booking on real devices:
- customer creates booking → provider receives it in realtime (no reload)
- accept → OTP → start → complete → pay (cash + Razorpay)
- check the admin panel shows it with correct split + timeline

Load test before trusting capacity:
```bash
npm i -g autocannon
autocannon -c 100 -d 30 https://api.yourdomain.com/api/mobile/categories
```
Watch p99 latency + error rate. If Atlas connections saturate, raise the Atlas
tier before adding Node processes.

---

## 12. OPTIONAL — strict global rate limiting (`rate-limit-redis`)

**Current behaviour:** rate limits are counted **per process** (in-memory). In a
2-process cluster the effective limit is ~2× what's configured. That's an
acceptable backstop, but auth/OTP brute-force protection is looser than it looks.

If you want **one hard limit shared across all processes** (recommended for the
auth + OTP endpoints on a money app), add a Redis-backed store:

```bash
npm install rate-limit-redis
```

Then edit `src/middleware/rateLimit.js`:

```js
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../config/redis');
const config = require('../config');

// Build a shared store ONLY when Redis is connected; otherwise fall back to the
// default in-memory store (single-process dev, or Redis down).
function store(prefix) {
  const client = redis.getClient();
  if (!client) return undefined; // → default in-memory store
  return new RedisStore({
    prefix,
    sendCommand: (...args) => client.call(...args),
  });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  store: store('rl:auth:'),
  handler: json('Too many attempts. Please try again in a few minutes.'),
});
// ...apply store('rl:write:') / store('rl:api:') to the other two the same way
```

Nothing else changes — the limiters still no-op in tests and still skip
health/webhooks. With the store attached, all processes decrement the same
counter, so `limit: 20` means 20 total, not 20 per process.

> Not doing this yet is fine. Do it before you rely on the auth limiter as real
> brute-force protection under a multi-process cluster.

---

## 13. OPTIONAL — dedicated sweeper worker

Today the dispatch sweeper runs as a leader-locked interval **inside** the API
processes — only one process ever sweeps, so this scales comfortably past 1000
users. You only need a separate worker if sweeping ever competes with request
handling for CPU (it won't at this scale).

If you get there: run one extra PM2 app that starts a process which calls only
`dispatchService.startSweeper()` (not `server.listen`), and set an env flag on
the API processes to skip starting their own sweeper. Ping me (or server-side
Claude) when you actually need this — it's a 20-line change.

---

## 14. Monitoring & upkeep

- `pm2 monit` — live per-process CPU/RAM
- `pm2 logs mecfinders-api --lines 200` — recent logs
- **MongoDB Atlas metrics** — the #1 thing to watch: connections, op latency,
  slow queries. This saturates before Node does.
- `redis-cli -a <pwd> info clients` — Redis connection count
- Consider log shipping (e.g. `pm2 install pm2-logrotate` so logs don't fill disk)

**Rollback:** `git log` → `git checkout <good-commit>` → `npm ci --omit=dev` →
`pm2 reload mecfinders-api`. Keep the previous commit hash handy after each deploy.

---

## Quick reference — the whole thing once it's set up

```bash
# deploy an update
cd ~/mecfinders/backend && git pull && npm ci --omit=dev && pm2 reload mecfinders-api

# health
curl https://api.yourdomain.com/api/health

# logs / status
pm2 status && pm2 logs mecfinders-api
```
