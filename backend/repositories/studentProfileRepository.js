/**
 * Student Profile Repository
 * Data Access Layer - query mentah ke tabel student_profiles.
 */
const pool = require('../config/db');

const studentProfileRepository = {
  async findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT sp.*, u.name, u.username
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT sp.*, u.name, u.username
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ user_id, full_name, nim, address, phone }) {
    const [result] = await pool.execute(
      `INSERT INTO student_profiles (user_id, full_name, nim, address, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, full_name, nim, address, phone]
    );
    return this.findById(result.insertId);
  },

  async update(id, { full_name, nim, address, phone }) {
    await pool.execute(
      `UPDATE student_profiles SET full_name = ?, nim = ?, address = ?, phone = ? WHERE id = ?`,
      [full_name, nim, address, phone, id]
    );
    return this.findById(id);
  },
};

module.exports = studentProfileRepository;