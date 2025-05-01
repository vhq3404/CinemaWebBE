const express = require('express');
const mongoose = require('mongoose');
const movieRoutes = require('./routes/movieRoutes');
const fs = require('fs');
const path = require('path');

const app = express();
const cors = require('cors');
app.use(cors({
  origin: '*',
  credentials: true
}));

const PORT = process.env.PORT || 5001;

// Tạo thư mục uploads nếu chưa có
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

// Middleware
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Cho phép truy cập file ảnh qua /uploads

// Kết nối MongoDB
mongoose.connect('mongodb+srv://22521195:vhq3404@cluster0.owjegkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/movies', movieRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('MovieService is running!');
});

app.listen(PORT, () => {
  console.log(`MovieService server is running on port ${PORT}`);
});
