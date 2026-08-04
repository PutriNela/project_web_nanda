/**
 * Exam Service
 * Business Logic Layer - CRUD ujian, Bank Soal (soal reusable), dan opsi jawaban
 * (async/await, MySQL). Validasi kepemilikan:
 * - Ujian: hanya Guru pembuat ujian yang boleh mengubah/menghapus/mengelola daftar soalnya.
 * - Soal (Bank Soal): hanya Guru penulis asli soal yang boleh mengedit/menghapus isinya.
 *   Admin boleh menghapus soal siapa pun, tapi tidak boleh mengedit isinya.
 */
const path = require('path');
const fs = require('fs');

const examRepository          = require('../repositories/examRepository');
const questionRepository      = require('../repositories/questionRepository');
const examQuestionRepository  = require('../repositories/examQuestionRepository');
const subjectRepository       = require('../repositories/subjectRepository');
const AppError = require('../utils/AppError');

const DIFFICULTIES = ['Mudah', 'Sedang', 'Sulit'];
const MAX_OPTIONS = 5; // A, B, C, D, E

function ensureOwnership(exam, teacherId) {
  if (!exam) {
    throw new AppError('Ujian tidak ditemukan.', 404);
  }
  if (Number(exam.teacher_id) !== Number(teacherId)) {
    throw new AppError('Anda tidak memiliki akses untuk mengubah ujian ini.', 403);
  }
}

// Role dengan akses penuh ke SELURUH Bank Soal (bukan cuma soal buatan sendiri).
// Guru tetap terbatas hanya mengelola soal buatannya sendiri.
function canManageAnyQuestion(role) {
  return role === 'Pengelola Soal';
}

// Guru penulis asli SATU soal, atau role "Pengelola Soal" (akses penuh ke semua soal),
// yang boleh mengedit/menghapus isi soal.
function ensureQuestionAuthor(question, actingUser) {
  if (!question) {
    throw new AppError('Soal tidak ditemukan.', 404);
  }
  if (canManageAnyQuestion(actingUser.role)) return;
  if (Number(question.teacher_id) !== Number(actingUser.id)) {
    throw new AppError('Hanya guru penulis asli soal ini yang boleh mengubahnya.', 403);
  }
}

function validateDifficulty(difficulty) {
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new AppError(`Tingkat kesulitan wajib salah satu dari: ${DIFFICULTIES.join(', ')}.`);
  }
}

function validateOptions(options) {
  if (!Array.isArray(options) || options.length < 2) {
    throw new AppError('Soal pilihan ganda minimal harus punya 2 opsi jawaban.');
  }
  if (options.length > MAX_OPTIONS) {
    throw new AppError(`Soal pilihan ganda maksimal ${MAX_OPTIONS} opsi jawaban (A-E).`);
  }
  const correctCount = options.filter((o) => o.is_correct).length;
  if (correctCount !== 1) {
    throw new AppError('Setiap soal wajib memiliki tepat satu jawaban benar.');
  }
}

function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const abs = path.join(__dirname, '..', filePath);
  fs.unlink(abs, (err) => {
    if (err) console.warn('Tidak bisa hapus file lama:', err.message);
  });
}

