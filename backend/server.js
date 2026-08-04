require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes            = require('./routes/authRoutes');
const userRoutes            = require('./routes/userRoutes');
const examRoutes            = require('./routes/examRoutes');
const attemptRoutes         = require('./routes/attemptRoutes');
const assignmentRoutes      = require('./routes/assignmentRoutes');
const teacherProfileRoutes  = require('./routes/teacherProfileRoutes');
const studentProfileRoutes  = require('./routes/studentProfileRoutes');
const errorHandler          = require('./middlewares/errorHandler');
const { globalApiLimiter }  = require('./middlewares/rateLimitMiddleware');
const requestLogger         = require('./middlewares/requestLoggerMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Access logging ----
// Dipasang PALING AWAL (sebelum static file & semua route) supaya benar-benar mencatat SEMUA
// request yang masuk — termasuk request ke file statis/frontend, bukan cuma /api.
// Mencatat ke console DAN ke file backend/logs/access.log (format JSONL: satu objek JSON per baris).
// Berguna untuk investigasi traffic mencurigakan (mis. banyak visitor padahal belum dipromosikan
// ke mana pun) — lihat IP, User-Agent, path yang diakses, dan status code tiap request.
app.use(requestLogger);

// PENTING: server ini diakses lewat Cloudflare Tunnel (cloudflared), jadi Express perlu tahu
// bahwa ia berada di belakang 1 lapis reverse proxy tepercaya. Tanpa ini, req.ip / rate limiter
// akan membaca IP dari cloudflared (selalu sama untuk semua orang), BUKAN IP pengunjung asli,
// sehingga rate limiting per-IP jadi tidak akurat (bisa gagal membatasi, atau salah membatasi semua
// orang sekaligus).
// "1" berarti percayai TEPAT SATU hop di depan Express (yaitu cloudflared) untuk header
// X-Forwarded-For. Ini aman SELAMA port Express tidak ikut ter-expose langsung ke internet
// (mis. lewat port forwarding router) — kalau itu terjadi, siapa pun bisa memalsukan header
// X-Forwarded-For dan membypass rate limiting. Pastikan hanya cloudflared yang bisa mencapai
// port Express ini (default perilaku cloudflared: tidak perlu buka port apa pun di router/firewall).
app.set('trust proxy', 1);

// ---- CORS: batasi hanya ke origin frontend sendiri (bukan wildcard "*") ----
// Isi ALLOWED_ORIGINS di .env dengan alamat FE kamu (yang muncul di address bar browser saat
// buka websitenya), boleh lebih dari satu dipisah koma, contoh:
//   ALLOWED_ORIGINS=https://cbtku.my.id,https://staging.cbtku.my.id
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn(
    '[CORS] ALLOWED_ORIGINS belum diisi di .env — sementara mengizinkan SEMUA origin (*). ' +
    'Ini TIDAK aman untuk production. Isi ALLOWED_ORIGINS dengan alamat FE kamu di .env lalu restart server.'
  );
}

app.use(cors({
  origin: allowedOrigins.length === 0 ? true : allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sajikan frontend Mini-SPA (Vanilla JS) secara statis
app.use(express.static(path.join(__dirname, '../frontend')));

// Sajikan file upload (foto profil, gambar soal) sebagai static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Healthcheck (didaftarkan sebelum router lain agar tidak ikut tertahan authMiddleware)
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'CBT App API berjalan normal.' });
});

// ---- API Routes ----
app.use('/api', globalApiLimiter); // batas umum: 300 request/15 menit per IP untuk semua endpoint /api
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api', examRoutes);            // /api/subjects, /api/exams, /api/questions/:id
app.use('/api', attemptRoutes);         // /api/student/exams, /api/attempts/:id/...
app.use('/api', assignmentRoutes);      // /api/teachers/:id/students, /api/exams/:id/assignments
app.use('/api', teacherProfileRoutes);  // /api/profile/me, /api/profile/requests
app.use('/api', studentProfileRoutes);  // /api/student/profile/me

// Fallback ke index.html untuk mendukung hash routing Mini-SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler harus didaftarkan paling akhir
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`CBT App server berjalan di http://localhost:${PORT}`);
});