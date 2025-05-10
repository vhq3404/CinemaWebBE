const express = require("express");
const app = express();
const path = require("path");
const fs = require('fs');
const theaterRoutes = require("./routes/theaterRoutes");
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

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/theaters", theaterRoutes);

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`TheaterService server running on port ${PORT}`));
