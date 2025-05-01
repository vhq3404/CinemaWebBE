const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const cors = require('cors');
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ex: postgres://user:password@localhost:5432/yourdb
});

// Đăng ký
app.post('/api/signup', async (req, res) => {
  const { name, email, phone, gender, birthdate, password, role } = req.body;

  // Đảm bảo role mặc định là 'user'
  const finalRole = role || 'user';  // Nếu role không được cung cấp, mặc định là 'user'

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users(name, email, phone, gender, birthdate, password, role) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, email, phone, gender, birthdate, hashedPassword, finalRole]
    );
    res.status(201).json({ message: 'Signup successfully', userId: result.rows[0].id });
  } catch (error) {
    if (error.code === '23505') {
      if (error.detail.includes('email')) {
        return res.status(400).json({ error: 'Email đã được sử dụng.' });
      } else if (error.detail.includes('phone')) {
        return res.status(400).json({ error: 'Số điện thoại đã được sử dụng.' });
      }
    }
    res.status(500).json({ error: 'Đăng ký thất bại. Vui lòng thử lại.' });
    
  }
});

// Đăng nhập
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Email không tồn tại!' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Sai mật khẩu!' });

    // Tạo token với thông tin userId và role
    const token = jwt.sign(
      { userId: user.id, role: user.role }, // Thêm thông tin role vào payload
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '1h' }
    );
    res.json({ 
      message: 'Login successfully', 
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        birthdate: user.birthdate,
        role: user.role,
      }, });
  } catch (error) {
    res.status(500).json({ error: 'Error: ' + error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`UserService server is running on port ${PORT}`));
