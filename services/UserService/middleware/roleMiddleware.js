// middleware/roleMiddleware.js
const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' }); // Chỉ admin mới được truy cập
  }
  next(); // Tiến hành gọi middleware tiếp theo hoặc route handler
};

module.exports = checkAdmin;
