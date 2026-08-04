/**
 * Exam Repository
 * Data Access Layer - query mentah ke tabel exams (MySQL, async/await).
 */
const pool = require('../config/db');

const examRepository = {
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT e.*, s.subject_name, u.name AS teacher_name
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       JOIN users u ON u.id = e.teacher_id
       WHERE e.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async findAllActive() {
    const [rows] = await pool.execute(
      `SELECT e.*, s.subject_name, u.name AS teacher_name
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       JOIN users u ON u.id = e.teacher_id
       WHERE e.is_active = 1
       ORDER BY e.created_at DESC`
    );
    return rows;
  },

  async findAllByTeacher(teacherId) {
    const [rows] = await pool.execute(
      `SELECT e.*, s.subject_name
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.teacher_id = ?
       ORDER BY e.created_at DESC`,
      [teacherId]
    );
    return rows;
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT e.*, s.subject_name, u.name AS teacher_name
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       JOIN users u ON u.id = e.teacher_id
       ORDER BY e.created_at DESC`
    );
    return rows;
  },

  async create({ title, subject_id, teacher_id, duration, minimum_score, is_active }) {
    const [result] = await pool.execute(
      `INSERT INTO exams (title, subject_id, teacher_id, duration, minimum_score, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, subject_id, teacher_id, duration, minimum_score, is_active ? 1 : 0]
    );
    return this.findById(result.insertId);
  },

  async update(id, { title, subject_id, duration, minimum_score, is_active }) {
    await pool.execute(
      `UPDATE exams
       SET title = ?, subject_id = ?, duration = ?, minimum_score = ?, is_active = ?
       WHERE id = ?`,
      [title, subject_id, duration, minimum_score, is_active ? 1 : 0, id]
    );
    return this.findById(id);
  },

  async setActive(id, isActive) {
    await pool.execute('UPDATE exams SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    return this.findById(id);
  },

  async deleteById(id) {
    const [result] = await pool.execute('DELETE FROM exams WHERE id = ?', [id]);
    return result;
  },
};

module.exports = examRepository;
