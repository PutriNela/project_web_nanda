/**
 * Exam Assignment Repository
 * Data Access Layer - query mentah ke tabel exam_assignments.
 */
const pool = require('../config/db');

const examAssignmentRepository = {
  async exists(examId, studentId) {
    const [rows] = await pool.execute(
      `SELECT 1 FROM exam_assignments WHERE exam_id = ? AND student_id = ?`,
      [examId, studentId]
    );
    return rows.length > 0;
  },

  async findStudentsByExam(examId) {
    const [rows] = await pool.execute(
      `SELECT
         u.id AS student_id, u.name AS student_name, u.username,
         COALESCE(assignor.name, 'Tidak diketahui') AS assigned_by_name, ea.assigned_at
       FROM exam_assignments ea
       JOIN users u             ON u.id = ea.student_id
       LEFT JOIN users assignor ON assignor.id = ea.assigned_by
       WHERE ea.exam_id = ?
       ORDER BY u.name ASC`,
      [examId]
    );
    return rows;
  },

  // Dipakai dashboard siswa — hanya ujian yang di-assign dan aktif.
  // Sertakan teacher_id agar bisa digroup per guru di frontend.
  async findExamsByStudent(studentId) {
    const [rows] = await pool.execute(
      `SELECT
         e.id, e.title, e.duration, e.minimum_score, e.is_active,
         e.teacher_id,
         s.subject_name,
         u.name AS teacher_name,
         ea.assigned_at, ea.assigned_by
       FROM exam_assignments ea
       JOIN exams    e ON e.id = ea.exam_id
       JOIN subjects s ON s.id = e.subject_id
       JOIN users    u ON u.id = e.teacher_id
       WHERE ea.student_id = ? AND e.is_active = 1
       ORDER BY ea.assigned_at DESC`,
      [studentId]
    );
    return rows;
  },

  // Guru-guru yang punya ujian di-assign ke siswa ini,
  // beserta profil dan mata kuliah mereka.
  async findTeachersByStudent(studentId) {
    const [rows] = await pool.execute(
      `SELECT
         u.id AS teacher_id,
         u.name AS teacher_name,
         tp.full_name AS teacher_full_name,
         tp.photo_url,
         GROUP_CONCAT(DISTINCT subj.subject_name ORDER BY subj.subject_name SEPARATOR ', ') AS subjects
       FROM exam_assignments ea
       JOIN exams e ON e.id = ea.exam_id
       JOIN users u ON u.id = e.teacher_id
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       LEFT JOIN teacher_subjects tsubj ON tsubj.teacher_profile_id = tp.id
       LEFT JOIN subjects subj ON subj.id = tsubj.subject_id
       WHERE ea.student_id = ?
       GROUP BY u.id, u.name, tp.full_name, tp.photo_url
       ORDER BY COALESCE(tp.full_name, u.name) ASC`,
      [studentId]
    );
    return rows;
  },

  async assign(examId, studentId, assignedBy) {
    await pool.execute(
      `INSERT IGNORE INTO exam_assignments (exam_id, student_id, assigned_by) VALUES (?, ?, ?)`,
      [examId, studentId, assignedBy]
    );
  },

  async assignBulk(examId, studentIds, assignedBy) {
    if (!studentIds.length) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const studentId of studentIds) {
        await conn.execute(
          `INSERT IGNORE INTO exam_assignments (exam_id, student_id, assigned_by) VALUES (?, ?, ?)`,
          [examId, studentId, assignedBy]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async unassign(examId, studentId) {
    const [result] = await pool.execute(
      `DELETE FROM exam_assignments WHERE exam_id = ? AND student_id = ?`,
      [examId, studentId]
    );
    return result.affectedRows > 0;
  },

  async findAssignableStudents(examId, teacherId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.username
       FROM teacher_students ts
       JOIN users u ON u.id = ts.student_id
       WHERE ts.teacher_id = ?
         AND u.status = 'approved'
         AND u.id NOT IN (
           SELECT student_id FROM exam_assignments WHERE exam_id = ?
         )
       ORDER BY u.name ASC`,
      [teacherId, examId]
    );
    return rows;
  },
};

module.exports = examAssignmentRepository;