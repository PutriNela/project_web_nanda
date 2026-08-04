/**
 * Attempt Controller
 */
const attemptService = require('../services/attemptService');
const asyncHandler   = require('../utils/asyncHandler');

const attemptController = {
  // GET /api/student/exams
  listStudentExams: asyncHandler(async (req, res) => {
    const examsWithStatus = await attemptService.getStudentExamList(req.user.id);
    res.status(200).json({ success: true, data: examsWithStatus });
  }),

  // GET /api/student/teachers
  listStudentTeachers: asyncHandler(async (req, res) => {
    const teachers = await attemptService.getStudentTeachers(req.user.id);
    res.status(200).json({ success: true, data: teachers });
  }),

  // POST /api/exams/:id/start
  start: asyncHandler(async (req, res) => {
    const result = await attemptService.startAttempt(req.user.id, req.params.id);
    res.status(200).json({ success: true, data: result });
  }),

  // GET /api/attempts/:attemptId/questions
  getQuestions: asyncHandler(async (req, res) => {
    const result = await attemptService.getAttemptQuestions(req.params.attemptId, req.user.id);
    res.status(200).json({ success: true, data: result });
  }),

  // POST /api/attempts/:attemptId/answer
  saveAnswer: asyncHandler(async (req, res) => {
    const { question_id, selected_option_id } = req.body;
    const answer = await attemptService.saveAnswer(req.params.attemptId, req.user.id, {
      question_id, selected_option_id,
    });
    res.status(200).json({ success: true, data: answer });
  }),

  // POST /api/attempts/:attemptId/submit
  submit: asyncHandler(async (req, res) => {
    const isTimeout = !!req.body.isTimeout;
    const result = await attemptService.submitAttempt(req.params.attemptId, req.user.id, { isTimeout });
    res.status(200).json({ success: true, message: 'Ujian berhasil disubmit.', data: result });
  }),

  // GET /api/exams/:id/scores
  getScoreSummary: asyncHandler(async (req, res) => {
    const summary = await attemptService.getTeacherScoreSummary(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: summary });
  }),
};

module.exports = attemptController;