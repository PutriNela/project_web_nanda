/**
 * Teacher Profile Service
 * Business Logic Layer - aturan bisnis untuk pengisian profil guru:
 * - Guru isi sendiri atau minta Admin
 * - Admin isi atas nama guru
 * - profile_completed di-update setelah profil tersimpan
 */
const path = require('path');
const fs = require('fs');

const teacherProfileRepository = require('../repositories/teacherProfileRepository');
const subjectRepository = require('../repositories/subjectRepository');
const pool = require('../config/db');
const AppError = require('../utils/AppError');

function deleteFileIfExists(filePath) {
  if (!filePath) return;
  // filePath bentuknya '/uploads/profiles/xxx.jpg'
  const abs = path.join(__dirname, '..', filePath);
  fs.unlink(abs, (err) => {
    if (err) console.warn('Tidak bisa hapus file lama:', err.message);
  });
}

const teacherProfileService = {

  async getProfile(userId) {
    const profile = await teacherProfileRepository.findByUserId(userId);
    if (!profile) return null;
    const subjects = await teacherProfileRepository.findSubjectsByProfile(profile.id);
    return { ...profile, subjects };
  },

  async getProfileById(profileId) {
    const profile = await teacherProfileRepository.findById(profileId);
    if (!profile) throw new AppError('Profil tidak ditemukan.', 404);
    const subjects = await teacherProfileRepository.findSubjectsByProfile(profileId);
    return { ...profile, subjects };
  },

  /**
   * Simpan atau update profil guru, lalu set profile_completed = 1.
   * Bisa dipanggil oleh guru sendiri maupun admin (atas nama guru).
   * subjectIds: array of subject id yang diajar (opsional, bisa kosong)
   */
  async saveProfile(userId, { full_name, nomor_induk, address, phone, subject_ids = [] }) {
    if (!full_name || !full_name.trim()) throw new AppError('Nama lengkap + gelar wajib diisi.');
    if (!nomor_induk || !nomor_induk.trim()) throw new AppError('Nomor induk wajib diisi.');
    if (!address || !address.trim()) throw new AppError('Alamat wajib diisi.');
    if (!phone || !phone.trim()) throw new AppError('Nomor telepon wajib diisi.');

    // Validasi nomor induk unik (kecuali milik diri sendiri)
    const [existingNI] = await pool.execute(
      `SELECT tp.user_id FROM teacher_profiles tp WHERE tp.nomor_induk = ? AND tp.user_id != ?`,
      [nomor_induk.trim(), userId]
    );
    if (existingNI.length > 0) {
      throw new AppError('Nomor induk sudah digunakan oleh guru lain.', 409);
    }

    // Validasi subject_ids yang diberikan
    const validSubjectIds = [];
    for (const sid of subject_ids) {
      const subject = await subjectRepository.findById(sid);
      if (!subject) throw new AppError(`Mata kuliah dengan ID ${sid} tidak ditemukan.`, 400);
      validSubjectIds.push(sid);
    }

    let profile = await teacherProfileRepository.findByUserId(userId);

    if (profile) {
      // Update profil yang sudah ada
      profile = await teacherProfileRepository.update(profile.id, {
        full_name: full_name.trim(),
        nomor_induk: nomor_induk.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
    } else {
      // Buat profil baru
      profile = await teacherProfileRepository.create({
        user_id: userId,
        full_name: full_name.trim(),
        nomor_induk: nomor_induk.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
    }

    // Set mata kuliah yang diajar
    await teacherProfileRepository.setSubjects(profile.id, validSubjectIds);

    // Tandai profile_completed = 1 di tabel users
    await pool.execute(
      'UPDATE users SET profile_completed = 1 WHERE id = ?',
      [userId]
    );

    // Jika ada profile_request pending milik user ini, tandai fulfilled
    const req = await teacherProfileRepository.findRequestByUserId(userId);
    if (req && req.status === 'pending') {
      await teacherProfileRepository.updateRequestStatus(userId, 'fulfilled');
    }

    const subjects = await teacherProfileRepository.findSubjectsByProfile(profile.id);
    return { ...profile, subjects };
  },

  // ---- Foto Profil ----

  async updatePhoto(userId, photoUrl) {
    const profile = await teacherProfileRepository.findByUserId(userId);
    if (!profile) throw new AppError('Profil tidak ditemukan. Lengkapi profil terlebih dahulu.', 404);
    // Hapus foto lama dari disk sebelum diganti
    deleteFileIfExists(profile.photo_url);
    return teacherProfileRepository.updatePhotoUrl(userId, photoUrl);
  },

  async removePhoto(userId) {
    const profile = await teacherProfileRepository.findByUserId(userId);
    if (!profile) throw new AppError('Profil tidak ditemukan.', 404);
    if (!profile.photo_url) throw new AppError('Tidak ada foto profil untuk dihapus.', 400);
    deleteFileIfExists(profile.photo_url);
    return teacherProfileRepository.clearPhotoUrl(userId);
  },

  // ---- Profile Requests ----

  async getMyRequest(userId) {
    return teacherProfileRepository.findRequestByUserId(userId);
  },

  async submitRequest(userId, message) {
    // Cek apakah profil sudah ada — kalau sudah, tidak perlu request
    const existing = await teacherProfileRepository.findByUserId(userId);
    if (existing) {
      throw new AppError('Profil Anda sudah terisi. Tidak perlu mengajukan permintaan.', 400);
    }

    return teacherProfileRepository.createRequest({ user_id: userId, message });
  },

  async cancelRequest(userId) {
    const req = await teacherProfileRepository.findRequestByUserId(userId);
    if (!req || req.status !== 'pending') {
      throw new AppError('Tidak ada permintaan aktif yang bisa dibatalkan.', 404);
    }
    return teacherProfileRepository.updateRequestStatus(userId, 'cancelled');
  },

  async getAllPendingRequests() {
    return teacherProfileRepository.findAllPendingRequests();
  },

  async getAllProfiles() {
    const profiles = await teacherProfileRepository.findAll();
    return Promise.all(
      profiles.map(async (p) => {
        const subjects = await teacherProfileRepository.findSubjectsByProfile(p.id);
        return { ...p, subjects };
      })
    );
  },
};

module.exports = teacherProfileService;