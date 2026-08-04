/**
 * Assignment Controller
 * Controller Layer - endpoint untuk:
 * - Admin: kelola relasi Guru <-> Siswa
 * - Guru: kelola penugasan Siswa ke Ujian
 */
const assignmentService = require('../services/assignmentService');
const asyncHandler = require('../utils/asyncHandler');

const assignmentController = {
  // ---- ADMIN: Teacher <-> Student ----

  // GET /api/teachers/:teacherId/students
  getStudentsByTeacher: asyncHandler(async (req, res) => {
    const students = await assignmentService.getStudentsByTeacher(req.params.teacherId);
    res.status(200).json({ success: true, data: students });
  }),

  // GET /api/teachers/:teacherId/students/unassigned
  getUnassignedStudents: asyncHandler(async (req, res) => {
    const students = await assignmentService.getUnassignedStudents(req.params.teacherId);
    res.status(200).json({ success: true, data: students });
  }),

  // GET /api/students/:studentId/teachers
  getTeachersByStudent: asyncHandler(async (req, res) => {
    const teachers = await assignmentService.getTeachersByStudent(req.params.studentId);
    res.status(200).json({ success: true, data: teachers });
  }),

  // POST /api/teachers/:teacherId/students
  // body: { studentIds: [1, 2, 3] }
  assignStudentsToTeacher: asyncHandler(async (req, res) => {
    const { studentIds } = req.body;
    const result = await assignmentService.assignStudentsToTeacher(
      req.params.teacherId,
      studentIds
    );
    res.status(200).json({ success: true, message: 'Siswa berhasil di-assign ke guru.', data: result });
  }),

  // DELETE /api/teachers/:teacherId/students/:studentId
  unassignStudentFromTeacher: asyncHandler(async (req, res) => {
    const result = await assignmentService.unassignStudentFromTeacher(
      req.params.teacherId,
      req.params.studentId
    );
    res.status(200).json({ success: true, ...result });
  }),

  // ---- GURU: Exam <-> Student ----

  // GET /api/exams/:examId/assignments
  getAssignedStudents: asyncHandler(async (req, res) => {
    const students = await assignmentService.getAssignedStudents(req.params.examId, req.user.id);
    res.status(200).json({ success: true, data: students });
  }),

  // GET /api/exams/:examId/assignments/assignable
  getAssignableStudents: asyncHandler(async (req, res) => {
    const students = await assignmentService.getAssignableStudents(req.params.examId, req.user.id);
    res.status(200).json({ success: true, data: students });
  }),

  // POST /api/exams/:examId/assignments
  // body: { studentIds: [1, 2, 3] }
  assignStudentsToExam: asyncHandler(async (req, res) => {
    const { studentIds } = req.body;
    const result = await assignmentService.assignStudentsToExam(
      req.params.examId,
      studentIds,
      req.user.id
    );
    res.status(200).json({ success: true, message: 'Siswa berhasil ditugaskan ke ujian.', data: result });
  }),

  // DELETE /api/exams/:examId/assignments/:studentId
  unassignStudentFromExam: asyncHandler(async (req, res) => {
    const result = await assignmentService.unassignStudentFromExam(
      req.params.examId,
      req.params.studentId,
      req.user.id
    );
    res.status(200).json({ success: true, ...result });
  }),
};

module.exports = assignmentController;