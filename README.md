# CBT App — Computer Based Test

Aplikasi CBT berbasis arsitektur REST API Monolitik Tiga-Lapis (Express + MySQL + Vanilla JS Mini-SPA). Database pakai MySQL (biasanya lewat XAMPP untuk kemudahan lokal).

> **Lanjut kerja di project ini di chat/sesi baru?** Baca urutan: `HANDOFF.md` → `CONTEXT.md` → `PLAN.md` → `architecture.md` → `SECURITY.md`, sebelum baca detail cara jalanin di bawah ini.

> ⚠️ **Sudah di-deploy publik?** Baca `SECURITY.md` — ada checklist hardening (CORS, rate limiting, konfigurasi MySQL, dll) yang wajib dicek sebelum/selama aplikasi diakses dari internet, bukan cuma jaringan lokal.

## Cara Menjalankan (XAMPP)

1. **Nyalakan MySQL** di XAMPP Control Panel (modul Apache tidak wajib, server Node.js sendiri yang menyajikan frontend).
2. **Install dependency**
   ```
   npm install
   ```
3. **Siapkan file environment**
   ```
   cp .env.example .env
   ```
   Sesuaikan `DB_PASSWORD` jika root MySQL XAMPP-mu memakai password (default XAMPP biasanya kosong).

   **Setup email OTP (wajib untuk fitur verifikasi registrasi):**
   - Aktifkan **2-Step Verification** di akun Gmail yang akan dipakai mengirim OTP.
   - Buat **App Password**: Google Account → Security → 2-Step Verification → App Passwords → generate (16 digit).
   - Isi di `.env`:
     ```
     EMAIL_USER=akun_pengirim@gmail.com
     EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
     OTP_EXPIRES_MINUTES=10
     OTP_RESEND_COOLDOWN_MINUTES=3
     ```

   **Setup CORS (wajib kalau diakses publik, bukan cuma localhost):**
   ```
   ALLOWED_ORIGINS=https://domain-frontend-kamu.com
   ```
   Isi dengan alamat yang muncul di address bar browser saat buka website-nya (boleh lebih dari satu, dipisah koma). Kalau dikosongkan, server fallback ke izinkan semua origin (`*`) dan mencetak warning jelas di log — **jangan biarkan kosong kalau sudah live/publish**. Lihat `SECURITY.md`.
4. **Migrasi database** (otomatis membuat database `cbt_jokey_3` beserta seluruh tabel; aman dijalankan berkali-kali/idempotent untuk upgrade skema lama)
   ```
   npm run migrate
   ```
5. **Seed data awal** (role Admin/Guru/Siswa + 1 akun Admin default)
   ```
   npm run seed
   ```
6. **Jalankan server**
   ```
   npm start
   ```
   Buka `http://localhost:3100` di browser.

## Akun Default (dari `npm run seed`)

**Admin:**
Sesuai `.env` (`DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD`), default:
- Username: `admin`
- Password: `admin123`

**Pengelola Soal:**
Sesuai `.env` (`DEFAULT_PENGELOLA_USERNAME` / `DEFAULT_PENGELOLA_EMAIL` / `DEFAULT_PENGELOLA_PASSWORD`), default:
- Username: `pengelola`
- Email: `pengelola@test.dev`
- Password: `pengelola123`

**Segera ganti password ini setelah login pertama kali** (lewat halaman Profil, atau langsung lewat database kalau fitur ganti password belum ada).

## Alur Pemakaian

1. Login sebagai Admin (akun default), buat **minimal satu Mata Pelajaran** di dashboard Admin.
2. Daftar akun Guru dan Siswa lewat halaman `#register` menggunakan **email @gmail.com** (wajib):
   - Sistem mengirim **kode OTP 6 digit** ke email tersebut, berlaku **10 menit**.
   - Calon user memasukkan OTP di halaman verifikasi. Bisa **kirim ulang OTP** setelah **3 menit** jika belum masuk/kedaluwarsa.
   - Setelah OTP benar, akun berpindah status `unverified` → `pending`, dan baru muncul di antrian approval Admin.
   - Admin **menyetujui (approve)** akun dari dashboard Admin. Login hanya bisa dilakukan setelah status `approved`.
3. Login sebagai Guru → buat ujian baru (isi **Nilai Minimal Lulus**) → tambah soal ke **Bank Soal** (pilih mata pelajaran & tingkat kesulitan, hingga 5 opsi jawaban A-E, gambar soal opsional) yang otomatis terhubung ke ujian itu, **atau** ambil soal yang sudah ada di Bank Soal (termasuk buatan guru lain) untuk dipakai ulang. Guru hanya bisa mengedit/menghapus soal buatannya sendiri.
4. **Akun "Pengelola Soal"** (dibuat Admin lewat menu Tambah Pengguna) punya dashboard sendiri khusus kelola Bank Soal, dengan akses ke **seluruh** soal dari semua guru (bukan cuma miliknya).
5. Login sebagai Siswa → kerjakan ujian. Jika nilai di bawah passing grade, tombol berubah jadi **"Ulangi Ujian (Remedial)"**.
6. Guru bisa memantau nilai tertinggi & **jumlah percobaan (attempt count)** tiap siswa di menu "Nilai" pada setiap ujian.
7. Guru & Siswa bisa update profil (nama, dan khusus Guru: data diri + foto profil) kapan saja lewat halaman **Profil** (klik nama di header/dropdown avatar) — terpisah dari form onboarding awal saat sign up.

## Struktur Folder

