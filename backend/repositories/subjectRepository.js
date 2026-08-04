/**
 * Subject Repository
 * Data Access Layer - query mentah ke tabel subjects (MySQL, async/await).
 */
const pool = require('../config/db');

const subjectRepository = {
  async findAll() {
    const [rows] = await pool.execute('SELECT * FROM subjects ORDER BY subject_name ASC');
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM subjects WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByName(name) {
    const [rows] = await pool.execute('SELECT * FROM subjects WHERE subject_name = ?', [name]);
    return rows[0] || null;
  },

  async create(subjectName) {
    const [result] = await pool.execute(
      'INSERT INTO subjects (subject_name) VALUES (?)',
      [subjectName]
    );
    return this.findById(result.insertId);
  },

  async update(id, subjectName) {
    await pool.execute('UPDATE subjects SET subject_name = ? WHERE id = ?', [subjectName, id]);
    return this.findById(id);
  },

  async deleteById(id) {
    const [result] = await pool.execute('DELETE FROM subjects WHERE id = ?', [id]);
    return result;
  },
};

module.exports = subjectRepository;
