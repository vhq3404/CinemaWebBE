const mongoose = require('mongoose');

const showtimeSchema = new mongoose.Schema({
  movie: {
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    title: {
      type: String, // Tên phim
      required: true
    },
    duration: {
      type: Number, 
      required: true
    }
  },
  theater: {
    theaterId: {
      type: Number, // ID từ PostgreSQL
      required: true
    },
    theaterName: {
      type: String, // Tên rạp
      required: true
    }
  },
  room: {
    roomId: {
      type: Number, // ID từ PostgreSQL
      required: true
    },
    roomName: {
      type: String, // Tên phòng chiếu
      required: true
    }
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  date: {
    type: Date,
    required: true
  }
}, {
  timestamps: true // tự động thêm createdAt và updatedAt
});

const Showtime = mongoose.model('Showtime', showtimeSchema);
module.exports = Showtime;
