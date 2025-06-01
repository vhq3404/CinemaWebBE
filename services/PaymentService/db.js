require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const poolUsers = new Pool({
  connectionString: process.env.DB_USERS_URL,
  ssl: { rejectUnauthorized: false },
});

const poolBookings = new Pool({
  connectionString: process.env.DB_BOOKINGS_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = { pool, poolUsers, poolBookings };
