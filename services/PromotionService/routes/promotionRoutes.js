const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Promotion = require("../models/Promotion");
const multer = require("multer");
const path = require("path");

// --- Cấu hình lưu ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// --- Lấy danh sách tất cả ưu đãi
router.get("/", async (req, res) => {
  try {
    const promotions = await Promotion.find();
    res.json(promotions);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách ưu đãi" });
  }
});

// --- Lấy ưu đãi theo ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID không hợp lệ" });
  }

  try {
    const promotion = await Promotion.findById(id);
    if (!promotion) return res.status(404).json({ error: "Không tìm thấy ưu đãi" });
    res.json(promotion);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy ưu đãi" });
  }
});

// --- Thêm ưu đãi mới
router.post("/", upload.single("image"), async (req, res) => {
  try {
    let promoData = {};

    // Nếu gửi form-data
    if (req.body.data) {
      try {
        promoData = JSON.parse(req.body.data);
      } catch {
        return res
          .status(400)
          .json({ error: "Dữ liệu JSON trong 'data' không hợp lệ" });
      }
    } else {
      // Gửi JSON thuần
      promoData = req.body;
    }

    if (req.file) {
      promoData.image = path.join("uploads", req.file.filename);
    }

    if (!promoData.title || !promoData.description) {
      return res
        .status(400)
        .json({ error: "Thiếu trường bắt buộc: title hoặc description" });
    }

    const newPromotion = new Promotion(promoData);
    await newPromotion.save();

    res.status(201).json({ message: "Thêm ưu đãi thành công", promotion: newPromotion });
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi thêm ưu đãi", details: err.message });
  }
});

// --- Cập nhật ưu đãi
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const promotionId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    let updateData = {};
    if (req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
      } catch {
        return res.status(400).json({ error: "Dữ liệu JSON trong 'data' không hợp lệ" });
      }
    } else {
      updateData = req.body;
    }

    if (req.file) {
      updateData.image = path.join("uploads", req.file.filename);
    }

    const updatedPromotion = await Promotion.findByIdAndUpdate(promotionId, updateData, {
      new: true,
    });

    if (!updatedPromotion) {
      return res.status(404).json({ error: "Không tìm thấy ưu đãi để cập nhật" });
    }

    res.json(updatedPromotion);
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ", details: err.message });
  }
});

// --- Xóa ưu đãi
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Promotion.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Không tìm thấy ưu đãi để xóa" });

    res.json({ message: "Xóa ưu đãi thành công" });
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi xóa ưu đãi", details: err.message });
  }
});

module.exports = router;
