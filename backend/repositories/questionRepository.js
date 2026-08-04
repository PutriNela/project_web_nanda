/**
 * Question Repository
 * Data Access Layer - query mentah ke tabel questions & options (MySQL, async/await).
 * Sejak fitur Bank Soal: questions bersifat reusable, relasi ke exams lewat
 * tabel pivot exam_questions (lihat examQuestionRepository.js).
 */
const pool = require('../config/db');

const BASE_SELECT = `
  SELECT q.*, s.subject_name, u.name AS teacher_name
  FROM questions q
  LEFT JOIN subjects s ON s.id = q.subject_id
  LEFT JOIN users u    ON u.id = q.teacher_id
`;

const questionRepository = {
  async findById(id) {
    const [rows] = await pool.execute(`${BASE_SELECT} WHERE q.id = ?`, [id]);
    return rows[0] || null;
  },

  // ---- Daftar soal milik satu ujian (lewat pivot exam_questions) ----
  async findAllByExam(examId) {
    const [rows] = await pool.execute(
      `${BASE_SELECT}
       JOIN exam_questions eq ON eq.question_id = q.id
       WHERE eq.exam_id = ?
       ORDER BY eq.id ASC`,
      [examId]
    );
    return rows;
  },

  // Soal lengkap beserta opsi jawaban (untuk Guru, termasuk is_correct)
  async findAllByExamWithOptions(examId) {
    const questions = await this.findAllByExam(examId);
    const result = [];
    for (const q of questions) {
      const [options] = await pool.execute(
        'SELECT * FROM options WHERE question_id = ? ORDER BY id ASC',
        [q.id]
      );
      result.push({ ...q, options });
    }
    return result;
  },

  // Soal untuk Siswa saat mengerjakan ujian (tanpa is_correct)
  async findAllByExamForStudent(examId) {
    const questions = await this.findAllByExam(examId);
    const result = [];
    for (const q of questions) {
      const [options] = await pool.execute(
        'SELECT id, question_id, option_text FROM options WHERE question_id = ? ORDER BY id ASC',
        [q.id]
      );
      result.push({ ...q, options });
    }
    return result;
  },

  // ---- Bank Soal: daftar seluruh soal, bisa difilter mapel & tingkat kesulitan ----
  async findBank({ subject_id, difficulty, teacher_id } = {}) {
    const conditions = [];
    const params = [];
    if (subject_id) {
      conditions.push('q.subject_id = ?');
      params.push(subject_id);
    }
    if (difficulty) {
      conditions.push('q.difficulty = ?');
      params.push(difficulty);
    }
    if (teacher_id) {
      conditions.push('q.teacher_id = ?');
      params.push(teacher_id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `${BASE_SELECT} ${where} ORDER BY q.created_at DESC`,
      params
    );
    return rows;
  },

  async findBankWithOptions(filters) {
    const questions = await this.findBank(filters);
    const result = [];
    for (const q of questions) {
      const [options] = await pool.execute(
        'SELECT * FROM options WHERE question_id = ? ORDER BY id ASC',
        [q.id]
      );
      result.push({ ...q, options });
    }
    return result;
  },

  // Buat soal baru di Bank Soal (tidak otomatis terhubung ke ujian mana pun;
  // penghubungan ke ujian dilakukan lewat examQuestionRepository.link())
  async create({ question_text, subject_id, difficulty, teacher_id, score_weight }) {
    const [result] = await pool.execute(
      `INSERT INTO questions (question_text, subject_id, difficulty, teacher_id, score_weight)
       VALUES (?, ?, ?, ?, ?)`,
      [question_text, subject_id, difficulty, teacher_id, score_weight]
    );
    return this.findById(result.insertId);
  },

  async update(id, { question_text, subject_id, difficulty, score_weight }) {
    await pool.execute(
      `UPDATE questions
       SET question_text = ?, subject_id = ?, difficulty = ?, score_weight = ?
       WHERE id = ?`,
      [question_text, subject_id, difficulty, score_weight, id]
    );
    return this.findById(id);
  },

  async updateImageUrl(id, imageUrl) {
    await pool.execute('UPDATE questions SET image_url = ? WHERE id = ?', [imageUrl, id]);
    return this.findById(id);
  },

  async clearImageUrl(id) {
    await pool.execute('UPDATE questions SET image_url = NULL WHERE id = ?', [id]);
    return this.findById(id);
  },

  // Hapus soal permanen dari Bank Soal (otomatis lepas dari semua ujian lewat
  // ON DELETE CASCADE di tabel pivot exam_questions)
  async deleteById(id) {
    const [result] = await pool.execute('DELETE FROM questions WHERE id = ?', [id]);
    return result;
  },

  // ---- Options ----
  async findOptionById(id) {
    const [rows] = await pool.execute('SELECT * FROM options WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findOptionsByQuestion(questionId) {
    const [rows] = await pool.execute('SELECT * FROM options WHERE question_id = ?', [questionId]);
    return rows;
  },

  async createOption({ question_id, option_text, is_correct }) {
    const [result] = await pool.execute(
      `INSERT INTO options (question_id, option_text, is_correct)
       VALUES (?, ?, ?)`,
      [question_id, option_text, is_correct ? 1 : 0]
    );
    return this.findOptionById(result.insertId);
  },

  async updateOption(id, { option_text, is_correct }) {
    await pool.execute(
      'UPDATE options SET option_text = ?, is_correct = ? WHERE id = ?',
      [option_text, is_correct ? 1 : 0, id]
    );
    return this.findOptionById(id);
  },

  async deleteOptionById(id) {
    const [result] = await pool.execute('DELETE FROM options WHERE id = ?', [id]);
    return result;
  },

  async deleteOptionsByQuestion(questionId) {
    const [result] = await pool.execute('DELETE FROM options WHERE question_id = ?', [questionId]);
    return result;
  },
};

module.exports = questionRepository;