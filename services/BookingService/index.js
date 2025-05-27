const express = require("express");
const http = require("http"); // thêm
const { Server } = require("socket.io"); // thêm
const app = express();
const cors = require("cors");
const bookingRoutes = require("./routes/bookingRoutes"); // import routes booking
require("dotenv").config();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/bookings", bookingRoutes);

// Tạo server HTTP từ app Express
const server = http.createServer(app);

// Tạo instance Socket.IO và cấu hình CORS cho phép frontend kết nối
const io = new Server(server, {
  cors: {
    origin: "*", // bạn có thể thay * bằng domain frontend
    methods: ["GET", "POST"],
  },
});

// Lắng nghe sự kiện kết nối từ client
io.on("connection", (socket) => {
  console.log("New client connected, socket id:", socket.id);

  // Ví dụ: nhận thông báo ghế đã bị khóa từ client
  socket.on("lockSeats", (data) => {
    // data có thể là { showtimeId, seatIds }
    console.log("Seats locked:", data);

    // Phát (broadcast) sự kiện đến tất cả client khác trừ client gửi
    socket.broadcast.emit("seatsLocked", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Lắng nghe server trên PORT
const PORT = process.env.PORT || 5004;
server.listen(PORT, () => {
  console.log(`BookingService server running on port ${PORT}`);
});
