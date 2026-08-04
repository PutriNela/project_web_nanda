/**
 * Student Profile Service
 * Business Logic Layer — simpan/update profil mahasiswa,
 * validasi NIM unik, set profile_completed = 1.
 */
const studentProfileRepository = require('../repositories/studentProfileRepository');
const pool = require('../config/db');
const AppError = require('../utils/AppError');

const studentProfileService = {
  async getProfile(userId) {
    return studentProfileRepository.findByUserId(userId);
  },

  async saveProfile(userId, { full_name, nim, address, phone }) {
    if (!full_name || !full_name.trim()) throw new AppError('Nama lengkap wajib diisi.');
    if (!nim || !nim.trim())            throw new AppError('NIM wajib diisi.');
    if (!address || !address.trim())    throw new AppError('Alamat wajib diisi.');
    if (!phone || !phone.trim())        throw new AppError('Nomor telepon wajib diisi.');

    // Validasi NIM unik (kecuali milik diri sendiri)
    const [existingNim] = await pool.execute(
      `SELECT user_id FROM student_profiles WHERE nim = ? AND user_id != ?`,
      [nim.trim(), userId]
    );
    if (existingNim.length > 0) {
      throw new AppError('NIM sudah digunakan oleh mahasiswa lain.', 409);
    }

    let profile = await studentProfileRepository.findByUserId(userId);

    if (profile) {
      profile = await studentProfileRepository.update(profile.id, {
        full_name: full_name.trim(),
        nim:       nim.trim(),
        address:   address.trim(),
        phone:     phone.trim(),
      });
    } else {
      profile = await studentProfileRepository.create({
        user_id:   userId,
        full_name: full_name.trim(),
        nim:       nim.trim(),
        address:   address.trim(),
        phone:     phone.trim(),
      });
    }

    await pool.execute(
      'UPDATE users SET profile_completed = 1 WHERE id = ?',
      [userId]
    );

    return profile;
  },
};

module.exports = studentProfileService;