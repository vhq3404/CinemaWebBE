const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const checkAuth = require("./middleware/authMiddleware");
const { checkAdmin } = require("./middleware/roleMiddleware");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");

require("dotenv").config();
const otpStore = new Map();
const app = express();
const cors = require("cors");
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
// Tạo transporter dùng SMTP Gmail (thay bằng thông tin email và pass của bạn)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // email gửi đi
    pass: process.env.EMAIL_PASS, // mật khẩu app password hoặc mật khẩu email
  },
});

// Hàm gửi mail
async function sendEmail(to, subject, text) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent to:", to);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
// Đăng ký
app.post("/api/signup", async (req, res) => {
  const { name, email, phone, gender, birthdate, password, role } = req.body;

  // Đảm bảo role mặc định là 'user'
  const finalRole = role || "user"; // Nếu role không được cung cấp, mặc định là 'user'

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users(name, email, phone, gender, birthdate, password, role) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [name, email, phone, gender, birthdate, hashedPassword, finalRole]
    );
    res
      .status(201)
      .json({ message: "Signup successfully", userId: result.rows[0].id });
  } catch (error) {
    if (error.code === "23505") {
      if (error.detail.includes("email")) {
        return res.status(400).json({ error: "Email đã được sử dụng." });
      } else if (error.detail.includes("phone")) {
        return res
          .status(400)
          .json({ error: "Số điện thoại đã được sử dụng." });
      }
    }
    res.status(500).json({ error: "Đăng ký thất bại. Vui lòng thử lại." });
  }
});

// Đăng nhập
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Email không tồn tại!" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Sai mật khẩu!" });

    // Tạo token với thông tin userId và role
    const token = jwt.sign(
      { userId: user.id, role: user.role }, // Thêm thông tin role vào payload
      process.env.JWT_SECRET || "secret",
      { expiresIn: "24h" }
    );
    res.json({
      message: "Login successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        birthdate: user.birthdate,
        role: user.role,
        points: user.points,
        workplace: user.workplace || '',
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error: " + error.message });
  }
});

// Lấy tất cả user với role là "user"
app.get("/api/users", checkAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, gender, birthdate, role, points, rank
       FROM users
       WHERE role = 'user'
       ORDER BY id ASC`
    );

    res.json(result.rows);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi server khi lấy danh sách user: " + error.message });
  }
});

// Lấy thông tin user theo id
app.get("/api/users/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    const result = await pool.query(
      "SELECT id, name, email, phone, gender, birthdate, role, points, rank FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server: " + error.message });
  }
});

// Cập nhật thông tin user
app.put("/api/users/:id", checkAuth, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { name, email, phone, gender, birthdate } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET name = $1, email = $2, phone = $3, gender = $4, birthdate = $5 
       WHERE id = $6 
       RETURNING id, name, email, phone, gender, birthdate, role, points, rank`,
      [name, email, phone, gender, birthdate, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    res.json({
      message: "Cập nhật thông tin người dùng thành công.",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      if (error.detail.includes("email")) {
        return res.status(400).json({ error: "Email đã được sử dụng." });
      } else if (error.detail.includes("phone")) {
        return res
          .status(400)
          .json({ error: "Số điện thoại đã được sử dụng." });
      }
    }
    res.status(500).json({ error: "Lỗi khi cập nhật: " + error.message });
  }
});

// Đổi mật khẩu
app.put("/api/users/:id/change-password", checkAuth, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { oldPassword, newPassword } = req.body;

  // Kiểm tra userId trong token có quyền thay đổi mật khẩu user này
  // (bạn có thể bổ sung check role nếu cần)
  if (req.user.userId !== userId) {
    return res
      .status(403)
      .json({ error: "Bạn không có quyền thay đổi mật khẩu này." });
  }

  try {
    // Lấy user trong DB
    const result = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    const user = result.rows[0];

    // So sánh mật khẩu cũ
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.status(400).json({ error: "Mật khẩu cũ không đúng." });
    }

    // Mã hóa mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu mới vào DB
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedNewPassword,
      userId,
    ]);

    res.json({ message: "Đổi mật khẩu thành công." });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server: " + error.message });
  }
});

