/**
 * Teacher-Student Repository
 * Data Access Layer - query mentah ke tabel teacher_students.
 * Relasi many-to-many Guru <-> Siswa, dikelola oleh Admin.
 */
const pool = require('../config/db');

const teacherStudentRepository = {
  // Ambil semua siswa yang berada di bawah seorang guru
  async findStudentsByTeacher(teacherId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.username, u.status, ts.assigned_at
       FROM teacher_students ts
       JOIN users u ON u.id = ts.student_id
       WHERE ts.teacher_id = ?
       ORDER BY u.name ASC`,
      [teacherId]
    );
    return rows;
  },

  // Ambil semua guru yang mengampu seorang siswa
  async findTeachersByStudent(studentId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.username, ts.assigned_at
       FROM teacher_students ts
       JOIN users u ON u.id = ts.teacher_id
       WHERE ts.student_id = ?
       ORDER BY u.name ASC`,
      [studentId]
    );
    return rows;
  },

  // Cek apakah relasi guru-siswa sudah ada
  async exists(teacherId, studentId) {
    const [rows] = await pool.execute(
      `SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?`,
      [teacherId, studentId]
    );
    return rows.length > 0;
  },

  // Assign satu siswa ke satu guru
  async assign(teacherId, studentId) {
    await pool.execute(
      `INSERT IGNORE INTO teacher_students (teacher_id, student_id) VALUES (?, ?)`,
      [teacherId, studentId]
    );
  },

  // Assign banyak siswa ke satu guru dalam satu transaksi
  async assignBulk(teacherId, studentIds) {
    if (!studentIds.length) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const studentId of studentIds) {
        await conn.execute(
          `INSERT IGNORE INTO teacher_students (teacher_id, student_id) VALUES (?, ?)`,
          [teacherId, studentId]
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

  // Hapus relasi satu siswa dari satu guru
  async unassign(teacherId, studentId) {
    const [result] = await pool.execute(
      `DELETE FROM teacher_students WHERE teacher_id = ? AND student_id = ?`,
      [teacherId, studentId]
    );
    return result.affectedRows > 0;
  },

  // Ambil semua siswa yang BELUM di-assign ke guru tertentu
  // (berguna untuk dropdown pilih siswa saat assign)
  async findUnassignedStudents(teacherId) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.username
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.role_name = 'Siswa'
         AND u.status = 'approved'
         AND u.id NOT IN (
           SELECT student_id FROM teacher_students WHERE teacher_id = ?
         )
       ORDER BY u.name ASC`,
      [teacherId]
    );
    return rows;
  },
};

module.exports = teacherStudentRepository;