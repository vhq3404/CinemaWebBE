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
  const {
    theaterId,
    roomId,
    movieId,
    date,
    startTime,
    priceRegular,
    priceVIP,
    showtimeType,
  } = req.body;

  // Kiểm tra thiếu thông tin bắt buộc
  if (
    !theaterId ||
    !roomId ||
    !movieId ||
    !date ||
    !startTime ||
    priceRegular == null ||
    priceVIP == null ||
    !showtimeType
  ) {
    return res.status(400).json({
      error:
        "Thiếu thông tin bắt buộc (theaterId, roomId, movieId, date, startTime, priceRegular, priceVIP)",
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

    // Tính thời gian kết thúc: duration + 5 phút, rồi làm tròn
    const durationInMs = movie.duration * 60 * 1000;
    const rawEnd = new Date(start.getTime() + durationInMs + 5 * 60 * 1000);
    let end = roundUpToQuarterHour(rawEnd);

    // Giới hạn thời gian kết thúc không quá 02:00 hôm sau
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 1);
    maxEnd.setHours(2, 0, 0, 0);

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
      priceRegular: priceRegular,
      priceVIP: priceVIP,
      showtimeType: showtimeType,
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

router.post("/generate-showtimes", async (req, res) => {
  const {
    theaterId,
    movieId,
    startDate,
    endDate,
    showtimesPerDay = [],
    priceRegular,
    priceVIP,
    priceRegularWeekend,
    priceVIPWeekend,
    showtimeType,
  } = req.body;

  if (
    !theaterId ||
    !movieId ||
    !startDate ||
    !endDate ||
    showtimesPerDay.length === 0
  ) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
  }

  const session = await Showtime.startSession(); // Bắt đầu session
  session.startTransaction();

  try {
    const movie = await fetchMovieById(movieId);
    if (!movie) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Không tìm thấy phim" });
    }

    let rooms = await fetchRoomsByTheater(theaterId);
    if (!rooms || rooms.length === 0) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Không tìm thấy phòng" });
    }

    let expectedRoomType = null;
    if (showtimeType.includes("2D")) expectedRoomType = "2D";
    else if (showtimeType.includes("3D")) expectedRoomType = "3D";
    else if (showtimeType.includes("IMAX")) expectedRoomType = "IMAX";

    rooms = rooms.filter((room) => room.room_type === expectedRoomType);

    if (rooms.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        error: `Không có phòng phù hợp với định dạng ${showtimeType}`,
      });
    }

    const durationMs = (movie.duration + 5) * 60 * 1000;
    const createdShowtimes = [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);

      for (const timeStr of showtimesPerDay) {
        const [hour, minute] = timeStr.split(":").map(Number);
        const startTime = new Date(date);
        startTime.setHours(hour, minute, 0, 0);

        const rawEnd = new Date(startTime.getTime() + durationMs);
        const endTime = roundUpToQuarterHour(rawEnd);

        // Lấy thứ trong tuần theo giờ VN (0: Chủ nhật, 6: Thứ 7)
        const vnDay = new Date(
          startTime.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
        ).getDay();
        const isWeekend = vnDay === 0 || vnDay === 6;

        const finalPriceRegular =
          isWeekend && priceRegularWeekend ? priceRegularWeekend : priceRegular;
        const finalPriceVIP =
          isWeekend && priceVIPWeekend ? priceVIPWeekend : priceVIP;

        // Kiểm tra duplicate
        const duplicate = await Showtime.findOne({
          "movie.movieId": movieId,
          showtimeType,
          date,
          startTime,
          "theater.theaterId": theaterId,
        });

        if (duplicate) {
          await session.abortTransaction();
          return res.status(409).json({
            error: `Suất ${timeStr} ngày ${
              date.toISOString().split("T")[0]
            } đã tồn tại.`,
          });
        }

        let added = false;

        for (const room of rooms) {
          const conflict = await Showtime.findOne({
            "room.roomId": room.id,
            date: date,
            startTime: { $lt: endTime },
            endTime: { $gt: startTime },
          });

          const isConflictInSession = createdShowtimes.some(
            (st) =>
              st.room.roomId === room.id &&
              st.date.toISOString().slice(0, 10) ===
                date.toISOString().slice(0, 10) &&
              !(endTime <= st.startTime || startTime >= st.endTime)
          );

          if (!conflict && !isConflictInSession) {
            const newShowtime = new Showtime({
              movie: {
                movieId,
                title: movie.title,
                duration: movie.duration,
              },
              theater: {
                theaterId,
                theaterName: room.name,
              },
              room: {
                roomId: room.id,
                roomName: room.room_name,
              },
              startTime,
              endTime,
              date: new Date(date),
              priceRegular: finalPriceRegular,
              priceVIP: finalPriceVIP,
              showtimeType,
            });

            await newShowtime.save({ session });
            createdShowtimes.push(newShowtime);
            added = true;
            break;
          }
        }

        if (!added) {
          await session.abortTransaction();
          return res.status(409).json({
            error: `Không thể thêm suất ${timeStr} ngày ${
              date.toISOString().split("T")[0]
            }: Không còn phòng trống phù hợp (${expectedRoomType})`,
          });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Tạo tất cả suất chiếu thành công",
      createdShowtimes,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Lỗi khi tạo suất chiếu:", error);
    return res.status(500).json({ error: "Lỗi hệ thống khi tạo suất chiếu" });
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

// Lấy thông tin chi tiết 1 suất chiếu theo ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const showtime = await Showtime.findById(id);

    if (!showtime) {
      return res.status(404).json({ error: "Không tìm thấy suất chiếu" });
    }

    res.status(200).json({ showtime });
  } catch (error) {
    console.error("Lỗi khi lấy suất chiếu:", error.message);
    res.status(500).json({ error: "Lỗi khi lấy thông tin suất chiếu" });
  }
});

router.patch("/update-prices", async (req, res) => {
  const { showtimeIds, priceRegular, priceVIP } = req.body;

  if (!Array.isArray(showtimeIds) || showtimeIds.length === 0) {
    return res.status(400).json({ error: "Danh sách suất chiếu không hợp lệ" });
  }

  if (priceRegular == null && priceVIP == null) {
    return res
      .status(400)
      .json({ error: "Cần cung cấp ít nhất một loại giá để cập nhật" });
  }

  try {
    const updateFields = {};
    if (priceRegular != null) updateFields.priceRegular = priceRegular;
    if (priceVIP != null) updateFields.priceVIP = priceVIP;

    const result = await Showtime.updateMany(
      { _id: { $in: showtimeIds } },
      { $set: updateFields }
    );

    res.status(200).json({
      message: "Cập nhật giá thành công",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật giá:", error);
    res.status(500).json({ error: "Lỗi server khi cập nhật giá" });
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