app.post("/api/forgot-password/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email là bắt buộc." });

  try {
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Email không tồn tại." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    // Gửi mail OTP thật
    const subject = "Mã OTP đặt lại mật khẩu của bạn";
    const text = `Mã OTP của bạn là: ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu, vui lòng bỏ qua email này.`;

    await sendEmail(email, subject, text);

    res.json({ message: "OTP đã được gửi đến email." });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi gửi OTP: " + error.message });
  }
});
// Xác thực OTP (kiểm tra mã OTP gửi đến email)
app.post("/api/forgot-password/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ error: "Email và OTP là bắt buộc." });

  const record = otpStore.get(email);
  if (!record)
    return res.status(400).json({ error: "OTP không hợp lệ hoặc đã hết hạn." });

  if (record.expiresAt < Date.now()) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP đã hết hạn." });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: "OTP không chính xác." });
  }

  // Xác thực thành công, có thể cho phép đổi mật khẩu
  res.json({ message: "Xác thực OTP thành công." });
});

// Đặt lại mật khẩu mới
app.post("/api/forgot-password/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res
      .status(400)
      .json({ error: "Email, OTP và mật khẩu mới là bắt buộc." });
  }

  const record = otpStore.get(email);
  if (!record)
    return res.status(400).json({ error: "OTP không hợp lệ hoặc đã hết hạn." });

  if (record.expiresAt < Date.now()) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP đã hết hạn." });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: "OTP không chính xác." });
  }

  try {
    // Kiểm tra user có tồn tại
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Email không tồn tại." });
    }

    // Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu mới vào DB
    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [
      hashedPassword,
      email,
    ]);

    // Xóa OTP khỏi store
    otpStore.delete(email);

    res.json({ message: "Đặt lại mật khẩu thành công." });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi server khi cập nhật mật khẩu: " + error.message });
  }
});

app.post("/api/employees", checkAuth, checkAdmin, async (req, res) => {
  const {
    name,
    email,
    phone,
    gender,
    birthdate,
    password,
    role,
    identity_card,
    workplace,
  } = req.body;

  if (role !== "employee") {
    return res
      .status(400)
      .json({ error: "Chỉ được tạo tài khoản với role là employee" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, gender, birthdate, password, role, identity_card, workplace)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, phone, gender, birthdate, role, identity_card, workplace`,
      [
        name,
        email,
        phone,
        gender,
        birthdate,
        hashedPassword,
        role,
        identity_card,
        workplace,
      ]
    );

    res
      .status(201)
      .json({ message: "Tạo nhân viên thành công", employee: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      if (error.detail.includes("email")) {
        return res.status(400).json({ error: "Email đã được sử dụng." });
      } else if (error.detail.includes("phone")) {
        return res
          .status(400)
          .json({ error: "Số điện thoại đã được sử dụng." });
      }
    }
    res
      .status(500)
      .json({ error: "Lỗi server khi tạo nhân viên: " + error.message });
  }
});

app.put("/api/employees/:id", checkAuth, checkAdmin, async (req, res) => {
  const employeeId = parseInt(req.params.id);
  const { name, email, phone, gender, birthdate, identity_card, workplace } =
    req.body;

  try {
    const result = await pool.query(
      `UPDATE users SET name=$1, email=$2, phone=$3, gender=$4, birthdate=$5, identity_card=$6, workplace=$7
       WHERE id=$8 AND role='employee'
       RETURNING id, name, email, phone, gender, birthdate, role, identity_card, workplace`,
      [
        name,
        email,
        phone,
        gender,
        birthdate,
        identity_card,
        workplace,
        employeeId,
      ]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Nhân viên không tồn tại hoặc không phải nhân viên" });
    }

    res.json({
      message: "Cập nhật nhân viên thành công",
      employee: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      if (error.detail.includes("email")) {
        return res.status(400).json({ error: "Email đã được sử dụng." });
      } else if (error.detail.includes("phone")) {
        return res
          .status(400)
          .json({ error: "Số điện thoại đã được sử dụng." });
      }
    }
    res
      .status(500)
      .json({ error: "Lỗi server khi cập nhật nhân viên: " + error.message });
  }
});

app.delete("/api/employees/:id", checkAuth, checkAdmin, async (req, res) => {
  const employeeId = parseInt(req.params.id);

  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 AND role = 'employee'",
      [employeeId]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Nhân viên không tồn tại hoặc không phải nhân viên" });
    }

    res.json({ message: "Xóa nhân viên thành công" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi server khi xóa nhân viên: " + error.message });
  }
});

// Lấy danh sách nhân viên (users có role = 'employee')
app.get("/api/employees", checkAuth, checkAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, phone, gender, birthdate, role, identity_card, workplace FROM users WHERE role = 'employee' ORDER BY id"
    );
    res.json({ employees: result.rows });
  } catch (error) {
    res.status(500).json({
      error: "Lỗi server khi lấy danh sách nhân viên: " + error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`UserService server is running on port ${PORT}`)
);
