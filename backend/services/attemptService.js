/**
 * Attempt Service
 * Business Logic Layer — remedial, scoring, dashboard siswa & guru.
 */
const attemptRepository       = require('../repositories/attemptRepository');
const examRepository          = require('../repositories/examRepository');
const examAssignmentRepository = require('../repositories/examAssignmentRepository');
const questionRepository      = require('../repositories/questionRepository');
const AppError = require('../utils/AppError');

const attemptService = {
  // ---- Start / Resume ----
  async startAttempt(studentId, examId) {
    const exam = await examRepository.findById(examId);
    if (!exam)           throw new AppError('Ujian tidak ditemukan.', 404);
    if (!exam.is_active) throw new AppError('Ujian ini sedang tidak aktif.', 403);

    const isAssigned = await examAssignmentRepository.exists(examId, studentId);
    if (!isAssigned) throw new AppError('Anda tidak ditugaskan untuk mengerjakan ujian ini.', 403);

    const ongoing = await attemptRepository.findOngoingAttempt(studentId, examId);
    if (ongoing) return { attempt: ongoing, resumed: true };

    const latest = await attemptRepository.findLatestByUserAndExam(studentId, examId);
    if (latest && latest.status !== 'started' && latest.final_score !== null) {
      if (Number(latest.final_score) >= Number(exam.minimum_score)) {
        throw new AppError(
          `Anda sudah lulus ujian ini dengan nilai ${latest.final_score}. Tidak bisa mengulang.`, 403
        );
      }
    }

    const completedCount = await attemptRepository.countAttemptsByUserAndExam(studentId, examId);
    const newAttempt = await attemptRepository.create({
      user_id: studentId, exam_id: examId, attempt_number: completedCount + 1,
    });
    return { attempt: newAttempt, resumed: false };
  },

  // ---- Get Questions ----
  async getAttemptQuestions(attemptId, studentId) {
    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw new AppError('Sesi ujian tidak ditemukan.', 404);
    if (Number(attempt.user_id) !== Number(studentId))
      throw new AppError('Anda tidak memiliki akses ke sesi ujian ini.', 403);
    if (attempt.status !== 'started') throw new AppError('Sesi ujian ini sudah berakhir.', 400);

    const exam           = await examRepository.findById(attempt.exam_id);
    const questions      = await questionRepository.findAllByExamForStudent(attempt.exam_id);
    const existingAnswers = await attemptRepository.findAnswersByAttempt(attemptId);
    return { attempt, exam, questions, existingAnswers };
  },

  // ---- Save Answer ----
  async saveAnswer(attemptId, studentId, { question_id, selected_option_id }) {
    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw new AppError('Sesi ujian tidak ditemukan.', 404);
    if (Number(attempt.user_id) !== Number(studentId))
      throw new AppError('Anda tidak memiliki akses ke sesi ujian ini.', 403);
    if (attempt.status !== 'started')
      throw new AppError('Sesi ujian ini sudah berakhir, jawaban tidak bisa diubah.', 400);
    return attemptRepository.saveAnswer({ exam_attempt_id: attemptId, question_id, selected_option_id });
  },

  // ---- Submit ----
  async submitAttempt(attemptId, studentId, { isTimeout = false } = {}) {
    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw new AppError('Sesi ujian tidak ditemukan.', 404);
    if (Number(attempt.user_id) !== Number(studentId))
      throw new AppError('Anda tidak memiliki akses ke sesi ujian ini.', 403);
    if (attempt.status !== 'started')
      throw new AppError('Sesi ujian ini sudah disubmit sebelumnya.', 400);

    const questions = await questionRepository.findAllByExamWithOptions(attempt.exam_id);
    const answers   = await attemptRepository.findAnswersByAttempt(attemptId);
    const answerMap = new Map(answers.map(a => [a.question_id, a.selected_option_id]));

    let totalWeight = 0, earnedWeight = 0;
    for (const q of questions) {
      const w = Number(q.score_weight);
      totalWeight += w;
      const selId = answerMap.get(q.id);
      if (selId == null) continue;
      const correct = q.options.find(o => Number(o.is_correct) === 1);
      if (correct && Number(correct.id) === Number(selId)) earnedWeight += w;
    }

    const finalScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 10000) / 100 : 0;
    const status     = isTimeout ? 'timeout' : 'submitted';
    const updated    = await attemptRepository.submit(attemptId, { final_score: finalScore, status });
    const exam       = await examRepository.findById(attempt.exam_id);
    const isPassed   = finalScore >= Number(exam.minimum_score);
    return { attempt: updated, final_score: finalScore, is_passed: isPassed, minimum_score: exam.minimum_score };
  },

  // ---- Dashboard Siswa: daftar ujian yang di-assign ----
  async getStudentExamList(studentId) {
    const exams = await examAssignmentRepository.findExamsByStudent(studentId);
    const result = [];
    for (const exam of exams) {
      const latest       = await attemptRepository.findLatestByUserAndExam(studentId, exam.id);
      const attemptCount = await attemptRepository.countAttemptsByUserAndExam(studentId, exam.id);
      let examStatus = 'belum_dikerjakan', lastScore = null;
      if (latest) {
        if (latest.status === 'started') {
          examStatus = 'sedang_berlangsung';
        } else if (latest.final_score !== null) {
          lastScore  = latest.final_score;
          examStatus = Number(latest.final_score) >= Number(exam.minimum_score) ? 'lulus' : 'harus_mengulang';
        }
      }
      result.push({
        ...exam,
        attempt_count:      attemptCount,
        last_score:         lastScore,
        exam_status:        examStatus,
        ongoing_attempt_id: examStatus === 'sedang_berlangsung' ? latest.id : null,
      });
    }
    return result;
  },

  // ---- Dashboard Siswa: daftar guru yang assign ujian ke siswa ini ----
  async getStudentTeachers(studentId) {
    const teachers = await examAssignmentRepository.findTeachersByStudent(studentId);
    // Hitung pending exams per teacher dari getStudentExamList
    const allExams = await this.getStudentExamList(studentId);
    return teachers.map(t => {
      const teacherExams = allExams.filter(e => Number(e.teacher_id) === Number(t.teacher_id));
      const pendingCount = teacherExams.filter(
        e => e.exam_status === 'belum_dikerjakan' || e.exam_status === 'harus_mengulang' || e.exam_status === 'sedang_berlangsung'
      ).length;
      return { ...t, total_exams: teacherExams.length, pending_count: pendingCount };
    });
  },

  // ---- Dashboard Guru: rekap nilai ----
  async getTeacherScoreSummary(examId, teacherId) {
    const exam = await examRepository.findById(examId);
    if (!exam) throw new AppError('Ujian tidak ditemukan.', 404);
    if (Number(exam.teacher_id) !== Number(teacherId))
      throw new AppError('Anda tidak memiliki akses ke data ujian ini.', 403);

    const summary = await attemptRepository.findAttemptSummaryByExam(examId);
    return summary.map(row => ({
      ...row,
      status: row.highest_score !== null && Number(row.highest_score) >= Number(exam.minimum_score)
        ? 'Lulus'
        : row.attempt_count > 0 ? 'Harus Mengulang' : 'Belum Dikerjakan',
    }));
  },
};

module.exports = attemptService;