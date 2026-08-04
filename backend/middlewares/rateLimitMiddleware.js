/**
 * Rate Limiter Middleware
 * Membatasi jumlah request untuk mencegah brute-force, credential stuffing,
 * dan penyalahgunaan endpoint (spam register/OTP).
 *
 * - globalApiLimiter : dipasang di semua route /api. KEY-nya per USER LOGIN (dari JWT) kalau ada,
 *                      fallback ke per-IP kalau belum login. Lihat alasan di bawah.
 * - authLimiter       : dipasang khusus di /api/auth/*, batas ketat, SELALU per-IP (belum ada user
 *                        login di titik ini, jadi IP satu-satunya identitas yang bisa dipakai —
 *                        dan endpoint ini memang target utama brute-force & spam).
 *
 * Kenapa globalApiLimiter tidak murni per-IP?
 * - App ini dipakai di lingkungan sekolah: banyak siswa bisa berada di WiFi/NAT yang sama,
 *   sehingga keluar sebagai SATU IP publik yang sama ke server. Kalau limit dihitung murni per-IP,
 *   satu kelas ramai bisa saling "menghabiskan jatah" satu sama lain secara tidak sengaja.
 * - Aksi wajar yang butuh banyak request (autosave tiap jawaban saat mengerjakan ujian panjang,
 *   input soal beruntun ke Bank Soal) bisa gampang kena limit kalau baru dihitung dari 1 IP kelas.
 * - Solusi: begitu user sudah login (kirim token JWT valid), request-nya dihitung berdasarkan
 *   ID akun, bukan IP. Ini lebih adil (tiap akun dapat jatah sendiri, tidak "diserobot" akun lain
 *   di IP yang sama) dan tetap aman (akun yang disalahgunakan/dibajak tetap kena limit per akun).
 * - Endpoint SEBELUM login (login/register/OTP) TETAP per-IP karena di situ memang belum ada
 *   identitas user yang bisa dipercaya — itu justru titik paling rawan brute-force.
 */
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');

// Response seragam dalam Bahasa Indonesia, konsisten dengan format response lain di app ini.
function rateLimitHandler(req, res) {
  res.status(429).json({
    success: false,
    message: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat lagi.',
  });
}

// Mencoba baca IP "terbaik" yang tersedia — konsisten dengan requestLoggerMiddleware.js
// (CF-Connecting-IP lebih dipercaya daripada req.ip kalau tersedia).
function resolveIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip || req.connection?.remoteAddress || 'unknown';
}

// Key generator utama untuk globalApiLimiter:
// - Kalau ada token JWT valid di header -> key = `user:<id>` (limit per akun).
// - Kalau tidak ada / token invalid / belum login -> key = IP (limit per IP, seperti biasa).
// Catatan: verifikasi token di sini SENGAJA dibungkus try/catch dan tidak melempar error kalau
// gagal — rate limiter bukan tempatnya menolak token invalid, itu tugas authMiddleware di route
// yang memang butuh login. Di sini token invalid cukup dianggap "belum diketahui usernya".
function resolveRateLimitKey(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = authService.verifyToken(token);
      return `user:${payload.id}`;
    } catch (err) {
      // Token invalid/expired -> fallback ke IP, biarkan authMiddleware di route yang menolak.
    }
  }
  return `ip:${resolveIp(req)}`;
}

// Batas umum: 300 request / 15 menit per KEY (user login kalau ada, IP kalau belum login),
// berlaku untuk seluruh endpoint /api.
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true, // kirim header RateLimit-* ke klien
  legacyHeaders: false,
  keyGenerator: resolveRateLimitKey,
  handler: rateLimitHandler,
});

// Batas ketat khusus endpoint auth (login, register, verify-otp, resend-otp):
// 10 percobaan / 15 menit per IP — cukup untuk pemakaian wajar, tapi menghentikan brute-force.
// SELALU per-IP (bukan per-user) karena di titik ini user belum tentu berhasil login/punya token.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip:${resolveIp(req)}`,
  handler: rateLimitHandler,
  // Percobaan login yang GAGAL & SUKSES tetap dihitung dua-duanya secara default,
  // ini disengaja: kalau hanya menghitung yang gagal, penyerang brute-force dengan
  // password yang kadang "sukses" (mis. re-use across accounts) bisa lolos dari limit.
});

module.exports = { globalApiLimiter, authLimiter };