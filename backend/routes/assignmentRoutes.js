const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

// ---- ADMIN: kelola relasi Guru <-> Siswa ----
router.get(
  '/teachers/:teacherId/students',
  roleMiddleware('Admin'),
  assignmentController.getStudentsByTeacher
);
router.get(
  '/teachers/:teacherId/students/unassigned',
  roleMiddleware('Admin'),
  assignmentController.getUnassignedStudents
);
router.get(
  '/students/:studentId/teachers',
  roleMiddleware('Admin'),
  assignmentController.getTeachersByStudent
);
router.post(
  '/teachers/:teacherId/students',
  roleMiddleware('Admin'),
  assignmentController.assignStudentsToTeacher
);
router.delete(
  '/teachers/:teacherId/students/:studentId',
  roleMiddleware('Admin'),
  assignmentController.unassignStudentFromTeacher
);

// ---- GURU: kelola penugasan Siswa ke Ujian ----
router.get(
  '/exams/:examId/assignments',
  roleMiddleware('Guru'),
  assignmentController.getAssignedStudents
);
router.get(
  '/exams/:examId/assignments/assignable',
  roleMiddleware('Guru'),
  assignmentController.getAssignableStudents
);
router.post(
  '/exams/:examId/assignments',
  roleMiddleware('Guru'),
  assignmentController.assignStudentsToExam
);
router.delete(
  '/exams/:examId/assignments/:studentId',
  roleMiddleware('Guru'),
  assignmentController.unassignStudentFromExam
);

module.exports = router;