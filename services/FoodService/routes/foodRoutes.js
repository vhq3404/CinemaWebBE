const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Food = require("../models/Food");
const multer = require("multer");
const path = require("path");

// Cấu hình multer để lưu ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // thư mục lưu ảnh
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// --- Lấy danh sách tất cả món ăn (có thể lọc isAvailable)
router.get("/", async (req, res) => {
  try {
    const isAvailable = req.query.isAvailable;
    const filter = {};
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";

    const foods = await Food.find(filter);
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách món ăn" });
  }
});

// --- Lấy món ăn theo ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID không hợp lệ" });
  }

  try {
    const food = await Food.findById(id);
    if (!food) return res.status(404).json({ error: "Không tìm thấy món ăn" });
    res.json(food);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy món ăn" });
  }
});

// --- Thêm món ăn mới
router.post("/", upload.single("image"), async (req, res) => {
  try {
    let foodData = {};

    // Nếu gửi form-data (multer sẽ parse req.body thành object với trường dạng text)
    if (req.body.data) {
      try {
        foodData = JSON.parse(req.body.data);
      } catch {
        return res
          .status(400)
          .json({ error: "Dữ liệu JSON trong 'data' không hợp lệ" });
      }
    } else {
      // Nếu client gửi thẳng JSON (application/json), req.body chính là object rồi
      foodData = req.body;
    }

    // Nếu có ảnh upload
    if (req.file) {
      foodData.imageUrl = path.join("uploads", req.file.filename);
    }

    // Validate trường bắt buộc (nếu muốn)
    if (!foodData.name || !foodData.price) {
      return res
        .status(400)
        .json({ error: "Thiếu trường bắt buộc: name hoặc price" });
    }

    const newFood = new Food(foodData);
    await newFood.save();

    res.status(201).json({ message: "Thêm món ăn thành công", food: newFood });
  } catch (err) {
    res
      .status(400)
      .json({ error: "Lỗi khi thêm món ăn", details: err.message });
  }
});

// --- Cập nhật món ăn theo ID
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const foodId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(foodId)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const updateData = JSON.parse(req.body.data || "{}");

    if (req.file) {
      updateData.imageUrl = path.join("uploads", req.file.filename);
    }

    const updatedFood = await Food.findByIdAndUpdate(foodId, updateData, {
      new: true,
    });

    if (!updatedFood) {
      return res.status(404).json({ error: "Món ăn không tồn tại" });
    }

    res.json(updatedFood);
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ", details: err.message });
  }
});

// --- Xóa món ăn theo ID
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Food.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Không tìm thấy món ăn để xóa" });
    res.json({ message: "Xóa món ăn thành công" });
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi xóa món ăn", details: err.message });
  }
});

module.exports = router;
