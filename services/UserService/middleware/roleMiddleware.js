// middleware/roleMiddleware.js

// Kiểm tra xem role hiện tại có nằm trong danh sách cho phép không
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: Không có quyền truy cập!" });
    }
    next();
  };
};

// Shortcut: chỉ cho admin
const checkAdmin = checkRole("admin");

// Shortcut: cho admin hoặc employee
const checkAdminOrEmployee = checkRole("admin", "employee");

module.exports = {
  checkRole,
  checkAdmin,
  checkAdminOrEmployee,
};
