const express = require("express");
const mongoose = require("mongoose");
const promotionRoutes = require("./routes/promotionRoutes");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const cors = require("cors");
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

const PORT = process.env.PORT || 5008;

// Tạo thư mục uploads nếu chưa có
const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

// Middleware
app.use(express.json());
app.use("/promotions/uploads", express.static(path.join(__dirname, "uploads"))); 

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));
// Routes
app.use("/api/promotions", promotionRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("PromotionService is running!");
});

app.listen(PORT, () => {
  console.log(`PromotionService server is running on port ${PORT}`);
});
