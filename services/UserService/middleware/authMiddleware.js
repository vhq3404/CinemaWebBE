const jwt = require('jsonwebtoken');

const checkAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin người dùng vào request
    next(); // Tiến hành gọi middleware tiếp theo hoặc route handler
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = checkAuth;
