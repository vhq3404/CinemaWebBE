// Import các thư viện cần thiết
const express = require("express");
const router = express.Router();
const pool = require("../db"); // Kết nối cơ sở dữ liệu

// API tạo phòng chiếu
router.post("/", async (req, res) => {
  const { room_name, theater_id, room_type } = req.body;

  if (!room_name || !theater_id || !room_type) {
    return res
      .status(400)
      .json({ error: "Thiếu room_name, theater_id hoặc room_type" });
  }

  try {
    // Kiểm tra trùng tên phòng trong cùng rạp
    const existingRoom = await pool.query(
      `SELECT 1 FROM rooms WHERE theater_id = $1 AND room_name = $2`,
      [theater_id, room_name]
    );

    if (existingRoom.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "Tên phòng đã tồn tại trong rạp này" });
    }

    // Chèn phòng mới
    const roomResult = await pool.query(
      `INSERT INTO rooms (theater_id, room_name, room_type) 
       VALUES ($1, $2, $3) RETURNING id`,
      [theater_id, room_name, room_type]
    );

    const roomId = roomResult.rows[0].id;

    res.status(201).json({ message: "Tạo phòng chiếu thành công", roomId });
  } catch (error) {
    console.error("Lỗi khi tạo phòng:", error.message);
    res.status(500).json({ error: "Lỗi khi tạo phòng chiếu" });
  }
});

// API cập nhật thông tin phòng chiếu
router.put("/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const { room_name, room_type } = req.body;

  if (!room_name || !room_type) {
    return res.status(400).json({ error: "Thiếu room_name hoặc room_type" });
  }

  try {
    // Kiểm tra phòng có tồn tại không
    const existingRoom = await pool.query(`SELECT * FROM rooms WHERE id = $1`, [
      roomId,
    ]);

    if (existingRoom.rows.length === 0) {
      return res.status(404).json({ error: "Phòng không tồn tại" });
    }

    // Cập nhật phòng
    await pool.query(
      `UPDATE rooms SET room_name = $1, room_type = $2, updated_at = NOW() WHERE id = $3`,
      [room_name, room_type, roomId]
    );

    res.status(200).json({ message: "Cập nhật phòng thành công" });
  } catch (error) {
    console.error("Lỗi khi cập nhật phòng:", error.message);
    res.status(500).json({ error: "Lỗi khi cập nhật phòng chiếu" });
  }
});

// API xóa phòng chiếu
router.delete("/:roomId", async (req, res) => {
  const { roomId } = req.params;

  try {
    // Kiểm tra phòng có tồn tại không
    const existingRoom = await pool.query(`SELECT * FROM rooms WHERE id = $1`, [
      roomId,
    ]);

    if (existingRoom.rows.length === 0) {
      return res.status(404).json({ error: "Phòng không tồn tại" });
    }

    // Xóa phòng chiếu
    await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);

    res.status(200).json({ message: "Xóa phòng chiếu thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa phòng:", error.message);
    res.status(500).json({ error: "Lỗi khi xóa phòng chiếu" });
  }
});

// API lấy danh sách các phòng theo rạp và tên của rạp
router.get("/theater/:theaterId", async (req, res) => {
  const { theaterId } = req.params;

  try {
    // Câu lệnh SQL dùng JOIN để lấy tên rạp cùng với danh sách phòng
    const result = await pool.query(
      `SELECT r.id, r.room_name, r.room_type, t.name 
       FROM rooms r
       JOIN theaters t ON r.theater_id = t.id
       WHERE r.theater_id = $1`,
      [theaterId]
    );

    // Trả về kết quả, bao gồm tên của rạp
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng:", error.message);
    res.status(500).json({ error: "Lỗi khi lấy danh sách phòng chiếu" });
  }
});

module.exports = router;
