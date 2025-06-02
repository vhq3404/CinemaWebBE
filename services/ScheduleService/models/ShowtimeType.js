const mongoose = require("mongoose");

const showtimeTypeSchema = new mongoose.Schema(
  {
    format: {
      type: String,
      required: true,
      enum: ["2D", "3D", "IMAX"],
    },
    audioType: {
      type: String,
      required: true,
      enum: ["Lồng tiếng", "Phụ đề"],
    },
  },
  {
    timestamps: true,
  }
);

const ShowtimeType = mongoose.model("ShowtimeType", showtimeTypeSchema);
module.exports = ShowtimeType;
