const express = require("express");
const dotenv = require("dotenv");
const PayOS = require("@payos/node");
const { poolUsers, poolBookings } = require("../db");

dotenv.config();
const router = express.Router();

const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

// POST /api/payments/payos
router.post("/payos", async (req, res) => {
  const { paymentCode, amount } = req.body;

  if (!paymentCode || !amount) {
    return res.status(400).json({ error: "Thiếu thông tin yêu cầu" });
  }

  const returnUrl = `${
    process.env.RETURN_URL || "http://localhost:3000"
  }/payment-success`;
  const cancelUrl = `${process.env.RETURN_URL || "http://localhost:3000"}/`;

  const body = {
    orderCode: Number(String(Date.now()).slice(-6)),
    amount,
    description: "Thanh toán vé",
    returnUrl,
    cancelUrl,
  };

  try {
    const paymentLinkResponse = await payOS.createPaymentLink(body);
    res.status(200).json({
      checkoutUrl: paymentLinkResponse.checkoutUrl,
    });
  } catch (err) {
    console.error("Lỗi tạo link thanh toán:", err);
    res.status(500).json({ error: "Không thể tạo link thanh toán" });
  }
});

router.post("/success", async (req, res) => {
  const { bookingId, userId, usedPoints = 0, foodBookingId } = req.body;

  if (!bookingId || !userId) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin xác nhận thanh toán" });
  }

  try {
    // 1. Lấy số tiền đã thanh toán từ booking
    const bookingResult = await poolBookings.query(
      `SELECT total_price FROM booking WHERE id = $1`,
      [bookingId]
    );

    if (bookingResult.rowCount === 0) {
      return res.status(404).json({ error: "Booking không tồn tại" });
    }

    let amount = Number(bookingResult.rows[0].total_price) || 0;

    if (foodBookingId) {
      const foodResult = await poolBookings.query(
        `SELECT total_price FROM food_booking WHERE id = $1`,
        [foodBookingId]
      );

      if (foodResult.rowCount === 0) {
        return res.status(404).json({ error: "Food booking không tồn tại" });
      }

      const foodPrice = Number(foodResult.rows[0].total_price) || 0;

      amount += foodPrice;

      await poolBookings.query(
        `UPDATE food_booking SET status = 'PAID' WHERE id = $1`,
        [foodBookingId]
      );
    }

    // 3. Cập nhật trạng thái booking thành PAID
    await poolBookings.query(
      `UPDATE booking SET status = 'PAID' WHERE id = $1`,
      [bookingId]
    );

    // 4. Tính điểm thưởng (5% trên số tiền thực trả)
    const earnedPoints = Math.round((amount / 1000) * 0.05) || 0;

    // 5. Cập nhật điểm user
    await poolUsers.query(
      `UPDATE users SET points = points + $1 - $2 WHERE id = $3`,
      [earnedPoints, usedPoints, userId]
    );

    res.status(200).json({
      message: "Thanh toán và cập nhật điểm thành công",
      earnedPoints,
      totalPaid: amount,
    });
  } catch (error) {
    console.error("Lỗi khi xác nhận thanh toán:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi cập nhật thanh toán" });
  }
});

module.exports = router;

// // 1. Route tạo QR code (chỉ tạo QR, không lưu DB)
// router.post("/qr", async (req, res) => {
//   const { paymentCode, totalPrice, movieTitle } = req.body;

//   try {
//     const adminBankInfo = {
//       bank: process.env.BANK_NAME,
//       bin: process.env.BANK_BIN,
//       accountNumber: process.env.BANK_ACCOUNT_NUMBER,
//       accountName: process.env.BANK_ACCOUNT_NAME,
//     };

//     const qrData = {
//       accountNo: adminBankInfo.accountNumber,
//       accountName: adminBankInfo.accountName
//         .toUpperCase()
//         .replace(/[^A-Z\s]/g, ""),
//       acqId: parseInt(adminBankInfo.bin),
//       amount: totalPrice,
//       addInfo: movieTitle,
//       format: "qrDataURL",
//       template: "qr_only",
//     };

//     const vietQrResponse = await axios.post(
//       "https://api.vietqr.io/v2/generate",
//       qrData,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "x-client-id": process.env.VIETQR_CLIENT_ID,
//           "x-api-key": process.env.VIETQR_API_KEY,
//         },
//       }
//     );

//     if (vietQrResponse.data.code !== "00") {
//       return res.status(400).json({
//         status: "ERR",
//         message: vietQrResponse.data.desc || "Failed to generate VietQR code",
//       });
//     }

//     return res.status(200).json({
//       status: "OK",
//       data: {
//         qrCodeUrl: vietQrResponse.data.data.qrDataURL,
//         adminBankInfo,
//       },
//     });
//   } catch (err) {
//     console.error("Error generating QR:", err);
//     res.status(500).json({ status: "ERR", message: "Internal Server Error" });
//   }
// });

// router.post("/create", async (req, res) => {
//   const {
//     paymentCode,
//     userBank,
//     userBankNumber,
//     paymentMethod,
//     bookingId,
//     qrCodeUrl,
//   } = req.body;

//   try {
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

//     await pool.query(
//       `INSERT INTO payments (payment_code, payment_method, user_bank, user_bank_number, booking_id, qr_code_url, status, expires_at)
//        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
//       [
//         paymentCode,
//         paymentMethod,
//         userBank,
//         userBankNumber,
//         bookingId,
//         qrCodeUrl,
//         "PENDING",
//         expiresAt,
//       ]
//     );

//     res.status(200).json({ status: "OK", message: "Payment created" });
//   } catch (err) {
//     console.error("Error creating payment:", err);
//     res.status(500).json({ status: "ERR", message: "Internal Server Error" });
//   }
// });
