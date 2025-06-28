const express = require("express");
const http = require("http"); // thêm
const { Server } = require("socket.io");
const { initSocket } = require("./socket");
const app = express();
const cors = require("cors");
const bookingRoutes = require("./routes/bookingRoutes");
const foodBookingRoutes = require("./routes/foodBookingRoutes");
require("dotenv").config();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/bookings", bookingRoutes);
app.use("/api/food-bookings", foodBookingRoutes);

// Tạo server HTTP từ app Express
const server = http.createServer(app);

initSocket(server);

// // Tạo instance Socket.IO và cấu hình CORS cho phép frontend kết nối
// const io = new Server(server, {
//   cors: {
//     origin: "*", // bạn có thể thay * bằng domain frontend
//     methods: ["GET", "POST"],
//   },
// });

// // Lắng nghe sự kiện kết nối từ client
// io.on("connection", (socket) => {
//   // Ví dụ: nhận thông báo ghế đã bị khóa từ client
//   socket.on("lockSeats", (data) => {
//     // data có thể là { showtimeId, seatIds }

//     // Phát (broadcast) sự kiện đến tất cả client khác trừ client gửi
//     socket.broadcast.emit("seatsLocked", data);
//   });

//   socket.on("disconnect", () => {
//     console.log("Client disconnected:", socket.id);
//   });
// });

// Lắng nghe server trên PORT
const PORT = process.env.PORT || 5006;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`BookingService server running on port ${PORT}`);
});
