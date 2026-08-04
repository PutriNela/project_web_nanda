/**
 * Exam Controller
 * Controller Layer - CRUD mata pelajaran, ujian, Bank Soal, dan opsi jawaban.
 */
const examService = require('../services/examService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const examController = {
  // ---- Subjects ----
  // GET /api/subjects
  listSubjects: asyncHandler(async (req, res) => {
    const subjects = await examService.listSubjects();
    res.status(200).json({ success: true, data: subjects });
  }),

  // POST /api/subjects
  createSubject: asyncHandler(async (req, res) => {
    const subject = await examService.createSubject(req.body.subject_name);
    res.status(201).json({ success: true, data: subject });
  }),

  // ---- Exams ----
  // GET /api/exams - daftar ujian aktif (untuk Siswa)
  listActive: asyncHandler(async (req, res) => {
    const exams = await examService.listActiveExams();
    res.status(200).json({ success: true, data: exams });
  }),

  // GET /api/exams/mine - daftar ujian milik Guru yang login
  listMine: asyncHandler(async (req, res) => {
    const exams = await examService.listExamsByTeacher(req.user.id);
    res.status(200).json({ success: true, data: exams });
  }),

  // GET /api/exams/all - daftar semua ujian (untuk Admin)
  listAll: asyncHandler(async (req, res) => {
    const exams = await examService.listAllExams();
    res.status(200).json({ success: true, data: exams });
  }),

  // GET /api/exams/:id
  getDetail: asyncHandler(async (req, res) => {
    const exam = await examService.getExamDetail(req.params.id);
    res.status(200).json({ success: true, data: exam });
  }),

  // POST /api/exams
  create: asyncHandler(async (req, res) => {
    const { title, subject_id, duration, minimum_score } = req.body;
    const exam = await examService.createExam(req.user.id, {
      title,
      subject_id,
      duration,
      minimum_score,
    });
    res.status(201).json({ success: true, message: 'Ujian berhasil dibuat.', data: exam });
  }),

  // PUT /api/exams/:id
  update: asyncHandler(async (req, res) => {
    const { title, subject_id, duration, minimum_score, is_active } = req.body;
    const exam = await examService.updateExam(req.params.id, req.user.id, {
      title,
      subject_id,
      duration,
      minimum_score,
      is_active,
    });
    res.status(200).json({ success: true, message: 'Ujian berhasil diperbarui.', data: exam });
  }),

  // DELETE /api/exams/:id
  remove: asyncHandler(async (req, res) => {
    const result = await examService.deleteExam(req.params.id, req.user.id);
    res.status(200).json({ success: true, ...result });
  }),

  // ---- Bank Soal ----
  // GET /api/questions/bank?subject_id=&difficulty=&teacher_id=
  listQuestionBank: asyncHandler(async (req, res) => {
    const { subject_id, difficulty, teacher_id } = req.query;
    const questions = await examService.listQuestionBank({
      subject_id: subject_id || undefined,
      difficulty: difficulty || undefined,
      teacher_id: teacher_id || undefined,
    });
    res.status(200).json({ success: true, data: questions });
  }),

  // POST /api/questions — buat soal baru langsung ke Bank Soal (tanpa terhubung ke ujian mana pun)
  createStandaloneQuestion: asyncHandler(async (req, res) => {
    const { question_text, subject_id, difficulty, score_weight, options } = req.body;
    const question = await examService.createStandaloneQuestion(req.user.id, {
      question_text,
      subject_id,
      difficulty,
      score_weight,
      options,
    });
    res.status(201).json({ success: true, message: 'Soal baru berhasil ditambahkan ke Bank Soal.', data: question });
  }),

  // GET /api/questions/:questionId
  getQuestionDetail: asyncHandler(async (req, res) => {
    const question = await examService.getQuestionDetail(req.params.questionId);
    res.status(200).json({ success: true, data: question });
  }),

  // ---- Questions (dalam konteks satu ujian) ----
  // GET /api/exams/:id/questions (Guru pemilik ujian, lengkap dengan jawaban benar)
  getQuestionsForTeacher: asyncHandler(async (req, res) => {
    const questions = await examService.getQuestionsForTeacher(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: questions });
  }),

  // POST /api/exams/:id/questions — "Buat Soal Baru" (otomatis masuk Bank Soal + terhubung ke ujian ini)
  createAndAttachQuestion: asyncHandler(async (req, res) => {
    const { question_text, subject_id, difficulty, score_weight, options } = req.body;
    const question = await examService.createQuestionAndAttachToExam(req.params.id, req.user.id, {
      question_text,
      subject_id,
      difficulty,
      score_weight,
      options,
    });
    res.status(201).json({ success: true, message: 'Soal baru berhasil ditambahkan ke Bank Soal dan ujian ini.', data: question });
  }),

  // POST /api/exams/:id/questions/attach — "Ambil dari Bank Soal"
  attachExistingQuestions: asyncHandler(async (req, res) => {
    const { question_ids } = req.body;
    const questions = await examService.attachQuestionsToExam(req.params.id, req.user.id, question_ids);
    res.status(200).json({ success: true, message: 'Soal dari Bank Soal berhasil ditambahkan ke ujian ini.', data: questions });
  }),

  // DELETE /api/exams/:id/questions/:questionId — lepas soal dari ujian ini saja (tetap ada di Bank Soal)
  detachQuestion: asyncHandler(async (req, res) => {
    const result = await examService.detachQuestionFromExam(req.params.id, req.params.questionId, req.user.id);
    res.status(200).json({ success: true, ...result });
  }),

  // PUT /api/questions/:questionId — edit isi soal (hanya guru penulis asli)
  updateQuestion: asyncHandler(async (req, res) => {
    const { question_text, subject_id, difficulty, score_weight, options } = req.body;
    const question = await examService.updateQuestion(req.params.questionId, req.user, {
      question_text,
      subject_id,
      difficulty,
      score_weight,
      options,
    });
    res.status(200).json({ success: true, message: 'Soal berhasil diperbarui.', data: question });
  }),

  // DELETE /api/questions/:questionId — hapus permanen dari Bank Soal
  // (guru penulis asli, atau Admin untuk moderasi)
  deleteQuestion: asyncHandler(async (req, res) => {
    const result = await examService.deleteQuestion(req.params.questionId, req.user);
    res.status(200).json({ success: true, ...result });
  }),

  // ---- Question Image ----
  // POST /api/questions/:questionId/image — multipart, field: image
  uploadQuestionImage: asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('File gambar tidak ditemukan.', 400);
    const imageUrl = `/uploads/questions/${req.file.filename}`;
    const question = await examService.setQuestionImage(req.params.questionId, req.user, imageUrl);
    res.status(200).json({
      success: true,
      message: 'Gambar soal berhasil diunggah.',
      data: { image_url: imageUrl, question },
    });
  }),

  // DELETE /api/questions/:questionId/image
  deleteQuestionImage: asyncHandler(async (req, res) => {
    await examService.removeQuestionImage(req.params.questionId, req.user);
    res.status(200).json({ success: true, message: 'Gambar soal berhasil dihapus.' });
  }),
};

module.exports = examController;