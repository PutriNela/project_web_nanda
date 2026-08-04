# Arsitektur CBT App

Layered architecture (Controller → Service → Repository) di atas Express + MySQL,
dengan frontend mini-SPA vanilla JS (hash routing, tanpa build step).

```
CBT/
├── package.json
├── package-lock.json
├── .env.example                        # Template environment variable (isi asli ada di .env, tidak di-commit)
├── .gitignore
├── README.md
├── architecture.md                     # Dokumen ini
│
├── backend/
│   ├── server.js                       # Entry point Express (mount routes, static /uploads, error handler)
│   │
│   ├── uploads/                        # File hasil upload (foto profil, gambar soal) - runtime, di-gitignore
│   │   ├── profiles/
│   │   └── questions/
│   │
│   ├── config/
│   │   └── db.js                       # Koneksi MySQL (connection pool, mysql2)
│   │
│   ├── database/
│   │   ├── migrate.js                  # Bikin/upgrade skema tabel (idempotent, aman dijalankan berkali-kali)
│   │   └── seed.js                     # Seed role default (Admin/Guru/Siswa) + 1 akun Admin awal
│   │
│   ├── repositories/                   # === DATA ACCESS LAYER (query SQL parameterized) ===
│   │   ├── userRepository.js           # CRUD user, OTP (setOtp/markEmailVerified), findByEmail
│   │   ├── examRepository.js
│   │   ├── examQuestionRepository.js   # Pivot exam_questions (many-to-many Bank Soal <-> ujian)
│   │   ├── examAssignmentRepository.js # Assignment ujian -> siswa (siapa yang meng-assign, dsb.)
│   │   ├── questionRepository.js       # Bank Soal: findBank (filter subject/difficulty/teacher_id), + gambar soal
│   │   ├── attemptRepository.js
│   │   ├── subjectRepository.js
│   │   ├── teacherProfileRepository.js
│   │   ├── studentProfileRepository.js
│   │   └── teacherStudentRepository.js
│   │
│   ├── services/                       # === BUSINESS LOGIC LAYER ===
│   │   ├── authService.js              # register (kirim OTP), verifyOtp, resendOtp, login, approval guard
│   │   ├── emailService.js             # Kirim email OTP via SMTP Gmail (nodemailer)
│   │   ├── userService.js              # Approve/reject/delete user (+ guard FK: guru dgn ujian aktif)
│   │   ├── examService.js              # CRUD ujian & Bank Soal (createStandaloneQuestion, ensureQuestionAuthor + bypass utk role Pengelola Soal)
│   │   ├── assignmentService.js        # Assign ujian ke siswa
│   │   ├── attemptService.js           # Logic remedial, attempt counter, scoring
│   │   ├── teacherProfileService.js    # + updatePhoto/removePhoto (foto profil)
│   │   └── studentProfileService.js
│   │
│   ├── controllers/                    # === CONTROLLER LAYER (HTTP req/res) ===
│   │   ├── authController.js           # /auth/register, /auth/verify-otp, /auth/resend-otp, /auth/login
│   │   ├── userController.js
│   │   ├── examController.js           # + uploadQuestionImage/deleteQuestionImage
│   │   ├── assignmentController.js
│   │   ├── attemptController.js
│   │   ├── teacherProfileController.js # + uploadPhoto/removePhoto
│   │   └── studentProfileController.js
│   │
│   ├── middlewares/
│   │   ├── authMiddleware.js           # Verifikasi JWT
│   │   ├── roleMiddleware.js           # Guard per-role (Admin/Guru/Siswa)
│   │   ├── uploadMiddleware.js         # Multer: profileUpload (foto guru), questionUpload (gambar soal)
│   │   ├── rateLimitMiddleware.js      # globalApiLimiter (semua /api) + authLimiter (ketat, khusus /api/auth)
│   │   └── errorHandler.js             # Global error handler (AppError -> response JSON)
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── examRoutes.js
│   │   ├── assignmentRoutes.js
│   │   ├── attemptRoutes.js
│   │   ├── teacherProfileRoutes.js
│   │   └── studentProfileRoutes.js
│   │
│   └── utils/
│       ├── AppError.js                 # Custom error class (message + HTTP status)
│       ├── asyncHandler.js             # Wrapper try/catch untuk controller async
│       └── otp.js                      # Generator kode OTP 6 digit
│
└── frontend/
    ├── index.html                      # Shell HTML (Tailwind CDN, memuat js/main.js sebagai module)
    └── js/
        ├── main.js                     # Bootstrap app, cek sesi, mount router
        ├── core/
        │   ├── api.js                  # Wrapper fetch ke backend (+ apiUpload untuk multipart/file)
        │   ├── router.js               # Hash-based router (termasuk route berparameter, mis. #verify-otp/<username>)
        │   ├── store.js                # Sesi login (token + user) di localStorage
        │   ├── dom.js                  # Helper render/manipulasi DOM
        │   └── utils.js                # Helper umum (format, toast, dsb.)
        ├── layout/
        │   └── shell.js                # Layout umum (navbar/sidebar per role)
        └── views/
            ├── auth.js                 # Login, Register, Verifikasi OTP
            ├── admin.js                # Dashboard Admin (approval user, kelola subject)
            ├── guru.js                 # Dashboard Guru (ujian/soal + gambar soal, nilai siswa, foto profil)
            ├── siswa.js                # Dashboard Siswa (kerjakan ujian, lihat gambar soal & foto guru)
            ├── pengelolaSoal.js        # Dashboard Pengelola Soal (kelola SELURUH Bank Soal, semua guru)
            └── profile.js              # Onboarding profil (guru/siswa) + halaman #profile (update setelah onboarding)
```

