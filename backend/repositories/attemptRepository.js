/**
 * Attempt Repository
 * Data Access Layer - query mentah ke tabel exam_attempts & student_answers.
 */
const pool = require('../config/db');

const attemptRepository = {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM exam_attempts WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findAllByUserAndExam(userId, examId) {
    const [rows] = await pool.execute(
      `SELECT * FROM exam_attempts WHERE user_id = ? AND exam_id = ? ORDER BY attempt_number DESC`,
      [userId, examId]
    );
    return rows;
  },

  async findLatestByUserAndExam(userId, examId) {
    const [rows] = await pool.execute(
      `SELECT * FROM exam_attempts WHERE user_id = ? AND exam_id = ? ORDER BY attempt_number DESC LIMIT 1`,
      [userId, examId]
    );
    return rows[0] || null;
  },

  async countAttemptsByUserAndExam(userId, examId) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM exam_attempts WHERE user_id = ? AND exam_id = ? AND status != 'started'`,
      [userId, examId]
    );
    return rows[0].total;
  },

  async findOngoingAttempt(userId, examId) {
    const [rows] = await pool.execute(
      `SELECT * FROM exam_attempts WHERE user_id = ? AND exam_id = ? AND status = 'started'`,
      [userId, examId]
    );
    return rows[0] || null;
  },

  async create({ user_id, exam_id, attempt_number }) {
    const [result] = await pool.execute(
      `INSERT INTO exam_attempts (user_id, exam_id, attempt_number, status) VALUES (?, ?, ?, 'started')`,
      [user_id, exam_id, attempt_number]
    );
    return this.findById(result.insertId);
  },

  async submit(id, { final_score, status }) {
    await pool.execute(
      `UPDATE exam_attempts SET final_score = ?, status = ?, end_time = NOW() WHERE id = ?`,
      [final_score, status, id]
    );
    return this.findById(id);
  },

  // Rekap nilai per siswa untuk satu ujian — sumber dari exam_assignments.
  async findAttemptSummaryByExam(examId) {
    const [rows] = await pool.execute(
      `SELECT
         u.id   AS user_id,
         u.name AS student_name,
         MAX(CASE WHEN att.status != 'started' THEN att.final_score END) AS highest_score,
         COUNT(CASE WHEN att.status != 'started' THEN 1 END)             AS attempt_count
       FROM exam_assignments ea
       JOIN users u ON u.id = ea.student_id
       LEFT JOIN exam_attempts att ON att.user_id = ea.student_id AND att.exam_id = ea.exam_id
       WHERE ea.exam_id = ?
       GROUP BY u.id, u.name
       ORDER BY u.name ASC`,
      [examId]
    );
    return rows;
  },

  async findAllByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT ea.*, e.title, e.minimum_score
       FROM exam_attempts ea
       JOIN exams e ON e.id = ea.exam_id
       WHERE ea.user_id = ?
       ORDER BY ea.start_time DESC`,
      [userId]
    );
    return rows;
  },

  // ---- Student Answers ----
  async saveAnswer({ exam_attempt_id, question_id, selected_option_id }) {
    const [existingRows] = await pool.execute(
      'SELECT id FROM student_answers WHERE exam_attempt_id = ? AND question_id = ?',
      [exam_attempt_id, question_id]
    );
    if (existingRows.length > 0) {
      const existingId = existingRows[0].id;
      await pool.execute('UPDATE student_answers SET selected_option_id = ? WHERE id = ?', [
        selected_option_id, existingId,
      ]);
      return { id: existingId, exam_attempt_id, question_id, selected_option_id };
    }
    const [result] = await pool.execute(
      `INSERT INTO student_answers (exam_attempt_id, question_id, selected_option_id) VALUES (?, ?, ?)`,
      [exam_attempt_id, question_id, selected_option_id]
    );
    return { id: result.insertId, exam_attempt_id, question_id, selected_option_id };
  },

  async findAnswersByAttempt(attemptId) {
    const [rows] = await pool.execute(
      'SELECT * FROM student_answers WHERE exam_attempt_id = ?',
      [attemptId]
    );
    return rows;
  },
};

module.exports = attemptRepository;