const Discount = require("../models/Discount");
const { fetchMovieById } = require("../APIs/movieAPI")

exports.validateCode = async (req, res) => {
  try {
    const { code, orderTotal, movieId } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: "Thiếu mã voucher" });

    const now = new Date();
    const discount = await Discount.findOne({ code });
    if (!discount) return res.status(404).json({ valid: false, message: "Mã không tồn tại" });

    if (discount.startDate && discount.startDate > now)
      return res.status(400).json({ valid: false, message: "Voucher chưa đến ngày áp dụng" });

    if (discount.endDate && discount.endDate < now)
      return res.status(400).json({ valid: false, message: "Voucher đã hết hạn" });

    if (orderTotal < discount.minOrderValue)
      return res.status(400).json({ valid: false, message: `Đơn hàng tối thiểu là ${discount.minOrderValue}` });

    if (discount.usageCount >= discount.usageLimit)
      return res.status(400).json({ valid: false, message: "Voucher đã được sử dụng hết" });

    // Nếu voucher áp dụng cho phim cụ thể
    if (discount.movieIds?.length > 0) {
      if (!movieId)
        return res.status(400).json({ valid: false, message: "Voucher này yêu cầu phải chọn phim" });

      if (!discount.movieIds.includes(movieId))
        return res.status(400).json({ valid: false, message: "Voucher không áp dụng cho phim này" });

      const movie = await fetchMovieById(movieId);
      if (!movie) {
        return res.status(400).json({ valid: false, message: "Phim không tồn tại hoặc không kết nối được MovieService" });
      }
    }

    // Tính giá trị giảm
    let discountAmount = 0;
    if (discount.discountType === "FIXED") {
      discountAmount = discount.discountValue;
    } else if (discount.discountType === "PERCENT") {
      discountAmount = (orderTotal * discount.discountValue) / 100;
      if (discount.maxDiscount) discountAmount = Math.min(discountAmount, discount.maxDiscount);
    }

    return res.json({
      valid: true,
      discountAmount,
      message: "Áp dụng voucher thành công",
    });
  } catch (err) {
    console.error("Lỗi validateCode:", err);
    return res.status(500).json({ valid: false, message: "Lỗi server khi xử lý voucher" });
  }
};
