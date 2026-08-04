/**
 * Auth Middleware
 * Memverifikasi JWT dari header Authorization: Bearer <token>.
 * Menyisipkan payload user (id, username, role) ke req.user.
 */
const authService = require('../services/authService');
const AppError = require('../utils/AppError');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Token autentikasi tidak ditemukan.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = authService.verifyToken(token);
    req.user = payload; // { id, username, role }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
