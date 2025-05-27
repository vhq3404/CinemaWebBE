const express = require("express");
const axios = require("axios");
const router = express.Router();
const pool = require("../db");

// 1. Route tạo QR code (chỉ tạo QR, không lưu DB)
router.post("/qr", async (req, res) => {
  const { paymentCode, totalPrice, movieTitle } = req.body;

  try {
    const adminBankInfo = {
      bank: process.env.BANK_NAME,
      bin: process.env.BANK_BIN,
      accountNumber: process.env.BANK_ACCOUNT_NUMBER,
      accountName: process.env.BANK_ACCOUNT_NAME,
    };

    const qrData = {
      accountNo: adminBankInfo.accountNumber,
      accountName: adminBankInfo.accountName
        .toUpperCase()
        .replace(/[^A-Z\s]/g, ""),
      acqId: parseInt(adminBankInfo.bin),
      amount: totalPrice,
      addInfo: movieTitle,
      format: "qrDataURL",
      template: "qr_only",
    };

    const vietQrResponse = await axios.post(
      "https://api.vietqr.io/v2/generate",
      qrData,
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": process.env.VIETQR_CLIENT_ID,
          "x-api-key": process.env.VIETQR_API_KEY,
        },
      }
    );

    if (vietQrResponse.data.code !== "00") {
      return res.status(400).json({
        status: "ERR",
        message: vietQrResponse.data.desc || "Failed to generate VietQR code",
      });
    }

    return res.status(200).json({
      status: "OK",
      data: {
        qrCodeUrl: vietQrResponse.data.data.qrDataURL,
        adminBankInfo,
      },
    });
  } catch (err) {
    console.error("Error generating QR:", err);
    res.status(500).json({ status: "ERR", message: "Internal Server Error" });
  }
});

router.post("/create", async (req, res) => {
  const {
    paymentCode,
    userBank,
    userBankNumber,
    paymentMethod,
    bookingId,
    qrCodeUrl,
  } = req.body;

  try {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `INSERT INTO payments (payment_code, payment_method, user_bank, user_bank_number, booking_id, qr_code_url, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        paymentCode,
        paymentMethod,
        userBank,
        userBankNumber,
        bookingId,
        qrCodeUrl,
        "PENDING",
        expiresAt,
      ]
    );

    res.status(200).json({ status: "OK", message: "Payment created" });
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ status: "ERR", message: "Internal Server Error" });
  }
});

module.exports = router;
