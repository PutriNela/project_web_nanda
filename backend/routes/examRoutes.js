const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { questionUpload } = require('../middlewares/uploadMiddleware');

// Semua route di bawah wajib login
router.use(authMiddleware);

// ---- Subjects ----
router.get('/subjects', examController.listSubjects);
router.post('/subjects', roleMiddleware('Guru', 'Admin'), examController.createSubject);

// ---- Exams ----
router.get('/exams', examController.listActive); // daftar ujian aktif (semua role)
router.get('/exams/mine', roleMiddleware('Guru'), examController.listMine);
router.get('/exams/all', roleMiddleware('Admin'), examController.listAll);
router.get('/exams/:id', examController.getDetail);
router.post('/exams', roleMiddleware('Guru'), examController.create);
router.put('/exams/:id', roleMiddleware('Guru'), examController.update);
router.delete('/exams/:id', roleMiddleware('Guru'), examController.remove);

// ---- Bank Soal (Question Bank) ----
// Guru, Admin & Pengelola Soal bisa melihat Bank Soal (Guru: pakai di ujian; Admin: moderasi; Pengelola Soal: kelola miliknya)
router.get('/questions/bank', roleMiddleware('Guru', 'Admin', 'Pengelola Soal'), examController.listQuestionBank);
router.get('/questions/:questionId', roleMiddleware('Guru', 'Admin', 'Pengelola Soal'), examController.getQuestionDetail);
// Buat soal baru langsung ke Bank Soal tanpa terhubung ke ujian (satu-satunya cara Pengelola Soal menambah soal)
router.post('/questions', roleMiddleware('Guru', 'Pengelola Soal'), examController.createStandaloneQuestion);

// ---- Questions (dalam konteks satu ujian) ----
router.get('/exams/:id/questions', roleMiddleware('Guru'), examController.getQuestionsForTeacher);
// "Buat Soal Baru" -> otomatis masuk Bank Soal + terhubung ke ujian ini
router.post('/exams/:id/questions', roleMiddleware('Guru'), examController.createAndAttachQuestion);
// "Ambil dari Bank Soal" -> hubungkan soal yang sudah ada ke ujian ini
router.post('/exams/:id/questions/attach', roleMiddleware('Guru'), examController.attachExistingQuestions);
// Lepas soal dari ujian ini saja (soal tetap ada di Bank Soal)
router.delete('/exams/:id/questions/:questionId', roleMiddleware('Guru'), examController.detachQuestion);

// ---- Questions (scoped to question id, langsung ke Bank Soal) ----
// Edit isi soal: hanya guru/pengelola soal penulis asli (dicek di service layer)
router.put('/questions/:questionId', roleMiddleware('Guru', 'Pengelola Soal'), examController.updateQuestion);
// Hapus permanen dari Bank Soal: penulis asli ATAU Admin (dicek di service layer)
router.delete('/questions/:questionId', roleMiddleware('Guru', 'Admin', 'Pengelola Soal'), examController.deleteQuestion);

// ---- Question Image ----
router.post('/questions/:questionId/image', roleMiddleware('Guru', 'Pengelola Soal'), questionUpload, examController.uploadQuestionImage);
router.delete('/questions/:questionId/image', roleMiddleware('Guru', 'Pengelola Soal'), examController.deleteQuestionImage);

module.exports = router;