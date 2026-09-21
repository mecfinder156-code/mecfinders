# MecFinders Backend — Scaling & Deployment

Straight answer to "will it handle 500–600 users, and scale to 1000?"

- **500–600 concurrent users:** yes, on a single well-sized process — provided you
  drop ngrok for real hosting. The workload is I/O-bound (mostly waiting on
  MongoDB), which Node handles well.
- **1000+ users with headroom:** run **multiple processes** with Redis wired in
  (already built — just set `REDIS_URL` and use PM2 cluster mode).

Nothing below is required to keep running as you are today. Without `REDIS_URL`
the app behaves exactly as the original single-process server.

---

## What was changed for scale

| Area | Before | Now |
|---|---|---|
| Rate limiting | none | tiered (`authLimiter`, `writeLimiter`, `apiLimiter`) — a single bad client can't drown the server/DB |
| Mongo pool | default, untuned | explicit `maxPoolSize` / timeouts (env-tunable) |
| Body limit | 50mb | 1mb (env-tunable); webhook raw body untouched |
| Reference reads | every request hits DB | cache-aside (Redis or in-memory) for categories/services/pricing, auto-invalidated on admin edits |
| Realtime | in-memory only → **1 process max** | Socket.IO Redis adapter → works across N processes |
| Dispatch sweeper | ran in every process | leader-lock → exactly one sweeper across the cluster; batched bulk updates |
| Health check | static "ok" | reports real DB/Redis state (503 when DB down) so a load balancer can pull the instance |
| Response size | uncompressed | gzip via `compression` |
| Multi-core | single process | PM2 cluster (`ecosystem.config.js`) |
| Shutdown | closed server | also stops sweeper, releases lock, closes Redis |

All 16 integration scenarios still pass (`node tests/integration.run.js`).

---

## Deployment tiers

### Tier 1 — up to ~600 users (single process, no Redis)
1. Host on a real VPS/instance (2 vCPU / 4 GB is plenty), **not ngrok**.
2. Put Nginx in front for TLS + a stable domain (config below).
3. `NODE_ENV=production npm start` (or PM2 with `instances: 1`).
4. Leave `REDIS_URL` blank. Done.

### Tier 2 — 1000+ users (multi-process + Redis)
1. Provision Redis (managed, e.g. Elasticache/Upstash/Redis Cloud, or a local
   `redis-server`).
2. Set `REDIS_URL=redis://<host>:6379` in `.env`.
3. Size the pool so `instances × MONGO_MAX_POOL < Atlas connection limit`
   (M0 ≈ 500, M10 ≈ 1500). E.g. 4 instances × 50 = 200 connections.
4. Start the cluster:
   ```bash
   npm i -g pm2
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup   # auto-start on reboot
   ```
5. Nginx must use **sticky sessions** for websockets (see `ip_hash` below), or
   allow Socket.IO polling fallback (already enabled).

---

## Nginx reverse proxy (replaces ngrok)

```nginx
upstream mecfinders_api {
    ip_hash;                 # sticky: keeps a socket client on one process
    server 127.0.0.1:5000;
    # add more if you run separate ports instead of PM2 cluster:
    # server 127.0.0.1:5001;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    client_max_body_size 2m;   # matches JSON_BODY_LIMIT (+ headroom)

    location / {
        proxy_pass http://mecfinders_api;
        proxy_http_version 1.1;

        # WebSocket upgrade for Socket.IO
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
    }
}
```

With Nginx in front, set `TRUST_PROXY=true` (or `1`) in `.env` so rate limiting
and logs see the real client IP.

Then point each app's `lib/api.ts` base URL at `https://api.yourdomain.com`
instead of the ngrok URL.

---

## Capacity math (rough)

- Idle websocket connections are cheap: 600 sockets ≈ tens of MB RAM. Not the
  bottleneck.
- The real limit is **concurrent DB operations**. At any instant only a fraction
  of "logged-in" users are actively mutating (booking/paying). 600 users
  typically means ~10–50 in-flight DB ops — comfortably inside a 50-connection
  pool.
- First thing to watch under load: MongoDB Atlas metrics (connections, op
  latency). If connections saturate, raise the Atlas tier before adding app
  processes.

## Load test before you trust it
```bash
npm i -g autocannon
autocannon -c 100 -d 30 https://api.yourdomain.com/api/mobile/categories
```
Watch p99 latency and error rate. Tune `MONGO_MAX_POOL` and instance count from
what you see — don't guess.

## What is NOT done (future, only if you outgrow the above)
- Cross-process **strict** rate limiting (currently per-process; swap in
  `rate-limit-redis` if you need a hard global cap).
- Moving the dispatch sweeper into a dedicated worker process (today it's a
  leader-locked interval inside the API processes — fine to well past 1000).
- CDN for static assets / image delivery (Cloudinary already offloads images).
