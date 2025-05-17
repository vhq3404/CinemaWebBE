const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { fetchRoomsByTheater } = require("../APIs/theaterAPI");
const { fetchMovieById } = require("../APIs/movieAPI");
const Showtime = require("../models/Showtime");

// Hàm làm tròn lên mốc 00, 15, 30, 45
function roundUpToQuarterHour(date) {
  const minutes = date.getMinutes();
  const remainder = minutes % 15;
  const adjustment = remainder === 0 ? 0 : 15 - remainder;

  date.setMinutes(minutes + adjustment);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}

router.post("/", async (req, res) => {
  const { theaterId, roomId, movieId, date, startTime } = req.body;

  if (!theaterId || !roomId || !movieId || !date || !startTime) {
    return res.status(400).json({
      error:
        "Thiếu thông tin bắt buộc (theaterId, roomId, movieId, date, startTime)",
    });
  }

  try {
    const movie = await fetchMovieById(movieId);
    if (!movie) {
      return res.status(400).json({ error: "Không tìm thấy thông tin phim" });
    }

    // Gọi sang TheaterService để xác thực room thuộc theater
    const rooms = await fetchRoomsByTheater(theaterId);
    const room = rooms.find((r) => r.id === roomId);

    if (!room) {
      return res
        .status(400)
        .json({ error: "Phòng không thuộc rạp này hoặc không tồn tại" });
    }

    // Tính thời gian bắt đầu
    const [hour, minute] = startTime.split(":").map(Number);
    const start = new Date(date);
    start.setHours(hour, minute, 0, 0);

    // Tính thời gian kết thúc: duration + 10 phút, rồi làm tròn
    const durationInMs = movie.duration * 60 * 1000;
    const rawEnd = new Date(start.getTime() + durationInMs);
    rawEnd.setMinutes(rawEnd.getMinutes() + 5);
    let end = roundUpToQuarterHour(rawEnd);

    // Giới hạn thời gian kết thúc không quá 02:00 hôm sau
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 1); // sang ngày hôm sau
    maxEnd.setHours(2, 0, 0, 0); // 02:00

    if (end > maxEnd) {
      end = new Date(maxEnd);
    }

    // Kiểm tra trùng lịch chiếu trong cùng phòng, cùng ngày
    const conflict = await Showtime.findOne({
      "room.roomId": roomId,
      date: new Date(date),
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
    });

    if (conflict) {
      return res.status(409).json({
        error:
          "Trùng lịch chiếu! Phòng này đã có suất chiếu trong khoảng thời gian này",
      });
    }

    // Tạo showtime và lưu vào MongoDB
    const newShowtime = new Showtime({
      movie: {
        movieId: movieId,
        title: movie.title,
        duration: movie.duration,
      },
      theater: {
        theaterId: theaterId,
        theaterName: room.name,
      },
      room: {
        roomId: roomId,
        roomName: room.room_name,
      },
      startTime: start,
      endTime: end,
      date: new Date(date),
    });

    await newShowtime.save();

    res.status(201).json({
      message: "Tạo suất chiếu thành công",
      showtime: newShowtime,
    });
  } catch (error) {
    console.error("Lỗi khi tạo suất chiếu:", error.message);
    res.status(500).json({ error: "Lỗi khi tạo suất chiếu" });
  }
});

// API để lấy danh sách suất chiếu
router.get("/", async (req, res) => {
  try {
    const { theaterId, roomId, date, movieId } = req.query;

    // Tạo query để tìm các suất chiếu theo các tiêu chí
    const query = {};

    if (theaterId) {
      query["theater.theaterId"] = theaterId; // tìm theo theaterId
    }

    if (roomId) {
      query["room.roomId"] = roomId; // tìm theo roomId
    }

    if (date) {
      query.date = new Date(date); // tìm theo ngày (nếu có)
    }

    if (movieId) {
      query["movie.movieId"] = movieId; // tìm theo movieId
    }

    // Tìm các suất chiếu trong MongoDB
    const showtimes = await Showtime.find(query).sort({ startTime: 1 }); // Sắp xếp theo thời gian bắt đầu

    if (showtimes.length === 0) {
      return res.status(404).json({ error: "Không có suất chiếu nào phù hợp" });
    }

    res.status(200).json({ showtimes });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin suất chiếu:", error.message);
    res.status(500).json({ error: "Lỗi khi lấy thông tin suất chiếu" });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await Showtime.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy suất chiếu để xoá" });
    }

    res.status(200).json({ message: "Xoá suất chiếu thành công" });
  } catch (error) {
    console.error("Lỗi khi xoá suất chiếu:", error.message);
    res.status(500).json({ error: "Lỗi server khi xoá suất chiếu" });
  }
});

module.exports = router;
