const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Movie = require("../models/Movie");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // thư mục lưu ảnh
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Lấy danh sách tất cả phim
router.get("/", async (req, res) => {
  try {
    const status = req.query.status; // Lọc theo trạng thái nếu có
    const movies = status ? await Movie.find({ status }) : await Movie.find();
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách phim" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "ID không hợp lệ" });
  }

  try {
    const movie = await Movie.findById(id);
    if (!movie) return res.status(404).json({ error: "Không tìm thấy phim" });
    res.json(movie);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi lấy phim" });
  }
});

// Thêm phim mới
router.post("/", upload.single("poster"), async (req, res) => {
  try {
    const movieData = JSON.parse(req.body.data); 
    const posterUrl = req.file ? `uploads/${req.file.filename}` : null;
    movieData.poster = posterUrl;

    const newMovie = new Movie(movieData);
    await newMovie.save();

    res.status(201).json({ message: "Thêm phim thành công", movie: newMovie });
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi thêm phim", details: err.message });
  }
});

// Cập nhật phim theo ID
// PUT cập nhật phim
router.put('/:id', upload.single("poster"), async (req, res) => {
  try {
    const movieId = req.params.id;
    const parsedData = JSON.parse(req.body.data); // bạn cần parse lại JSON

    // Nếu có file mới thì thêm path ảnh mới
    if (req.file) {
      parsedData.poster = req.file.path; // hoặc req.file.filename nếu bạn lưu vậy
    }

    const updatedMovie = await Movie.findByIdAndUpdate(movieId, parsedData, {
      new: true,
    });

    if (!updatedMovie) {
      return res.status(404).json({ error: "Phim không tồn tại" });
    }

    res.json(updatedMovie);
  } catch (err) {
    console.error("Lỗi cập nhật phim:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});


// Xóa phim theo ID
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Movie.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Không tìm thấy phim để xóa" });
    res.json({ message: "Xóa phim thành công" });
  } catch (err) {
    res.status(400).json({ error: "Lỗi khi xóa phim", details: err.message });
  }
});

module.exports = router;
