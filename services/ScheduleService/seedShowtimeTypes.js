const mongoose = require("mongoose");
const dotenv = require("dotenv");
const ShowtimeType = require("./models/ShowtimeType");

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ Kết nối MongoDB Atlas thành công!");

    const showtimeTypes = [
      { format: "2D", audioType: "Phụ đề" },
      { format: "2D", audioType: "Lồng tiếng" },
      { format: "3D", audioType: "Phụ đề" },
      { format: "3D", audioType: "Lồng tiếng" },
      { format: "IMAX", audioType: "Phụ đề" },
      { format: "IMAX", audioType: "Lồng tiếng" },
    ];

    await ShowtimeType.deleteMany(); 
    const inserted = await ShowtimeType.insertMany(showtimeTypes);

    console.log("🎉 Đã seed dữ liệu showtime_types:");
    inserted.forEach((doc) => {
      console.log(
        `- ${doc.format} - ${doc.audioType} (subtitle: ${doc.subtitle})`
      );
    });

    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối:", err);
    process.exit(1);
  });
