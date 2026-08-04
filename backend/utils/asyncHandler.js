/**
 * asyncHandler
 * Membungkus controller async agar setiap Promise rejection otomatis
 * diteruskan ke Express error handler (next(err)) tanpa try/catch berulang.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
