/**
 * AppError
 * Error terstruktur dengan statusCode HTTP, dipakai di seluruh Service Layer
 * agar Controller Layer bisa langsung memetakan ke response yang tepat.
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = AppError;