```
backend/
  config/           -> koneksi MySQL (connection pool)
  controllers/      -> HTTP layer (req/res)
  services/         -> business logic (remedial, scoring, approval, OTP, email, Bank Soal)
  repositories/     -> query SQL murni (parameterized, anti SQL Injection)
  middlewares/      -> JWT auth guard, role guard, rate limiter, error handler
  routes/           -> definisi endpoint REST
  database/         -> migrate.js & seed.js
  utils/            -> AppError, asyncHandler, generator OTP
  server.js         -> entry point (CORS, rate limiting, trust proxy)
frontend/
  index.html        -> Shell HTML (Tailwind CDN)
  js/
    main.js         -> bootstrap app
    core/           -> api.js, router.js, store.js (sesi login), dom.js, utils.js
    layout/         -> shell.js (navbar/layout per role)
    views/          -> auth.js, admin.js, guru.js, siswa.js, pengelolaSoal.js, profile.js
```

Detail lengkap tiap file ada di `architecture.md`.

## Status Akun

Alur status akun (kolom `users.status`):

```
unverified --(verifikasi OTP email)--> pending --(admin approve)--> approved
                                             \--(admin reject)-----> rejected
```

- `unverified`: baru daftar, belum verifikasi email, **tidak terlihat** di antrian approval Admin, tidak bisa login.
- `pending`: email sudah terverifikasi, menunggu keputusan Admin, tidak bisa login.
- `approved`: bisa login normal.
- `rejected`: ditolak Admin, tidak bisa login.

## Menghapus Akun (Admin)

Admin bisa hapus akun Guru/Siswa dari dashboard. Beberapa aturan menjaga integritas data:

- **Guru yang masih punya ujian tidak bisa dihapus** — sistem akan menolak dengan pesan jelas ("masih memiliki N ujian"). Hapus/alihkan ujian tersebut dulu.
- Menghapus **siswa**: seluruh riwayat attempt & jawaban miliknya ikut terhapus otomatis.
- Menghapus akun yang pernah **meng-assign ujian ke siswa** (`assigned_by`): assignment ke siswa tetap ada (siswa tidak kehilangan akses ujian), hanya info "siapa yang meng-assign" yang hilang.

## Upload File (Foto Profil & Gambar Soal)

- Foto profil guru dan gambar soal disimpan di `backend/uploads/` (dibuat otomatis, di-serve statis lewat `/uploads/...`) dan **tidak di-commit ke git** (lihat `.gitignore`).
- Dibatasi tipe gambar (JPEG/PNG/GIF/WebP) dan ukuran maksimal **5 MB** per file (lihat `backend/middlewares/uploadMiddleware.js`).
- File lama otomatis dihapus dari disk saat diganti atau saat soal/foto dihapus.

## Troubleshooting Email OTP

- **`Invalid login: 535-5.7.8 Username and Password not accepted`** → `EMAIL_APP_PASSWORD` salah. Ini harus **App Password** (16 digit dari Google Account → Security → App Passwords), bukan password akun Gmail biasa. 2-Step Verification wajib aktif dulu sebelum bisa bikin App Password. Restart server setelah mengubah `.env`.
- **Email tidak sampai di HP tapi status "OTP terkirim"** → cek folder **Spam**/**Promosi** di email penerima. Selama log server menampilkan `[emailService] OTP terkirim ... response=...` (artinya Gmail sudah menerima untuk dikirim), masalahnya di klasifikasi spam sisi penerima, bukan di server. Minta penerima klik **"Bukan spam"** sekali untuk mengoreksi.

## Yang Di-track di Git

Lihat `.gitignore` — hanya kode `backend/` & `frontend/`, `package.json`, `architecture.md`, `.env.example`, dan `README.md` ini yang di-commit. `node_modules/`, `.env` (kredensial asli), dan `package-lock.json` sengaja diabaikan.

## Keamanan

Ringkasan singkat — **detail lengkap & checklist berjalan ada di `SECURITY.md`**:

- CORS dibatasi lewat `.env` (`ALLOWED_ORIGINS`), bukan wildcard.
- Rate limiting terpasang: global di semua `/api`, lebih ketat khusus di endpoint auth (login/register/OTP) untuk cegah brute-force.
- Kalau deploy di belakang reverse proxy (Cloudflare Tunnel, nginx, dll), pastikan `app.set('trust proxy', ...)` di `backend/server.js` diset sesuai jumlah hop proxy — kalau salah, rate limiting jadi tidak akurat.
- Semua query database pakai parameterized query (`?` via `mysql2`) — aman dari SQL Injection.
- **Kalau pakai XAMPP**: pastikan `bind-address` MySQL dikunci ke `127.0.0.1` (bukan default yang kadang listen ke semua interface) dan password root **tidak boleh kosong**, apalagi kalau server bisa diakses dari internet.

## Catatan Teknis

- Password di-hash dengan `bcryptjs` (pure JS, tanpa kompilasi native — aman dipakai tanpa build tools tambahan, baik di Windows maupun Linux).
- Sesi login pakai JWT (`Authorization: Bearer <token>`), expiry diatur via `JWT_EXPIRES_IN` di `.env`.
- Jika port `3306` MySQL berbeda dari default, sesuaikan `DB_PORT` di `.env`.
- Email OTP dikirim lewat SMTP Gmail (`nodemailer`), pakai `EMAIL_USER` + `EMAIL_APP_PASSWORD` (App Password, bukan password akun biasa). Email calon user **wajib domain `@gmail.com`**.