const express = require("express");
const router = express.Router();
const pool = require("../db");
const redisClient = require("../redisClient");
const { getIO } = require("../socket");

// Lấy tất cả refund_booking
router.get("/refund-bookings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM refund_booking ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy refund_booking theo id
router.get("/refund-bookings/:id", async (req, res) => {
  try {
    const refundId = req.params.id;
    const result = await pool.query(
      "SELECT * FROM refund_booking WHERE id = $1",
      [refundId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Refund record not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy refund_booking theo booking_id
router.get("/refund-bookings/booking/:bookingId", async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const result = await pool.query(
      "SELECT * FROM refund_booking WHERE booking_id = $1",
      [bookingId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Refund record not found for this booking" });
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
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
  const { user_id, showtime_id, room_id, seat_ids, total_price, movie_id } =
    req.body;

  if (
    !user_id ||
    !showtime_id ||
    !room_id ||
    !seat_ids ||
    !Array.isArray(seat_ids) ||
    seat_ids.length === 0 ||
    !total_price ||
    !movie_id
  ) {
    return res
      .status(400)
      .json({ error: "Missing or invalid required fields" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertBookingText = `
      INSERT INTO booking (user_id, showtime_id, room_id, movie_id, total_price, status)
      VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING id
    `;
    const bookingResult = await client.query(insertBookingText, [
      user_id,
      showtime_id,
      room_id,
      movie_id,
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

    await redisClient.setEx(cacheKey, 600, JSON.stringify(updatedLockedSeats));

    res.status(201).json({ message: "Booking created", booking_id: bookingId });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update only total_price of a booking by ID
router.put("/:id/total_price", async (req, res) => {
  const bookingId = req.params.id;
  const { total_price } = req.body;

  if (total_price === undefined || isNaN(total_price)) {
    return res.status(400).json({ error: "Invalid or missing total_price" });
  }

  try {
    const result = await pool.query(
      `UPDATE booking 
       SET total_price = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [total_price, bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ message: "Total price updated", booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update booking status
router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["PENDING", "PAID", "CANCELLED", "REFUND_REQUESTED"];

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
      WHERE b.showtime_id = $1 AND b.status IN ('PENDING', 'PAID', 'REFUND_REQUESTED')
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

// Gửi yêu cầu hoàn tiền (refund)
router.post("/:id/refund-request", async (req, res) => {
  const bookingId = req.params.id;
  const {
    amount,
    method,
    phone,
    bank_account_name,
    bank_name,
    bank_account_number,
    momo_account_name,
  } = req.body;

  if (
    amount === undefined ||
    amount === null ||
    method === undefined ||
    method === null ||
    (method === "momo" && (!phone || !momo_account_name)) ||
    (method === "bank" &&
      (!bank_account_name || !bank_name || !bank_account_number))
  ) {
    return res
      .status(400)
      .json({ error: "Missing required refund information" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Cập nhật trạng thái booking thành REFUND_REQUESTED
    const updateResult = await client.query(
      `UPDATE booking 
       SET status = 'REFUND_REQUESTED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [bookingId]
    );

    if (updateResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Booking not found" });
    }

    // 2. Tạo bản ghi refund_booking
    await client.query(
      `INSERT INTO refund_booking (
    booking_id, amount, method, phone, momo_account_name, bank_account_name, bank_name, bank_account_number
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        bookingId,
        amount,
        method,
        method === "momo" ? phone : null,
        method === "momo" ? momo_account_name : null,
        method === "bank" ? bank_account_name : null,
        method === "bank" ? bank_name : null,
        method === "bank" ? bank_account_number : null,
      ]
    );

    await client.query("COMMIT");

    const io = getIO();
    io.emit("booking_refund_requested", {
      bookingId,
      amount,
      method,
      phone,
      momo_account_name,
      bank_account_name,
      bank_name,
      bank_account_number,
    });

    res.status(200).json({ message: "Refund request submitted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to submit refund request" });
  } finally {
    client.release();
  }
});

// Hủy yêu cầu hoàn tiền (chuyển về PAID và xóa bản ghi refund_booking)
router.delete("/:id/refund-cancel", async (req, res) => {
  const bookingId = req.params.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Kiểm tra booking tồn tại và đang ở trạng thái REFUND_REQUESTED
    const bookingResult = await client.query(
      "SELECT * FROM booking WHERE id = $1 AND status = 'REFUND_REQUESTED'",
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No refund request to cancel" });
    }

    // 2. Cập nhật trạng thái booking về PAID
    await client.query(
      "UPDATE booking SET status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [bookingId]
    );

    // 3. Xoá bản ghi refund_booking tương ứng
    await client.query("DELETE FROM refund_booking WHERE booking_id = $1", [
      bookingId,
    ]);

    await client.query("COMMIT");
    const io = getIO();
    io.emit("booking_refund_cancelled", {
      bookingId,
    });
    res.json({
      message: "Refund request canceled and booking status set to PAID",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
