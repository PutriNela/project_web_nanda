/**
 * Error Handler Middleware
 * Middleware terakhir di chain Express. Menangkap semua error yang dilempar
 * dari Controller/Service (termasuk AppError) dan mengubahnya jadi response JSON konsisten.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : 'Terjadi kesalahan pada server.';

  if (!err.statusCode) {
    // Error tak terduga (bug, koneksi DB putus, dll) - log detail di server untuk debugging.
    console.error('[UNEXPECTED ERROR]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;
