/**
 * Migration Script (MySQL via XAMPP)
 * Jalankan dengan: npm run migrate
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST     = process.env.DB_HOST     || '127.0.0.1';
const DB_PORT     = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER     = process.env.DB_USER     || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME     = process.env.DB_NAME     || 'cbt_app';

async function migrate() {
  console.log('Menjalankan migrasi database MySQL...');

  const rootConn = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD,
  });
  await rootConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`Database "${DB_NAME}" siap.`);
  await rootConn.end();

  const conn = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD,
    database: DB_NAME, multipleStatements: true,
  });

  // ----------------------------------------------------------------
  // CORE TABLES
  // ----------------------------------------------------------------
  await conn.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      role_name VARCHAR(20) NOT NULL UNIQUE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS users (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      username          VARCHAR(100) NOT NULL UNIQUE,
      email             VARCHAR(150) NULL UNIQUE,
      password          VARCHAR(255) NOT NULL,
      name              VARCHAR(150) NOT NULL,
      role_id           INT NOT NULL,
      status            ENUM('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified',
      email_verified    TINYINT(1) NOT NULL DEFAULT 0,
      otp_code          VARCHAR(10) NULL,
      otp_expires_at    BIGINT NULL,
      otp_last_sent_at  BIGINT NULL,
      profile_completed TINYINT(1) NOT NULL DEFAULT 0,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS subjects (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      subject_name VARCHAR(150) NOT NULL UNIQUE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS exams (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      title         VARCHAR(255) NOT NULL,
      subject_id    INT NOT NULL,
      teacher_id    INT NOT NULL,
      duration      INT NOT NULL,
      minimum_score DECIMAL(5,2) NOT NULL DEFAULT 75,
      is_active     TINYINT(1) NOT NULL DEFAULT 1,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_exams_subject FOREIGN KEY (subject_id) REFERENCES subjects(id),
      CONSTRAINT fk_exams_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS questions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      question_text TEXT NOT NULL,
      subject_id    INT NULL,
      difficulty    ENUM('Mudah','Sedang','Sulit') NOT NULL DEFAULT 'Sedang',
      teacher_id    INT NULL,
      score_weight  DECIMAL(5,2) NOT NULL DEFAULT 1,
      image_url     VARCHAR(500) NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_questions_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
      CONSTRAINT fk_questions_teacher FOREIGN KEY (teacher_id) REFERENCES users(id)    ON DELETE SET NULL
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS options (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      question_id INT NOT NULL,
      option_text TEXT NOT NULL,
      is_correct  TINYINT(1) NOT NULL DEFAULT 0,
      CONSTRAINT fk_options_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS exam_attempts (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      user_id        INT NOT NULL,
      exam_id        INT NOT NULL,
      start_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time       DATETIME NULL,
      final_score    DECIMAL(5,2) NULL,
      status         ENUM('started','submitted','timeout') NOT NULL DEFAULT 'started',
      attempt_number INT NOT NULL DEFAULT 1,
      CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_attempts_exam FOREIGN KEY (exam_id) REFERENCES exams(id)
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS student_answers (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      exam_attempt_id    INT NOT NULL,
      question_id        INT NOT NULL,
      selected_option_id INT NULL,
      CONSTRAINT fk_answers_attempt  FOREIGN KEY (exam_attempt_id)   REFERENCES exam_attempts(id) ON DELETE CASCADE,
      CONSTRAINT fk_answers_question FOREIGN KEY (question_id)        REFERENCES questions(id),
      CONSTRAINT fk_answers_option   FOREIGN KEY (selected_option_id) REFERENCES options(id)
    ) ENGINE=InnoDB;
  `);

  // ----------------------------------------------------------------
  // ASSIGNMENT TABLES
  // ----------------------------------------------------------------
  await conn.query(`
    CREATE TABLE IF NOT EXISTS teacher_students (
      teacher_id  INT NOT NULL,
      student_id  INT NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (teacher_id, student_id),
      CONSTRAINT fk_ts_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_ts_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS exam_assignments (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      exam_id     INT NOT NULL,
      student_id  INT NOT NULL,
      assigned_by INT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_assignment (exam_id, student_id),
      CONSTRAINT fk_ea_exam        FOREIGN KEY (exam_id)     REFERENCES exams(id) ON DELETE CASCADE,
      CONSTRAINT fk_ea_student     FOREIGN KEY (student_id)  REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_ea_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  // ----------------------------------------------------------------
  // TEACHER PROFILE TABLES
  // ----------------------------------------------------------------
  await conn.query(`
    CREATE TABLE IF NOT EXISTS teacher_profiles (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL UNIQUE,
      full_name   VARCHAR(200) NOT NULL,
      nomor_induk VARCHAR(50)  NOT NULL UNIQUE,
      address     TEXT         NOT NULL,
      phone       VARCHAR(30)  NOT NULL,
      photo_url   VARCHAR(500) NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS teacher_subjects (
      teacher_profile_id INT NOT NULL,
      subject_id         INT NOT NULL,
      PRIMARY KEY (teacher_profile_id, subject_id),
      CONSTRAINT fk_tsubj_profile FOREIGN KEY (teacher_profile_id) REFERENCES teacher_profiles(id) ON DELETE CASCADE,
      CONSTRAINT fk_tsubj_subject FOREIGN KEY (subject_id)         REFERENCES subjects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;

    CREATE TABLE IF NOT EXISTS profile_requests (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL UNIQUE,
      message    TEXT NULL,
      status     ENUM('pending','fulfilled','cancelled') NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ----------------------------------------------------------------
  // STUDENT PROFILE TABLE
  // ----------------------------------------------------------------
  await conn.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL UNIQUE,
      full_name  VARCHAR(200) NOT NULL,
      nim        VARCHAR(50)  NOT NULL UNIQUE,
      address    TEXT         NOT NULL,
      phone      VARCHAR(30)  NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_stup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // ----------------------------------------------------------------
  // ALTER: profile_completed (safe re-run)
  // ----------------------------------------------------------------
  await conn.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_completed TINYINT(1) NOT NULL DEFAULT 0;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });

  // ----------------------------------------------------------------
  // ALTER: fitur upload (gambar soal & foto profil guru), safe re-run
  // ----------------------------------------------------------------
  await conn.query(`
    ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) NULL;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });
  await conn.query(`
    ALTER TABLE teacher_profiles
      ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500) NULL;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });

  // ----------------------------------------------------------------
  // ALTER: email verification / OTP (safe re-run, upgrade dari skema lama)
  // ----------------------------------------------------------------
  await conn.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL UNIQUE AFTER username;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });
  await conn.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) NOT NULL DEFAULT 0;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });
  await conn.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10) NULL;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });
  await conn.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS otp_expires_at BIGINT NULL;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });
  await conn.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS otp_last_sent_at BIGINT NULL;
  `).catch(err => {
    if (!/Duplicate column/i.test(err.message)) throw err;
  });
  // Tambahkan status 'unverified' ke ENUM jika database lama belum punya.
  await conn.query(`
    ALTER TABLE users
      MODIFY COLUMN status ENUM('unverified','pending','approved','rejected') NOT NULL DEFAULT 'unverified';
  `);

  // ----------------------------------------------------------------
  // ALTER: perbaiki FK agar hapus akun (hard delete) tidak gagal
  // - exam_attempts.user_id: ikut terhapus (data attempt milik user itu sendiri)
  // - exam_assignments.assigned_by: di-set NULL (assignment ke siswa tetap ada,
  //   hanya info "siapa yang meng-assign" yang hilang kalau assigner dihapus)
  // Aman dijalankan berkali-kali: drop FK lama diabaikan kalau tidak ada,
  // add FK baru diabaikan kalau ternyata sudah sesuai.
  // ----------------------------------------------------------------
  await conn.query(`ALTER TABLE exam_attempts DROP FOREIGN KEY fk_attempts_user;`).catch(() => {});
  await conn.query(`
    ALTER TABLE exam_attempts
      ADD CONSTRAINT fk_attempts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  `).catch(err => {
    if (!/Duplicate|already exists/i.test(err.message)) throw err;
  });

  await conn.query(`ALTER TABLE exam_assignments DROP FOREIGN KEY fk_ea_assigned_by;`).catch(() => {});
  await conn.query(`
    ALTER TABLE exam_assignments MODIFY COLUMN assigned_by INT NULL;
  `);
  await conn.query(`
    ALTER TABLE exam_assignments
      ADD CONSTRAINT fk_ea_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
  `).catch(err => {
    if (!/Duplicate|already exists/i.test(err.message)) throw err;
  });

  // ----------------------------------------------------------------
  // ALTER: Bank Soal (Question Bank) — relasi many-to-many exams<->questions
  // Soal jadi reusable (tidak lagi terikat langsung ke satu ujian).
  // Aman dijalankan berkali-kali (idempotent).
  // ----------------------------------------------------------------

  // 1) Tabel pivot exam_questions (many-to-many)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS exam_questions (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      exam_id     INT NOT NULL,
      question_id INT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_exam_question (exam_id, question_id),
      CONSTRAINT fk_eq_exam     FOREIGN KEY (exam_id)     REFERENCES exams(id)     ON DELETE CASCADE,
      CONSTRAINT fk_eq_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  // 2) Kolom baru di questions: subject_id, difficulty, teacher_id (penulis soal)
  await conn.query(`
    ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS subject_id INT NULL AFTER question_text;
  `).catch(err => { if (!/Duplicate column/i.test(err.message)) throw err; });
  await conn.query(`
    ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS difficulty ENUM('Mudah','Sedang','Sulit') NOT NULL DEFAULT 'Sedang' AFTER subject_id;
  `).catch(err => { if (!/Duplicate column/i.test(err.message)) throw err; });
  await conn.query(`
    ALTER TABLE questions
      ADD COLUMN IF NOT EXISTS teacher_id INT NULL AFTER difficulty;
  `).catch(err => { if (!/Duplicate column/i.test(err.message)) throw err; });

  // 3) Migrasi data lama: pindahkan relasi questions.exam_id -> pivot exam_questions,
  //    lalu backfill subject_id & teacher_id dari ujian asalnya (jika masih kosong).
  //    Hanya berjalan kalau kolom exam_id masih ada (skema lama, sebelum di-drop di bawah).
  const [examIdColRows] = await conn.query(`
    SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'questions' AND COLUMN_NAME = 'exam_id'
  `, [DB_NAME]);
  if (examIdColRows[0].cnt > 0) {
    await conn.query(`
      INSERT IGNORE INTO exam_questions (exam_id, question_id)
      SELECT exam_id, id FROM questions WHERE exam_id IS NOT NULL;
    `);
    await conn.query(`
      UPDATE questions q
      JOIN exams e ON e.id = q.exam_id
      SET q.subject_id = e.subject_id
      WHERE q.exam_id IS NOT NULL AND q.subject_id IS NULL;
    `);
    await conn.query(`
      UPDATE questions q
      JOIN exams e ON e.id = q.exam_id
      SET q.teacher_id = e.teacher_id
      WHERE q.exam_id IS NOT NULL AND q.teacher_id IS NULL;
    `);
    // Setelah data dipindah ke pivot, kolom exam_id & FK lamanya sudah tidak dipakai lagi.
    await conn.query(`ALTER TABLE questions DROP FOREIGN KEY fk_questions_exam;`).catch(() => {});
    await conn.query(`ALTER TABLE questions DROP COLUMN exam_id;`).catch(err => {
      if (!/check that column\/key exists/i.test(err.message)) throw err;
    });
  }

  // 4) FK subject_id & teacher_id di questions (soal tetap ada di Bank Soal
  //    walau mapel/gurunya dihapus — SET NULL, bukan CASCADE, supaya bank soal tidak hilang).
  await conn.query(`ALTER TABLE questions DROP FOREIGN KEY fk_questions_subject;`).catch(() => {});
  await conn.query(`
    ALTER TABLE questions
      ADD CONSTRAINT fk_questions_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
  `).catch(err => { if (!/Duplicate|already exists/i.test(err.message)) throw err; });

  await conn.query(`ALTER TABLE questions DROP FOREIGN KEY fk_questions_teacher;`).catch(() => {});
  await conn.query(`
    ALTER TABLE questions
      ADD CONSTRAINT fk_questions_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;
  `).catch(err => { if (!/Duplicate|already exists/i.test(err.message)) throw err; });

  // ----------------------------------------------------------------
  // INDEXES
  // ----------------------------------------------------------------
  const indexes = [
    'CREATE INDEX idx_users_role          ON users(role_id)',
    'CREATE INDEX idx_exams_teacher        ON exams(teacher_id)',
    'CREATE INDEX idx_exams_subject        ON exams(subject_id)',
    'CREATE INDEX idx_questions_subject    ON questions(subject_id)',
    'CREATE INDEX idx_questions_difficulty ON questions(difficulty)',
    'CREATE INDEX idx_questions_teacher    ON questions(teacher_id)',
    'CREATE INDEX idx_eq_exam              ON exam_questions(exam_id)',
    'CREATE INDEX idx_eq_question          ON exam_questions(question_id)',
    'CREATE INDEX idx_options_question     ON options(question_id)',
    'CREATE INDEX idx_attempts_user_exam   ON exam_attempts(user_id, exam_id)',
    'CREATE INDEX idx_answers_attempt      ON student_answers(exam_attempt_id)',
    'CREATE INDEX idx_ts_student           ON teacher_students(student_id)',
    'CREATE INDEX idx_ea_student           ON exam_assignments(student_id)',
    'CREATE INDEX idx_ea_exam              ON exam_assignments(exam_id)',
    'CREATE INDEX idx_ea_assigned_by       ON exam_assignments(assigned_by)',
    'CREATE INDEX idx_tp_user              ON teacher_profiles(user_id)',
    'CREATE INDEX idx_pr_status            ON profile_requests(status)',
    'CREATE INDEX idx_stup_user            ON student_profiles(user_id)',
  ];
  for (const sql of indexes) {
    await conn.query(sql).catch(err => {
      if (!/Duplicate key name/i.test(err.message)) throw err;
    });
  }

  console.log('Migrasi selesai. Seluruh tabel berhasil dibuat/diverifikasi.');
  await conn.end();
}

migrate().catch(err => {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
});