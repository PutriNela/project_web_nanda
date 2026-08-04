/**
 * Teacher Profile Repository
 * Data Access Layer - teacher_profiles, teacher_subjects, profile_requests.
 * Mendukung photo_url opsional.
 */
const pool = require('../config/db');

const teacherProfileRepository = {
  async findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT tp.*, u.name, u.username, u.profile_completed
       FROM teacher_profiles tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT tp.*, u.name, u.username
       FROM teacher_profiles tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async findAll() {
    const [rows] = await pool.execute(
      `SELECT tp.*, u.name, u.username, u.status, u.profile_completed
       FROM teacher_profiles tp
       JOIN users u ON u.id = tp.user_id
       ORDER BY tp.full_name ASC`
    );
    return rows;
  },

  async create({ user_id, full_name, nomor_induk, address, phone }) {
    const [result] = await pool.execute(
      `INSERT INTO teacher_profiles (user_id, full_name, nomor_induk, address, phone)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, full_name, nomor_induk, address, phone]
    );
    return this.findById(result.insertId);
  },

  async update(id, { full_name, nomor_induk, address, phone }) {
    await pool.execute(
      `UPDATE teacher_profiles SET full_name = ?, nomor_induk = ?, address = ?, phone = ? WHERE id = ?`,
      [full_name, nomor_induk, address, phone, id]
    );
    return this.findById(id);
  },

  async updatePhotoUrl(userId, photoUrl) {
    await pool.execute(
      'UPDATE teacher_profiles SET photo_url = ? WHERE user_id = ?',
      [photoUrl, userId]
    );
    return this.findByUserId(userId);
  },

  async clearPhotoUrl(userId) {
    await pool.execute(
      'UPDATE teacher_profiles SET photo_url = NULL WHERE user_id = ?',
      [userId]
    );
    return this.findByUserId(userId);
  },

  // ---- Teacher Subjects ----
  async findSubjectsByProfile(teacherProfileId) {
    const [rows] = await pool.execute(
      `SELECT s.id, s.subject_name
       FROM teacher_subjects ts
       JOIN subjects s ON s.id = ts.subject_id
       WHERE ts.teacher_profile_id = ?
       ORDER BY s.subject_name ASC`,
      [teacherProfileId]
    );
    return rows;
  },

  async setSubjects(teacherProfileId, subjectIds) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM teacher_subjects WHERE teacher_profile_id = ?', [teacherProfileId]);
      for (const sid of subjectIds) {
        await conn.execute(
          'INSERT INTO teacher_subjects (teacher_profile_id, subject_id) VALUES (?, ?)',
          [teacherProfileId, sid]
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

  // ---- Profile Requests ----
  async findRequestByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT pr.*, u.name, u.username
       FROM profile_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async findAllPendingRequests() {
    const [rows] = await pool.execute(
      `SELECT pr.*, u.name, u.username, u.created_at AS user_created_at
       FROM profile_requests pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.status = 'pending'
       ORDER BY pr.created_at ASC`
    );
    return rows;
  },

  async createRequest({ user_id, message }) {
    await pool.execute(
      `INSERT INTO profile_requests (user_id, message)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE message = VALUES(message), status = 'pending', updated_at = NOW()`,
      [user_id, message || null]
    );
    return this.findRequestByUserId(user_id);
  },

  async updateRequestStatus(userId, status) {
    await pool.execute(
      `UPDATE profile_requests SET status = ? WHERE user_id = ?`,
      [status, userId]
    );
    return this.findRequestByUserId(userId);
  },
};

module.exports = teacherProfileRepository;