## Alur Request (contoh: Guru membuat ujian)

```
frontend/js/views/guru.js
  -> api.js (POST /api/exams, attach JWT)
  -> backend/routes/examRoutes.js
  -> backend/middlewares/authMiddleware.js   (verifikasi token)
  -> backend/middlewares/roleMiddleware.js   (harus role Guru)
  -> backend/controllers/examController.js   (parse req.body)
  -> backend/services/examService.js         (validasi bisnis: passing grade, dst.)
  -> backend/repositories/examRepository.js  (INSERT ke MySQL)
```

## Autentikasi & Registrasi (dengan Verifikasi Email OTP)

Sejak fitur verifikasi email ditambahkan, registrasi tidak langsung membuat akun
`pending` seperti sebelumnya — ada tahap verifikasi OTP di antaranya:

```
1. POST /auth/register        (username, email @gmail.com, password, name, roleName)
     -> userRepository.create(status='unverified')
     -> generateOtp() + userRepository.setOtp(...)
     -> emailService.sendOtpEmail()   (SMTP Gmail, nodemailer)

2. POST /auth/verify-otp       (username, otp)
     -> cek kecocokan kode & belum expired (otp_expires_at, 10 menit)
     -> userRepository.markEmailVerified()   -> status: unverified -> pending

3. (Admin) approve/reject user pending, seperti alur sebelumnya
     -> status: pending -> approved / rejected

4. POST /auth/login   -> hanya berhasil kalau status === 'approved'
```

`POST /auth/resend-otp` mengirim ulang kode OTP baru, dibatasi cooldown 3 menit
sejak pengiriman terakhir (`otp_last_sent_at`), dicek di backend (bukan cuma UI)
supaya tidak bisa dibypass.

## Status Akun (kolom `users.status`)

```
unverified --(verifikasi OTP email)--> pending --(admin approve)--> approved
                                             \--(admin reject)-----> rejected
```

## Skema Database (MySQL, ringkas)

Tabel utama & relasi penting (lihat `backend/database/migrate.js` untuk DDL lengkap):

- **roles** — Admin / Guru / Siswa / **Pengelola Soal** (role independen, khusus Bank Soal, hanya dibuat oleh Admin)
- **users** — akun (username, email, password hash, role_id, status, kolom OTP:
  `otp_code`, `otp_expires_at`, `otp_last_sent_at`, `email_verified`)
