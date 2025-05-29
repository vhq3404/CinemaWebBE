const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Discount = require("../models/Discount");
const discountController = require("../controllers/discountController");

// Lấy danh sách tất cả voucher, có thể lọc theo mã code
router.get("/", async (req, res) => {
  try {
    const { code } = req.query;
    const filter = {};
    if (code) filter.code = new RegExp(code, "i");
    const discounts = await Discount.find(filter);
    res.json(discounts);
  } catch (err) {
    console.error("Lỗi lấy danh sách voucher:", err);
    res.status(500).json({ error: "Lỗi lấy danh sách voucher" });
  }
});

// Lấy voucher theo ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ error: "ID không hợp lệ" });

  try {
    const discount = await Discount.findById(id);
    if (!discount) return res.status(404).json({ error: "Không tìm thấy voucher" });
    res.json(discount);
  } catch (err) {
    console.error("Lỗi lấy voucher:", err);
    res.status(500).json({ error: "Lỗi khi lấy voucher" });
  }
});

// Tạo voucher mới
router.post("/", async (req, res) => {
  try {
    const discountData = req.body;
    const newDiscount = new Discount(discountData);
    await newDiscount.save();
    res.status(201).json({ message: "Tạo voucher thành công", discount: newDiscount });
  } catch (err) {
    console.error("Lỗi tạo voucher:", err);
    res.status(400).json({ error: "Lỗi khi tạo voucher", details: err.message });
  }
});

// Cập nhật voucher theo ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ error: "ID không hợp lệ" });

  try {
    const updatedDiscount = await Discount.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedDiscount)
      return res.status(404).json({ error: "Voucher không tồn tại" });

    res.json(updatedDiscount);
  } catch (err) {
    console.error("Lỗi cập nhật voucher:", err);
    res.status(400).json({ error: "Lỗi khi cập nhật voucher", details: err.message });
  }
});

// Xóa voucher theo ID
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ error: "ID không hợp lệ" });

  try {
    const deleted = await Discount.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ error: "Không tìm thấy voucher để xóa" });

    res.json({ message: "Xóa voucher thành công" });
  } catch (err) {
    console.error("Lỗi xóa voucher:", err);
    res.status(400).json({ error: "Lỗi khi xóa voucher", details: err.message });
  }
});

// Validate mã voucher (gọi từ controller)
router.post("/validate", discountController.validateCode);

module.exports = router;
