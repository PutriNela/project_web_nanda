# CONTEXT — Latar Belakang Project

## Apa Ini?
**CBT App** — aplikasi Computer Based Test (ujian online) untuk lingkungan sekolah/kampus. Arsitektur three-tier monolitik: Express.js (backend) + MySQL (database, via XAMPP) + Vanilla JS mini-SPA tanpa build step (frontend, hash-based routing, di-serve statis oleh Express yang sama).

**Status deployment**: sudah **live di production**, diakses publik lewat domain `cbt.namadomain.fun` via **Cloudflare Tunnel**, dari home server (laptop pribadi, Linux, XAMPP for Linux). Bukan lagi sekadar project lokal untuk LAN sekolah — implikasinya, hardening keamanan jadi prioritas nyata (lihat `SECURITY.md`), bukan cuma nice-to-have.

## Siapa Penggunanya (4 Role)
- **Admin** — approve/reject pendaftaran akun baru, kelola data mata pelajaran (subject), hapus akun, moderasi Bank Soal (bisa hapus soal siapa pun, tidak bisa edit isi soal), dan **satu-satunya role yang bisa membuat akun Pengelola Soal**.
- **Guru** — bikin ujian (judul, durasi, nilai minimal lulus), tambah soal pilihan ganda ke Bank Soal (bisa dengan gambar, hingga 5 opsi A-E) **atau** pakai soal dari Bank Soal buatan guru lain, assign ujian ke siswa, lihat nilai & jumlah percobaan siswa, kelola profil (nama, data diri, foto). Guru **hanya bisa edit/hapus soal buatannya sendiri**.
- **Siswa** — lihat guru yang meng-assign ujian ke mereka, kerjakan ujian (bisa lihat gambar soal kalau ada), otomatis dapat opsi "Ulangi Ujian (Remedial)" kalau nilai di bawah passing grade, bisa update nama sendiri (tanpa foto/avatar — keputusan produk).
- **Pengelola Soal** (role baru, independen) — **satu-satunya tugasnya mengelola Bank Soal**, dengan akses penuh ke **seluruh** soal dari semua guru (bukan cuma buatan sendiri, beda dengan Guru). Tidak ada akses ke ujian, penilaian, atau data siswa sama sekali. Akun role ini **hanya bisa dibuat oleh Admin** (tidak ada jalur registrasi publik untuk role ini, sama seperti Admin).

## Kenapa Ada Verifikasi OTP Email?
Awalnya siapa saja bisa daftar akun dengan username sembarangan lalu langsung masuk antrian approval Admin — rawan akun asal-asalan/spam masuk antrian. Ditambahkan lapisan verifikasi: calon user harus punya email **@gmail.com** yang benar-benar bisa mereka akses, dibuktikan lewat kode OTP, **sebelum** request akunnya sampai ke Admin. Ini mengurangi beban approval Admin dari akun-akun tidak valid.

Keputusan desain penting:
- **Kenapa wajib @gmail.com, bukan email sembarang?** Ini keputusan eksplisit dari pemilik project (bukan asumsi/default) — kemungkinan supaya lebih mudah dipastikan itu email pribadi yang aktif dipakai (di lingkungan sekolah Indonesia, Gmail adalah provider email paling umum), dan menyederhanakan validasi.
- **Kenapa OTP 10 menit / resend cooldown 3 menit?** Angka spesifik ini diminta langsung oleh pemilik project, bukan default framework/library.

## Kenapa Ada Fitur Upload (Foto Profil & Gambar Soal)?
Ini fitur yang dikembangkan **secara terpisah** oleh pemilik project (di luar chat ini, di project versi lain bernama "versi_1") sambil chat ini fokus mengerjakan OTP+FK fix (di "versi_2"). Kedua versi ini berkembang paralel tanpa disadari sampai akhirnya digabung. Fitur upload sendiri masuk akal secara produk: guru sering butuh menyertakan gambar di soal (misal soal matematika dengan grafik, soal biologi dengan diagram), dan foto profil membantu siswa mengenali gurunya di dashboard.

## Konvensi & Istilah Domain
- **Passing grade** = nilai minimal lulus, ditentukan per-ujian oleh guru saat membuat ujian.
- **Remedial** = ujian ulang otomatis ditawarkan ke siswa yang nilainya di bawah passing grade.
- **Attempt** = satu kali percobaan pengerjaan ujian oleh siswa; sistem mencatat jumlah attempt per siswa per ujian.
- **Bank Soal (Question Bank)** = kumpulan soal yang reusable lintas ujian (relasi many-to-many lewat `exam_questions`), bukan lagi terikat 1 soal = 1 ujian. Tiap soal punya `subject_id`, `difficulty` (Mudah/Sedang/Sulit), dan `teacher_id` (penulis asli). Kepemilikan soal menentukan siapa yang boleh edit/hapus — lihat perbedaan hak akses Guru vs Pengelola Soal vs Admin di bagian "Siapa Penggunanya" di atas.
- **Status akun** (`users.status`): `unverified` → `pending` → `approved`/`rejected`. Lihat diagram lengkap di `architecture.md`.
- Semua tabel & kolom database pakai `snake_case`, semua kode JS pakai `camelCase`.
- Komentar kode dan pesan error yang ditampilkan ke user selalu **Bahasa Indonesia**.

## Batasan yang Disengaja (Bukan Bug)
- **`exams.teacher_id` tidak di-cascade saat guru dihapus** — ini keputusan sadar (bukan oversight) supaya menghapus akun guru tidak diam-diam menghapus seluruh ujian + riwayat nilai siswa lain yang sudah mengerjakan. Guru dengan ujian aktif harus dipindah/dihapus ujiannya dulu sebelum akunnya bisa dihapus Admin.
- **Registrasi mandiri untuk role Admin tidak diizinkan** — Admin hanya dibuat lewat `seed.js` (akun default) atau (kalau ada) dibuat manual oleh Admin lain, bukan lewat form register publik.
- **Login diblokir untuk status `unverified` maupun `pending`**, dengan pesan error yang berbeda untuk masing-masing supaya user tahu di tahap mana mereka macet (belum verifikasi OTP vs sudah verifikasi tapi belum di-approve Admin).

## Yang TIDAK Ada di Project Ini (jangan asumsikan ada)
- Tidak ada fitur lupa password / reset password.
- Tidak ada notifikasi selain email OTP (tidak ada SMS, push notification, dsb).
- Tidak ada payment/billing apa pun — ini aplikasi internal sekolah, gratis.
- Tidak ada multi-tenancy — satu instance MySQL untuk satu sekolah/institusi.
- Tidak ada automated test suite.
- **~~Tidak di-deploy ke cloud mana pun~~ — SUDAH DIPUBLISH** (per update ini): home server pribadi + Cloudflare Tunnel, diakses lewat domain publik. Bukan cloud managed (AWS/GCP/dll), tapi tetap reachable dari internet — treat seperti production publik untuk urusan keamanan (lihat `SECURITY.md`), jangan asumsikan "cuma jaringan lokal" lagi.