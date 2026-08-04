/**
 * Exam-Question Repository
 * Data Access Layer - query mentah ke tabel pivot exam_questions (many-to-many
 * antara exams <-> questions, bagian dari fitur Bank Soal / Question Bank).
 */
const pool = require('../config/db');

const examQuestionRepository = {
  // Cek apakah soal tertentu sudah terhubung ke ujian tertentu
  async exists(examId, questionId) {
    const [rows] = await pool.execute(
      'SELECT 1 FROM exam_questions WHERE exam_id = ? AND question_id = ? LIMIT 1',
      [examId, questionId]
    );
    return rows.length > 0;
  },

  // Hubungkan satu soal ke satu ujian (idempotent, abaikan jika sudah terhubung)
  async link(examId, questionId) {
    await pool.execute(
      'INSERT IGNORE INTO exam_questions (exam_id, question_id) VALUES (?, ?)',
      [examId, questionId]
    );
    return true;
  },

  // Hubungkan banyak soal sekaligus ke satu ujian (dipakai fitur "Ambil dari Bank Soal")
  async linkMany(examId, questionIds) {
    for (const questionId of questionIds) {
      await this.link(examId, questionId);
    }
    return true;
  },

  // Putuskan hubungan satu soal dari satu ujian (soal TIDAK dihapus dari Bank Soal,
  // hanya dilepas dari ujian ini saja)
  async unlink(examId, questionId) {
    const [result] = await pool.execute(
      'DELETE FROM exam_questions WHERE exam_id = ? AND question_id = ?',
      [examId, questionId]
    );
    return result;
  },

  // Hitung di berapa ujian soal ini sedang dipakai
  async countExamsUsingQuestion(questionId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM exam_questions WHERE question_id = ?',
      [questionId]
    );
    return rows[0].cnt;
  },

  // Daftar id soal yang sudah terhubung ke suatu ujian (dipakai untuk menandai
  // soal mana saja yang sudah dipilih saat menampilkan modal Bank Soal)
  async findQuestionIdsByExam(examId) {
    const [rows] = await pool.execute(
      'SELECT question_id FROM exam_questions WHERE exam_id = ?',
      [examId]
    );
    return rows.map(r => r.question_id);
  },
};

module.exports = examQuestionRepository;