- **subjects** — mata pelajaran (dibuat Admin)
- **exams** — ujian (dimiliki oleh `teacher_id`, punya `passing_grade`)
- **questions** — soal Bank Soal, **reusable lintas ujian** (bukan lagi 1 soal = 1 ujian). Kolom: `subject_id` (mapel soal, independen dari mapel ujian), `difficulty` (`Mudah`/`Sedang`/`Sulit`), `teacher_id` (penulis asli — bisa Guru atau Pengelola Soal), `image_url` (gambar soal, opsional)
- **exam_questions** — tabel **pivot many-to-many** antara `exams` <-> `questions` (menggantikan relasi one-to-many lama)
- **options** — opsi jawaban per soal, hingga 5 opsi (A-E), ditegakkan di service layer (bukan constraint DB — tabelnya generik)
- **exam_assignments** — penugasan ujian ke siswa (`student_id`, `assigned_by`)
- **exam_attempts** / **student_answers** — riwayat pengerjaan & jawaban siswa
- **teacher_profiles** / **student_profiles** — data profil tambahan (`teacher_profiles.photo_url` untuk foto profil, opsional — siswa **tidak** punya kolom foto, keputusan produk)
- **teacher_students** — relasi guru-siswa (mis. per kelas)

## Upload File (Foto Profil & Gambar Soal)

```
POST   /api/profile/photo           (Guru, multipart field: photo)   -> unggah/ganti foto profil
DELETE /api/profile/photo           (Guru)                           -> hapus foto profil
POST   /api/questions/:id/image     (Guru, multipart field: image)   -> unggah/ganti gambar soal
DELETE /api/questions/:id/image     (Guru)                           -> hapus gambar soal
```

- Ditangani `backend/middlewares/uploadMiddleware.js` (Multer): validasi tipe file (JPEG/PNG/GIF/WebP) & ukuran maks 5MB, simpan ke `backend/uploads/profiles/` atau `backend/uploads/questions/`.
- File disajikan statis lewat `express.static` di `backend/server.js` (prefix `/uploads`).
- Saat foto/gambar diganti atau dihapus, file lama di disk otomatis dibersihkan (`deleteFileIfExists` di masing-masing service).
- Folder `backend/uploads/` di-gitignore (runtime data, bukan kode) — pastikan folder ini ada saat deploy (dibuat otomatis oleh `uploadMiddleware.js` jika belum ada).

### Kebijakan FK saat user dihapus (hard delete)

Supaya hapus akun tidak gagal dengan error FK tapi juga tidak diam-diam merusak
data milik user lain:

| Tabel.kolom                        | Perilaku saat user direferensikan dihapus         |
|-------------------------------------|----------------------------------------------------|
| `exam_attempts.user_id`             | `ON DELETE CASCADE` — riwayat attempt milik siswa itu sendiri ikut terhapus |
| `exam_assignments.assigned_by`      | `ON DELETE SET NULL` — assignment ke siswa tetap ada, hanya info pemberi tugas yang hilang |
| `exam_assignments.student_id`       | `ON DELETE CASCADE` |
| `exams.teacher_id`                  | **RESTRICT** (default) — sengaja diblokir; `userService.deleteUser` mengecek dulu & kasih pesan jelas kalau guru masih punya ujian, supaya ujian + riwayat nilai siswa lain tidak ikut lenyap |
| `questions.teacher_id`              | `ON DELETE SET NULL` — soal tetap ada di Bank Soal walau penulisnya (Guru/Pengelola Soal) dihapus, tampil sebagai "Guru terhapus" di UI |
| `questions.subject_id`              | `ON DELETE SET NULL` — soal tetap ada walau mata pelajarannya dihapus Admin |
| `exam_questions.exam_id`            | `ON DELETE CASCADE` — kalau ujian dihapus, cuma link pivot-nya yang hilang, soal tetap di Bank Soal |
| `exam_questions.question_id`        | `ON DELETE CASCADE` — kalau soal dihapus permanen dari Bank Soal, otomatis lepas dari semua ujian yang memakainya |
| `teacher_profiles/student_profiles.user_id` | `ON DELETE CASCADE` |
| `teacher_students.teacher_id/student_id`    | `ON DELETE CASCADE` |

## Bank Soal (Question Bank) & Hak Akses per Role

Sejak fitur Bank Soal, soal **tidak lagi terikat ke satu ujian** — relasi `exams` <-> `questions` adalah many-to-many lewat `exam_questions`. Satu soal bisa dipakai di banyak ujian oleh guru berbeda.

