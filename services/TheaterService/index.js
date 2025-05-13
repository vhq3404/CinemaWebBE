const express = require("express");
const app = express();
const path = require("path");
const fs = require('fs');
const theaterRoutes = require("./routes/theaterRoutes");
const roomRoutes = require("./routes/roomRoutes");
const seatRoutes = require("./routes/seatRoutes");
const cors = require('cors');
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

app.use("/theaters/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/theaters", theaterRoutes);

app.use("/api/rooms", roomRoutes);

app.use("/api/seats", seatRoutes);

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`TheaterService server running on port ${PORT}`));
