/**
 * User Repository
 * Data Access Layer - query mentah ke tabel users & roles (MySQL, async/await).
 * Tidak ada aturan bisnis di sini.
 */
const pool = require('../config/db');

const userRepository = {
  async findByUsername(username) {
    const [rows] = await pool.execute(
      `SELECT u.*, r.role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = ?`,
      [username]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT u.*, r.role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await pool.execute(
      `SELECT u.*, r.role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?`,
      [email]
    );
    return rows[0] || null;
  },

  async findRoleByName(roleName) {
    const [rows] = await pool.execute('SELECT * FROM roles WHERE role_name = ?', [roleName]);
    return rows[0] || null;
  },

  async findRoleById(roleId) {
    const [rows] = await pool.execute('SELECT * FROM roles WHERE id = ?', [roleId]);
    return rows[0] || null;
  },

  async create({ username, password, name, role_id, status, email = null }) {
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password, name, role_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, password, name, role_id, status]
    );
    return this.findById(result.insertId);
  },

  async updateStatus(id, status) {
    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    return this.findById(id);
  },

  /**
   * Simpan/perbarui kode OTP verifikasi email (dipakai saat register & resend).
   * otpExpiresAt & otpLastSentAt disimpan sebagai epoch ms (BIGINT) agar
   * perhitungan kedaluwarsa/cooldown tidak bergantung timezone.
   */
  async setOtp(id, { otpCode, otpExpiresAt, otpLastSentAt }) {
    await pool.execute(
      `UPDATE users SET otp_code = ?, otp_expires_at = ?, otp_last_sent_at = ? WHERE id = ?`,
      [otpCode, otpExpiresAt, otpLastSentAt, id]
    );
    return this.findById(id);
  },

  /**
   * Tandai email terverifikasi & pindahkan status ke 'pending' (siap diproses Admin).
   */
  async markEmailVerified(id) {
    await pool.execute(
      `UPDATE users
       SET status = 'pending', email_verified = 1, otp_code = NULL, otp_expires_at = NULL
       WHERE id = ?`,
      [id]
    );
    return this.findById(id);
  },

  async findAllByStatus(status) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.name, u.status, r.role_name, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.status = ?
       ORDER BY u.created_at DESC`,
      [status]
    );
    return rows;
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.name, u.status, r.role_name, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    );
    return rows;
  },

  async findAllByRole(roleName) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.name, u.status, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.role_name = ? AND u.status = 'approved'
       ORDER BY u.name ASC`,
      [roleName]
    );
    return rows;
  },

  async deleteById(id) {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result;
  },
};

module.exports = userRepository;
