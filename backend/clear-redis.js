const Redis = require('ioredis');
require('dotenv').config();
const client = new Redis(process.env.REDIS_URL);
async function clear() {
  const keys = await client.keys('rl:*');
  if (keys.length > 0) {
    await client.del(...keys);
    console.log(`Deleted ${keys.length} rate limit keys`);
  } else {
    console.log('No rate limit keys found');
  }
  process.exit(0);
}
clear();
