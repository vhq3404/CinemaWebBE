const redis = require("redis");

const redisClient = redis.createClient({
  url: "redis://default:Ow6MRWKTPwJM4vVxU0T4RvIOF5EqG7zY@redis-13137.crce185.ap-seast-1-1.ec2.redns.redis-cloud.com:13137",
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Redis connect error:", err);
  }
})();

module.exports = redisClient;
