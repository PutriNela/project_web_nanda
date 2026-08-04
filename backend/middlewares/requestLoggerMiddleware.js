// requestLoggerMiddleware.js
//
// Mencatat SETIAP request yang masuk (termasuk file statis & /api) ke:
//   1. Console (biar kelihatan langsung di `npm start` / journalctl / pm2 logs)
//   2. File di backend/logs/access.log (format JSON per baris / JSONL, gampang di-parse nanti
//      kalau mau dibuatkan "watcher page")
//
// Kenapa JSONL (satu objek JSON per baris), bukan teks bebas?
// - Gampang di-grep manual (`grep '"status":429' access.log`)
// - Gampang diparse programatis nanti kalau dibuatkan halaman/endpoint "watcher" untuk baca log
//   tanpa perlu regex teks bebas yang rapuh.
//
// Kenapa IP diambil dari beberapa sumber (bukan cuma req.ip)?
// - Server ini di belakang Cloudflare Tunnel. `req.ip` sudah benar SELAMA
//   `app.set('trust proxy', 1)` terpasang (lihat server.js) — itu baca dari X-Forwarded-For yang
//   diisi oleh cloudflared.
// - Tapi Cloudflare juga mengirim header `CF-Connecting-IP` yang isinya IP asli pengunjung,
//   independen dari X-Forwarded-For. Kita catat KEDUANYA supaya ada cross-check: kalau suatu saat
//   nilainya beda/aneh, itu sinyal ada yang salah konfigurasi (atau ada yang coba spoof header).
//
// Geolokasi (negara/kota/region/lat-long perkiraan):
// - Diambil dari header `CF-IPCountry`, `CF-IPCity`, `CF-Region`, `CF-IPLatitude`, `CF-IPLongitude`
//   yang dikirim Cloudflare KALAU fitur "Add visitor location headers" diaktifkan di dashboard
//   Cloudflare (domain > Rules > Managed Transforms > aktifkan "Add visitor location headers").
//   Tanpa fitur itu aktif, cuma CF-IPCountry yang biasanya terisi, sisanya null.
// - Ini perkiraan dari database geolokasi Cloudflare (berbasis alokasi IP), BUKAN GPS asli —
//   akurasi bervariasi, biasanya benar sampai kota/wilayah besar, bukan alamat presisi.
//
// Identitas pengguna APLIKASI INI (bukan identitas pribadi pengunjung anonim dari luar):
// - Kalau request disertai token JWT valid (Authorization: Bearer ...), `authMiddleware` sudah
//   mengisi `req.user = { id, username, role }` sebelum response selesai dikirim. Logger membaca
//   itu untuk mencatat SIAPA (user CBT App yang sudah login) yang melakukan request. Ini cuma
//   berlaku untuk user yang login ke aplikasi ini sendiri — TIDAK BISA mengungkap nama akun Google
//   atau username OS pengunjung anonim, karena data semacam itu memang tidak pernah dikirim
//   browser lewat HTTP request ke server mana pun.

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'access.log');

// Pastikan folder logs/ ada (aman dipanggil berkali-kali)
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Status code yang dianggap "perlu perhatian" — dipisahkan biar gampang di-grep
// (`grep '"flagged":true'`) dan biar di console keliatan mencolok.
const FLAGGED_STATUS = new Set([401, 403, 404, 429]);

function requestLoggerMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  // Beberapa cara membaca "IP pengunjung", dicatat semua untuk cross-check:
  const cfConnectingIp = req.headers['cf-connecting-ip'] || null; // IP asli dari Cloudflare, paling dipercaya
  const xForwardedFor = req.headers['x-forwarded-for'] || null;   // rantai proxy (cloudflared, dst)
  const expressIp = req.ip || req.connection?.remoteAddress || null; // hasil interpretasi Express (setelah trust proxy)

  const userAgent = req.headers['user-agent'] || '(kosong)';

  // Header geolokasi dari Cloudflare (lihat catatan di atas file)
  const geo = {
    country: req.headers['cf-ipcountry'] || null,     // kode negara 2-huruf, mis. "ID"
    city: req.headers['cf-ipcity'] || null,
    region: req.headers['cf-region'] || null,
    latitude: req.headers['cf-iplatitude'] || null,
    longitude: req.headers['cf-iplongitude'] || null,
  };

  // Setelah response selesai dikirim, baru kita catat (supaya status code & durasi ikut tercatat)
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const flagged = FLAGGED_STATUS.has(res.statusCode);

    const entry = {
      time: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: cfConnectingIp || expressIp, // IP "terbaik" yang dipakai sebagai patokan utama
      ipSources: {
        cfConnectingIp,
        xForwardedFor,
        expressIp,
      },
      userAgent,
      geo, // perkiraan lokasi dari Cloudflare — null semua kalau fitur belum diaktifkan di dashboard
      // Siapa user CBT App ini yang melakukan request (HANYA kalau request pakai token JWT valid).
      // null kalau request belum login / token tidak ada / token invalid.
      appUser: req.user
        ? { id: req.user.id, username: req.user.username, role: req.user.role }
        : null,
      flagged, // true kalau status 401/403/404/429 — kandidat "aktivitas mencurigakan/gagal"
    };

    const line = JSON.stringify(entry) + '\n';

    // Tulis ke file (append, async, tidak memblokir request berikutnya)
    fs.appendFile(LOG_FILE, line, (err) => {
      if (err) {
        // Kalau gagal tulis log, jangan sampai bikin server crash — cukup laporkan ke console.
        console.error('[requestLogger] Gagal menulis ke access.log:', err.message);
      }
    });

    // Tampilkan juga ke console. Request yang "flagged" ditandai jelas biar gampang kelihatan
    // saat scroll log real-time (`npm start` atau `pm2 logs`).
    const marker = flagged ? '⚠️ ' : '';
    const geoLabel = geo.country ? `${geo.city || '?'}, ${geo.country}` : 'lokasi tidak diketahui';
    const userLabel = entry.appUser ? `user=${entry.appUser.username}(${entry.appUser.role})` : 'user=belum login';
    console.log(
      `${marker}[${entry.time}] ${entry.method} ${entry.path} -> ${entry.status} ` +
      `(${entry.durationMs}ms) ip=${entry.ip} [${geoLabel}] ${userLabel} ua="${userAgent}"`
    );
  });

  next();
}

module.exports = requestLoggerMiddleware;