```
POST   /api/exams/:id/questions           (Guru, pemilik ujian) -> buat soal baru, otomatis masuk Bank Soal + terhubung ke ujian ini
POST   /api/exams/:id/questions/attach    (Guru, pemilik ujian) -> hubungkan soal Bank Soal yang sudah ada ke ujian ini
DELETE /api/exams/:id/questions/:qId      (Guru, pemilik ujian) -> lepas soal dari ujian ini saja (soal tetap di Bank Soal)
GET    /api/questions/bank                (Guru/Admin/Pengelola Soal) -> daftar Bank Soal, filter ?subject_id=&difficulty=&teacher_id=
POST   /api/questions                     (Guru/Pengelola Soal) -> buat soal standalone (tanpa terhubung ke ujian mana pun)
PUT    /api/questions/:id                 (penulis asli, atau Pengelola Soal untuk soal siapa pun) -> edit isi soal
DELETE /api/questions/:id                 (penulis asli, Admin, atau Pengelola Soal) -> hapus permanen dari Bank Soal
```

**Matriks hak akses ke isi soal (`questionRepository`/`examService`):**

| Role | Lihat Bank Soal | Edit soal | Hapus soal |
|---|---|---|---|
| Guru | Semua (untuk dipakai di ujian) | **Hanya buatan sendiri** | **Hanya buatan sendiri** |
| Admin | Semua (moderasi) | ❌ Tidak bisa | Siapa pun (moderasi) |
| Pengelola Soal | Semua | **Siapa pun** (akses penuh) | **Siapa pun** (akses penuh) |

Ditegakkan lewat helper `canManageAnyQuestion(role)` di `examService.js` — return `true` untuk role `Pengelola Soal`, dipakai sebagai bypass di `ensureQuestionAuthor()`. Guru tetap dicek `question.teacher_id === actingUser.id`.

Soal punya hingga **5 opsi jawaban (A-E)** — divalidasi di `examService.js` (`validateOptions`, min 2 maks 5, wajib tepat 1 `is_correct`), bukan constraint di level tabel `options` yang generik.

## Keamanan (CORS, Rate Limiting, Trust Proxy)

> Detail lengkap & checklist berjalan ada di `SECURITY.md` — bagian ini cuma peta teknis di mana konfigurasinya berada.

`backend/server.js`:
- **CORS**: `cors({ origin: allowedOrigins, credentials: true })` — daftar origin dibaca dari `.env` (`ALLOWED_ORIGINS`, dipisah koma). Kalau kosong, fallback ke `origin: true` (izinkan semua) + `console.warn` jelas saat startup.
- **Trust proxy**: `app.set('trust proxy', 1)` — **wajib** kalau di belakang reverse proxy (Cloudflare Tunnel/nginx), supaya `req.ip` (dipakai rate limiter) baca IP pengunjung asli dari header `X-Forwarded-For`, bukan IP proxy itu sendiri. Angka `1` = percaya tepat 1 hop di depan Express.
- **Rate limiting** (`backend/middlewares/rateLimitMiddleware.js`, pakai `express-rate-limit`):
  - `globalApiLimiter` — 300 request/15 menit per IP, dipasang di semua `/api` (`server.js`).
  - `authLimiter` — 10 request/15 menit per IP, lebih ketat, dipasang khusus di `backend/routes/authRoutes.js` pada `register`, `login`, `verify-otp`, `resend-otp` (endpoint paling rawan brute-force/spam).
  - Response `429` pakai format JSON konsisten dengan response error lain di app (`{ success: false, message: '...' }`).

## Environment Variables Kunci

Lihat `.env.example` untuk daftar lengkap. Yang berkaitan dengan keamanan (CORS):

```
ALLOWED_ORIGINS=https://domain-frontend-kamu.com   # dipisah koma kalau lebih dari satu; kosong = fallback izinkan semua (warning di log)
```

Yang berkaitan dengan OTP/email:

```
EMAIL_USER=akun_pengirim@gmail.com
EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # App Password Gmail (bukan password akun biasa)
OTP_EXPIRES_MINUTES=10
OTP_RESEND_COOLDOWN_MINUTES=3
```