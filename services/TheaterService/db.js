require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Neon yêu cầu SSL nhưng không cần chứng chỉ
  },
});

module.exports = pool;
