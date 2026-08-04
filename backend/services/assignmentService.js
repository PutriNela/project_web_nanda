/**
 * Assignment Service
 * Business Logic Layer - aturan bisnis untuk:
 * 1. Admin: assign/unassign siswa ke guru (relasi many-to-many)
 * 2. Guru: assign/unassign siswa (yang ada di bawahnya) ke ujian
 */
const teacherStudentRepository = require('../repositories/teacherStudentRepository');
const examAssignmentRepository = require('../repositories/examAssignmentRepository');
const examRepository = require('../repositories/examRepository');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

const assignmentService = {
  // ----------------------------------------------------------------
  // TEACHER ↔ STUDENT (dikelola Admin)
  // ----------------------------------------------------------------

  async getStudentsByTeacher(teacherId) {
    const teacher = await userRepository.findById(teacherId);
    if (!teacher || teacher.role_name !== 'Guru') {
      throw new AppError('Guru tidak ditemukan.', 404);
    }
    return teacherStudentRepository.findStudentsByTeacher(teacherId);
  },

  async getTeachersByStudent(studentId) {
    const student = await userRepository.findById(studentId);
    if (!student || student.role_name !== 'Siswa') {
      throw new AppError('Siswa tidak ditemukan.', 404);
    }
    return teacherStudentRepository.findTeachersByStudent(studentId);
  },

  async getUnassignedStudents(teacherId) {
    return teacherStudentRepository.findUnassignedStudents(teacherId);
  },

  /**
   * Admin menambahkan satu atau banyak siswa ke daftar siswa seorang guru.
   * studentIds bisa array (bulk) atau number tunggal.
   */
  async assignStudentsToTeacher(teacherId, studentIds) {
    const teacher = await userRepository.findById(teacherId);
    if (!teacher || teacher.role_name !== 'Guru') {
      throw new AppError('Guru tidak ditemukan.', 404);
    }

    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    if (!ids.length) throw new AppError('Tidak ada siswa yang dipilih.');

    // Validasi: pastikan semua id adalah siswa yang approved
    for (const sid of ids) {
      const student = await userRepository.findById(sid);
      if (!student || student.role_name !== 'Siswa') {
        throw new AppError(`ID ${sid} bukan siswa yang valid.`, 400);
      }
      if (student.status !== 'approved') {
        throw new AppError(`Siswa "${student.name}" belum disetujui Admin.`, 400);
      }
    }

    await teacherStudentRepository.assignBulk(teacherId, ids);
    return teacherStudentRepository.findStudentsByTeacher(teacherId);
  },

  async unassignStudentFromTeacher(teacherId, studentId) {
    const removed = await teacherStudentRepository.unassign(teacherId, studentId);
    if (!removed) {
      throw new AppError('Relasi guru-siswa tidak ditemukan.', 404);
    }
    return { message: 'Siswa berhasil dihapus dari daftar guru.' };
  },

  // ----------------------------------------------------------------
  // EXAM ↔ STUDENT (dikelola Guru)
  // ----------------------------------------------------------------

  async getAssignedStudents(examId, teacherId) {
    const exam = await examRepository.findById(examId);
    if (!exam) throw new AppError('Ujian tidak ditemukan.', 404);
    if (Number(exam.teacher_id) !== Number(teacherId)) {
      throw new AppError('Anda tidak memiliki akses ke ujian ini.', 403);
    }
    return examAssignmentRepository.findStudentsByExam(examId);
  },

  async getAssignableStudents(examId, teacherId) {
    const exam = await examRepository.findById(examId);
    if (!exam) throw new AppError('Ujian tidak ditemukan.', 404);
    if (Number(exam.teacher_id) !== Number(teacherId)) {
      throw new AppError('Anda tidak memiliki akses ke ujian ini.', 403);
    }
    // Hanya siswa yang ada di bawah guru ini dan belum di-assign ke ujian ini
    return examAssignmentRepository.findAssignableStudents(examId, teacherId);
  },

  /**
   * Guru menugaskan satu atau banyak siswa ke sebuah ujian.
   * Siswa yang di-assign HARUS ada dalam daftar teacher_students guru tersebut.
   * studentIds bisa array (bulk) atau number tunggal.
   */
  async assignStudentsToExam(examId, studentIds, teacherId) {
    const exam = await examRepository.findById(examId);
    if (!exam) throw new AppError('Ujian tidak ditemukan.', 404);
    if (Number(exam.teacher_id) !== Number(teacherId)) {
      throw new AppError('Anda tidak memiliki akses ke ujian ini.', 403);
    }

    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    if (!ids.length) throw new AppError('Tidak ada siswa yang dipilih.');

    // Validasi: siswa harus berada di bawah guru ini
    for (const sid of ids) {
      const isUnder = await teacherStudentRepository.exists(teacherId, sid);
      if (!isUnder) {
        const student = await userRepository.findById(sid);
        throw new AppError(
          `Siswa "${student?.name || sid}" tidak berada di bawah tanggung jawab Anda.`,
          403
        );
      }
    }

    await examAssignmentRepository.assignBulk(examId, ids, teacherId);
    return examAssignmentRepository.findStudentsByExam(examId);
  },

  async unassignStudentFromExam(examId, studentId, teacherId) {
    const exam = await examRepository.findById(examId);
    if (!exam) throw new AppError('Ujian tidak ditemukan.', 404);
    if (Number(exam.teacher_id) !== Number(teacherId)) {
      throw new AppError('Anda tidak memiliki akses ke ujian ini.', 403);
    }

    const removed = await examAssignmentRepository.unassign(examId, studentId);
    if (!removed) {
      throw new AppError('Siswa tidak ditemukan dalam penugasan ujian ini.', 404);
    }
    return { message: 'Siswa berhasil dihapus dari penugasan ujian.' };
  },
};

module.exports = assignmentService;