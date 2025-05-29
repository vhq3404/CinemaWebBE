const express = require("express");
const router = express.Router();
const pool = require("../db");
const redisClient = require("../redisClient");

// Get all bookings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM booking ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all bookings by user_id
router.get("/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const bookingsResult = await pool.query(
      `
      SELECT 
        b.*, 
        json_agg(bs.seat_id) AS seat_ids
      FROM booking b
      LEFT JOIN booking_seats bs ON b.id = bs.booking_id
      WHERE b.user_id = $1
      GROUP BY b.id
      ORDER BY b.created_at DESC
      `,
      [userId]
    );

    res.json(bookingsResult.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get booking by ID (kèm theo seat_ids)
router.get("/:id", async (req, res) => {
  try {
    const bookingResult = await pool.query(
      "SELECT * FROM booking WHERE id = $1",
      [req.params.id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookingResult.rows[0];

    const seatsResult = await pool.query(
      "SELECT seat_id FROM booking_seats WHERE booking_id = $1",
      [booking.id]
    );

    booking.seat_ids = seatsResult.rows.map((r) => r.seat_id);

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new booking
router.post("/", async (req, res) => {
  const { user_id, showtime_id, room_id, seat_ids, total_price } = req.body;

  if (
    !user_id ||
    !showtime_id ||
    !room_id ||
    !seat_ids ||
    !Array.isArray(seat_ids) ||
    seat_ids.length === 0 ||
    !total_price
  ) {
    return res
      .status(400)
      .json({ error: "Missing or invalid required fields" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertBookingText = `
      INSERT INTO booking (user_id, showtime_id, room_id, total_price, status)
      VALUES ($1, $2, $3, $4, 'PENDING') RETURNING id
    `;
    const bookingResult = await client.query(insertBookingText, [
      user_id,
      showtime_id,
      room_id,
      total_price,
    ]);
    const bookingId = bookingResult.rows[0].id;

    const insertSeatText =
      "INSERT INTO booking_seats (booking_id, seat_id) VALUES ($1, $2)";
    for (const seatId of seat_ids) {
      await client.query(insertSeatText, [bookingId, seatId]);
    }

    await client.query("COMMIT");

    // Cache ghế đã khóa trong Redis (TTL 600 giây = 10 phút)
    const cacheKey = `locked_seats:${showtime_id}`;
    const existingCache = await redisClient.get(cacheKey);
    let currentLockedSeats = [];

    if (existingCache) {
      currentLockedSeats = JSON.parse(existingCache);
    }

    const updatedLockedSeats = [
      ...new Set([...currentLockedSeats, ...seat_ids]),
    ];

    await redisClient.setEx(cacheKey, 60, JSON.stringify(updatedLockedSeats));

    res.status(201).json({ message: "Booking created", booking_id: bookingId });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update booking status (e.g. change status to PAID or CANCELLED)
router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["PENDING", "PAID", "CANCELLED"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Cập nhật trạng thái trong DB
    const result = await client.query(
      "UPDATE booking SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    const updatedBooking = result.rows[0];

    // Nếu là PAID hoặc CANCELLED, cập nhật cache Redis
    if (["PAID", "CANCELLED"].includes(status)) {
      // Lấy showtime_id và danh sách seat_id
      const seatResult = await client.query(
        `SELECT seat_id FROM booking_seats WHERE booking_id = $1`,
        [req.params.id]
      );
      const seatIds = seatResult.rows.map((r) => r.seat_id);

      const showtimeId = updatedBooking.showtime_id;
      const cacheKey = `locked_seats:${showtimeId}`;

      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const currentSeats = JSON.parse(cached);

        // Loại bỏ các seat đã trả/huỷ khỏi danh sách cache
        const updatedSeats = currentSeats.filter((id) => !seatIds.includes(id));

        await redisClient.del(cacheKey);
      }
    }

    await client.query("COMMIT");

    res.json(updatedBooking);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Lấy thông tin showtime_id trước khi xóa
    const showtimeResult = await client.query(
      "SELECT showtime_id FROM booking WHERE id = $1",
      [req.params.id]
    );

    if (showtimeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    const showtimeId = showtimeResult.rows[0].showtime_id;

    // 2. Xoá ghế liên quan
    await client.query("DELETE FROM booking_seats WHERE booking_id = $1", [
      req.params.id,
    ]);

    // 3. Xoá booking
    await client.query("DELETE FROM booking WHERE id = $1", [req.params.id]);

    // 4. Xoá cache Redis liên quan
    const cacheKey = `locked_seats:${showtimeId}`;
    await redisClient.del(cacheKey);

    await client.query("COMMIT");
    res.json({ message: "Booking deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get("/locked-seats/:showtimeId", async (req, res) => {
  const { showtimeId } = req.params;
  const cacheKey = `locked_seats:${showtimeId}`;

  try {
    // 1. Kiểm tra cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json({ locked_seat_ids: JSON.parse(cached) });
    }

    // 2. Nếu không có cache, query DB
    const lockedSeatsResult = await pool.query(
      `
      SELECT bs.seat_id
      FROM booking b
      JOIN booking_seats bs ON b.id = bs.booking_id
      WHERE b.showtime_id = $1 AND b.status IN ('PENDING', 'PAID')
      `,
      [showtimeId]
    );

    const lockedSeatIds = lockedSeatsResult.rows.map((r) => r.seat_id);

    // 3. Lưu kết quả vào cache với TTL 60 giây (tuỳ chỉnh)
    await redisClient.setEx(cacheKey, 60, JSON.stringify(lockedSeatIds));

    res.json({ locked_seat_ids: lockedSeatIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
