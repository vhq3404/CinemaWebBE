// models/Discount.js
const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    description: String,
    discountType: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discountValue: { type: Number, required: true },
    maxDiscount: Number,
    minOrderValue: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    usageLimit: { type: Number, default: 1 },
    usageCount: { type: Number, default: 0 },
    movieIds: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Discount", discountSchema);