const examService = {
  // ---- Subjects ----
  async listSubjects() {
    return subjectRepository.findAll();
  },

  async createSubject(subjectName) {
    if (!subjectName || !subjectName.trim()) {
      throw new AppError('Nama mata pelajaran wajib diisi.');
    }
    const existing = await subjectRepository.findByName(subjectName.trim());
    if (existing) {
      throw new AppError('Mata pelajaran sudah ada.', 409);
    }
    return subjectRepository.create(subjectName.trim());
  },

  // ---- Exams ----
  async listActiveExams() {
    return examRepository.findAllActive();
  },

  async listExamsByTeacher(teacherId) {
    return examRepository.findAllByTeacher(teacherId);
  },

  async listAllExams() {
    return examRepository.findAll();
  },

  async getExamDetail(examId) {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw new AppError('Ujian tidak ditemukan.', 404);
    }
    return exam;
  },

  async createExam(teacherId, { title, subject_id, duration, minimum_score }) {
    if (!title || !subject_id || !duration || minimum_score === undefined) {
      throw new AppError('Semua field ujian wajib diisi (judul, mapel, durasi, nilai minimal).');
    }
    if (duration <= 0) {
      throw new AppError('Durasi ujian harus lebih dari 0 menit.');
    }
    if (minimum_score < 0 || minimum_score > 100) {
      throw new AppError('Nilai minimal harus berada di antara 0 - 100.');
    }

    const subject = await subjectRepository.findById(subject_id);
    if (!subject) {
      throw new AppError('Mata pelajaran tidak ditemukan.', 404);
    }

    return examRepository.create({
      title: title.trim(),
      subject_id,
      teacher_id: teacherId,
      duration,
      minimum_score,
      is_active: true,
    });
  },

  async updateExam(examId, teacherId, { title, subject_id, duration, minimum_score, is_active }) {
    const exam = await examRepository.findById(examId);
    ensureOwnership(exam, teacherId);

    if (minimum_score !== undefined && (minimum_score < 0 || minimum_score > 100)) {
      throw new AppError('Nilai minimal harus berada di antara 0 - 100.');
    }

    return examRepository.update(examId, {
      title: title ?? exam.title,
      subject_id: subject_id ?? exam.subject_id,
      duration: duration ?? exam.duration,
      minimum_score: minimum_score ?? exam.minimum_score,
      is_active: is_active ?? exam.is_active,
    });
  },

  async deleteExam(examId, teacherId) {
    const exam = await examRepository.findById(examId);
    ensureOwnership(exam, teacherId);
    await examRepository.deleteById(examId);
    return { message: 'Ujian berhasil dihapus.' };
  },

  // ---- Bank Soal ----
  // Daftar seluruh soal di Bank Soal, bisa difilter mapel & tingkat kesulitan.
  // Dipakai Guru (memilih soal untuk ujian) dan Admin (memantau/menghapus soal).
  async listQuestionBank({ subject_id, difficulty, teacher_id } = {}) {
    if (difficulty) validateDifficulty(difficulty);
    return questionRepository.findBankWithOptions({ subject_id, difficulty, teacher_id });
  },

  async getQuestionDetail(questionId) {
    const question = await questionRepository.findById(questionId);
    if (!question) throw new AppError('Soal tidak ditemukan.', 404);
    const options = await questionRepository.findOptionsByQuestion(questionId);
    return { ...question, options };
  },

  // ---- Questions (dalam konteks satu ujian) ----
  // Daftar soal yang sudah terhubung ke ujian ini (untuk Guru pemilik ujian, lengkap dengan jawaban benar)
  async getQuestionsForTeacher(examId, teacherId) {
    const exam = await examRepository.findById(examId);
    ensureOwnership(exam, teacherId);
    return questionRepository.findAllByExamWithOptions(examId);
  },

  async getQuestionsForStudent(examId) {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw new AppError('Ujian tidak ditemukan.', 404);
    }
    return questionRepository.findAllByExamForStudent(examId);
  },

  // "Buat Soal Baru": soal baru otomatis tersimpan ke Bank Soal (teacher_id = penulis)
  // sekaligus langsung terhubung ke ujian yang sedang dikelola.
  async createQuestionAndAttachToExam(examId, teacherId, { question_text, subject_id, difficulty, score_weight, options }) {
    const exam = await examRepository.findById(examId);
    ensureOwnership(exam, teacherId);

    if (!question_text || !question_text.trim()) {
      throw new AppError('Teks pertanyaan wajib diisi.');
    }
    validateDifficulty(difficulty);
    validateOptions(options);

    const resolvedSubjectId = subject_id || exam.subject_id;
    const subject = await subjectRepository.findById(resolvedSubjectId);
    if (!subject) {
      throw new AppError('Mata pelajaran soal tidak ditemukan.', 404);
    }

    const question = await questionRepository.create({
      question_text: question_text.trim(),
      subject_id: resolvedSubjectId,
      difficulty,
      teacher_id: teacherId,
      score_weight: score_weight || 1,
    });

    for (const opt of options) {
      await questionRepository.createOption({
        question_id: question.id,
        option_text: opt.option_text,
        is_correct: !!opt.is_correct,
      });
    }

    await examQuestionRepository.link(examId, question.id);

    return this.getQuestionDetail(question.id);
  },

  // Buat soal baru langsung ke Bank Soal, TANPA terhubung ke ujian mana pun.
  // Dipakai oleh Guru (opsional) dan Pengelola Soal (satu-satunya cara mereka menambah soal,
  // karena role ini tidak mengelola ujian sama sekali).
  async createStandaloneQuestion(teacherId, { question_text, subject_id, difficulty, score_weight, options }) {
    if (!question_text || !question_text.trim()) {
      throw new AppError('Teks pertanyaan wajib diisi.');
    }
    validateDifficulty(difficulty);
    validateOptions(options);

    const subject = await subjectRepository.findById(subject_id);
    if (!subject) {
      throw new AppError('Mata pelajaran soal tidak ditemukan.', 404);
    }

    const question = await questionRepository.create({
      question_text: question_text.trim(),
      subject_id,
      difficulty,
      teacher_id: teacherId,
      score_weight: score_weight || 1,
    });

    for (const opt of options) {
      await questionRepository.createOption({
        question_id: question.id,
        option_text: opt.option_text,
        is_correct: !!opt.is_correct,
      });
    }

    return this.getQuestionDetail(question.id);
  },

  // "Ambil dari Bank Soal": hubungkan soal-soal yang sudah ada ke ujian ini.
  async attachQuestionsToExam(examId, teacherId, questionIds) {
    const exam = await examRepository.findById(examId);
    ensureOwnership(exam, teacherId);

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new AppError('Pilih minimal satu soal dari Bank Soal.');
    }
    for (const qId of questionIds) {
      const question = await questionRepository.findById(qId);
      if (!question) throw new AppError(`Soal dengan id ${qId} tidak ditemukan di Bank Soal.`, 404);
    }

    await examQuestionRepository.linkMany(examId, questionIds);
    return questionRepository.findAllByExamWithOptions(examId);
  },

  // Lepas satu soal dari ujian ini saja — soal TETAP ada di Bank Soal untuk dipakai ujian lain.
  async detachQuestionFromExam(examId, questionId, teacherId) {
    const exam = await examRepository.findById(examId);
    ensureOwnership(exam, teacherId);
    await examQuestionRepository.unlink(examId, questionId);
    return { message: 'Soal dilepas dari ujian ini (tetap tersimpan di Bank Soal).' };
  },

  // ---- Mengelola isi soal (guru penulis asli, atau Pengelola Soal untuk semua soal) ----
  async updateQuestion(questionId, actingUser, { question_text, subject_id, difficulty, score_weight, options }) {
    const question = await questionRepository.findById(questionId);
    ensureQuestionAuthor(question, actingUser);

    if (difficulty !== undefined) validateDifficulty(difficulty);
    if (subject_id !== undefined) {
      const subject = await subjectRepository.findById(subject_id);
      if (!subject) throw new AppError('Mata pelajaran soal tidak ditemukan.', 404);
    }

    await questionRepository.update(questionId, {
      question_text: question_text ?? question.question_text,
      subject_id: subject_id ?? question.subject_id,
      difficulty: difficulty ?? question.difficulty,
      score_weight: score_weight ?? question.score_weight,
    });

    if (Array.isArray(options)) {
      validateOptions(options);
      await questionRepository.deleteOptionsByQuestion(questionId);
      for (const opt of options) {
        await questionRepository.createOption({
          question_id: questionId,
          option_text: opt.option_text,
          is_correct: !!opt.is_correct,
        });
      }
    }

    return this.getQuestionDetail(questionId);
  },

  // Hapus soal permanen dari Bank Soal (otomatis lepas dari semua ujian yang memakainya).
  // Boleh dilakukan oleh: guru penulis asli soal itu, Admin (moderasi), atau Pengelola Soal (akses penuh).
  async deleteQuestion(questionId, actingUser) {
    const question = await questionRepository.findById(questionId);
    if (!question) throw new AppError('Soal tidak ditemukan.', 404);

    const isAdmin = actingUser.role === 'Admin';
    if (!isAdmin) {
      ensureQuestionAuthor(question, actingUser);
    }

    // Hapus gambar soal dari disk jika ada, sebelum baris DB-nya dihapus
    deleteFileIfExists(question.image_url);
    await questionRepository.deleteById(questionId);
    return { message: 'Soal berhasil dihapus dari Bank Soal.' };
  },

  // ---- Question Image ----
  async setQuestionImage(questionId, actingUser, imageUrl) {
    const question = await questionRepository.findById(questionId);
    ensureQuestionAuthor(question, actingUser);
    // Hapus gambar lama dari disk sebelum diganti
    deleteFileIfExists(question.image_url);
    return questionRepository.updateImageUrl(questionId, imageUrl);
  },

  async removeQuestionImage(questionId, actingUser) {
    const question = await questionRepository.findById(questionId);
    ensureQuestionAuthor(question, actingUser);
    if (!question.image_url) throw new AppError('Tidak ada gambar pada soal ini.', 400);
    deleteFileIfExists(question.image_url);
    return questionRepository.clearImageUrl(questionId);
  },
};

module.exports = examService;