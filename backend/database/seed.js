/**
 * Seed Script (MySQL via XAMPP)
 * Mengisi data awal: role (Admin, Guru, Siswa, Pengelola Soal), satu akun Admin
 * pertama, dan satu akun Pengelola Soal pertama.
 * Jalankan dengan: npm run seed
 */
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
require('dotenv').config();

async function seed() {
  console.log('Menjalankan seeding data awal...');

  const roles = ['Admin', 'Guru', 'Siswa', 'Pengelola Soal'];
  for (const roleName of roles) {
    await pool.execute('INSERT IGNORE INTO roles (role_name) VALUES (?)', [roleName]);
  }
  console.log('Role berhasil di-seed:', roles.join(', '));

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

  // ---- Akun Admin pertama ----
  const [adminRoleRows] = await pool.execute("SELECT id FROM roles WHERE role_name = 'Admin'");
  const adminRoleId = adminRoleRows[0].id;

  const [existingAdminRows] = await pool.execute(
    'SELECT id FROM users WHERE role_id = ? LIMIT 1',
    [adminRoleId]
  );

  if (existingAdminRows.length > 0) {
    console.log('Akun Admin sudah ada, lewati pembuatan admin default.');
  } else {
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const plainPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const name = process.env.DEFAULT_ADMIN_NAME || 'Administrator';
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    await pool.execute(
      `INSERT INTO users (username, password, name, role_id, status)
       VALUES (?, ?, ?, ?, 'approved')`,
      [username, hashedPassword, name, adminRoleId]
    );

    console.log(`Akun Admin default berhasil dibuat -> username: "${username}"`);
    console.log('PENTING: segera ganti password default ini setelah login pertama.');
  }

  // ---- Akun Pengelola Soal pertama ----
  // Role independen (bukan Guru/Admin/Siswa), khusus mengelola Bank Soal miliknya sendiri.
  // Hanya Admin yang boleh membuat akun dengan role ini (lewat menu "Tambah Pengguna").
  const [pengelolaRoleRows] = await pool.execute("SELECT id FROM roles WHERE role_name = 'Pengelola Soal'");
  const pengelolaRoleId = pengelolaRoleRows[0].id;

  const [existingPengelolaRows] = await pool.execute(
    'SELECT id FROM users WHERE role_id = ? LIMIT 1',
    [pengelolaRoleId]
  );

  if (existingPengelolaRows.length > 0) {
    console.log('Akun Pengelola Soal sudah ada, lewati pembuatan akun default.');
  } else {
    const username = process.env.DEFAULT_PENGELOLA_USERNAME || 'pengelola';
    const email = process.env.DEFAULT_PENGELOLA_EMAIL || 'pengelola@test.dev';
    const plainPassword = process.env.DEFAULT_PENGELOLA_PASSWORD || 'pengelola123';
    const name = process.env.DEFAULT_PENGELOLA_NAME || 'Pengelola Soal';
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    await pool.execute(
      `INSERT INTO users (username, email, password, name, role_id, status, email_verified, profile_completed)
       VALUES (?, ?, ?, ?, ?, 'approved', 1, 1)`,
      [username, email, hashedPassword, name, pengelolaRoleId]
    );

    console.log(`Akun Pengelola Soal default berhasil dibuat -> username: "${username}", email: "${email}"`);
    console.log('PENTING: segera ganti password default ini setelah login pertama.');
  }

  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding gagal:', err.message);
  process.exit(1);
});