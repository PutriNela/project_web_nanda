/**
 * Role Middleware
 * Membatasi akses route hanya untuk role tertentu.
 * Harus dipasang SETELAH authMiddleware (butuh req.user).
 * Pemakaian: roleMiddleware('Admin'), roleMiddleware('Guru', 'Admin'), dst.
 */
const AppError = require('../utils/AppError');

function roleMiddleware(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(new AppError('Anda belum login.', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Anda tidak memiliki izin untuk mengakses resource ini.', 403));
    }
    next();
  };
}

module.exports = roleMiddleware;
