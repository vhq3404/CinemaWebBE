const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["bắp", "nước", "combo"], // chỉ chấp nhận 3 giá trị này
  },
  items: [
    {
      name: { type: String, required: true },
      quantity: { type: Number, default: 1 },
    }
  ],
  imageUrl: {
    type: String,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('Food', foodSchema);
