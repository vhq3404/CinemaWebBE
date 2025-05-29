require("dotenv").config(); // Tải biến môi trường từ .env
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const discountRoutes = require("./routes/discountRoutes");

const app = express();
const PORT = process.env.PORT || 5006;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Kết nối MongoDB thành công"))
  .catch((err) => {
    console.error(" Lỗi kết nối MongoDB:", err);
    process.exit(1);
  });

// Routes
app.use("/api/discounts", discountRoutes);

// Start server
app.listen(PORT, () => {
  console.log(` Discount Service đang chạy tại http://localhost:${PORT}`);
});
