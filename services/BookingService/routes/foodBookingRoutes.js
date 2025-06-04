const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get all food-bookings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM food_booking ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Tạo mới hóa đơn đặt món ăn
router.post("/", async (req, res) => {
  const { user_id, items } = req.body;

  if (!user_id || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: "Missing or invalid user_id or items" });
  }

  // Tính tổng tiền
  let total_price = 0;
  for (const item of items) {
    if (
      !item.food_id ||
      !item.food_name ||
      typeof item.unit_price !== "number" ||
      typeof item.quantity !== "number"
    ) {
      return res.status(400).json({ error: "Invalid food item format" });
    }
    total_price += item.unit_price * item.quantity;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Tạo bản ghi trong bảng food_booking
    const bookingResult = await client.query(
      `
      INSERT INTO food_booking (user_id, total_price, status)
      VALUES ($1, $2, 'PENDING') RETURNING id
      `,
      [user_id, total_price]
    );
    const food_booking_id = bookingResult.rows[0].id;

    // Thêm các món ăn vào bảng food_booking_items
    const insertItemText = `
      INSERT INTO food_booking_items 
        (food_booking_id, food_id, food_name, quantity, unit_price)
      VALUES ($1, $2, $3, $4, $5)
    `;
    for (const item of items) {
      await client.query(insertItemText, [
        food_booking_id,
        item.food_id,
        item.food_name,
        item.quantity,
        item.unit_price,
      ]);
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Food booking created", food_booking_id });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Thêm vào file hiện tại (vd: foodBookings.js)
router.delete("/:id", async (req, res) => {
  const foodBookingId = req.params.id;

  if (!foodBookingId) {
    return res.status(400).json({ error: "Missing food_booking_id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Xóa các món ăn liên quan trong bảng food_booking_items
    await client.query(
      `DELETE FROM food_booking_items WHERE food_booking_id = $1`,
      [foodBookingId]
    );

    // Xóa bản ghi trong bảng food_booking
    const result = await client.query(
      `DELETE FROM food_booking WHERE id = $1 RETURNING *`,
      [foodBookingId]
    );

    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Food booking not found" });
    }

    res.status(200).json({ message: "Food booking deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put("/:id/total_price", async (req, res) => {
  const foodBookingId = req.params.id;
  const { total_price } = req.body;

  if (total_price === undefined || isNaN(total_price)) {
    return res.status(400).json({ error: "Invalid or missing total_price" });
  }

  try {
    const result = await pool.query(
      `UPDATE food_booking 
       SET total_price = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 RETURNING *`,
      [total_price, foodBookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ message: "Total price updated", food_booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy tất cả food_booking theo user_id
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT fb.*, json_agg(fbi.*) AS items
      FROM food_booking fb
      LEFT JOIN food_booking_items fbi ON fb.id = fbi.food_booking_id
      WHERE fb.user_id = $1
      GROUP BY fb.id
      ORDER BY fb.created_at DESC
      `,
      [userId]
    );

    res.json({ food_bookings: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy tất cả food_booking_items theo food_booking_id
router.get("/:id/items", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM food_booking_items
      WHERE food_booking_id = $1
      ORDER BY id ASC
      `,
      [id]
    );

    res.json({ items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
