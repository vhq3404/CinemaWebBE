// index.js
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const showtimeRoutes = require("./routes/showtimeRoutes");
require("dotenv").config();

const app = express();
const cors = require("cors");
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
const port = process.env.PORT || 5003;

// Middleware để phân tích dữ liệu JSON trong request body
app.use(bodyParser.json());

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Sử dụng các routes cho schedule
app.use("/api/showtimes", showtimeRoutes);

// Start server
app.listen(port, () => {
  console.log(`ScheduleService server is running on port ${port}`);
});
