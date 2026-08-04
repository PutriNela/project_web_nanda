/**
 * User Service
 * Business Logic Layer - manajemen user oleh Admin (approval akun, daftar user).
 * Async/await, MySQL.
 */
const userRepository = require('../repositories/userRepository');
const examRepository = require('../repositories/examRepository');
const AppError = require('../utils/AppError');

const userService = {
  async listPendingUsers() {
    return userRepository.findAllByStatus('pending');
  },

  async listAllUsers() {
    const users = await userRepository.findAll();
    return users.map(({ password, ...rest }) => rest);
  },

  /**
   * Setujui akun (Guru/Siswa) yang mendaftar mandiri.
   */
  async approveUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User tidak ditemukan.', 404);
    }
    if (user.status === 'approved') {
      throw new AppError('User sudah disetujui sebelumnya.', 409);
    }
    const updated = await userRepository.updateStatus(userId, 'approved');
    const { password, ...safeUser } = updated;
    return safeUser;
  },

  /**
   * Tolak akun yang mendaftar mandiri.
   */
  async rejectUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User tidak ditemukan.', 404);
    }
    const updated = await userRepository.updateStatus(userId, 'rejected');
    const { password, ...safeUser } = updated;
    return safeUser;
  },

  async getTeachers() {
    return userRepository.findAllByRole('Guru');
  },

  async getStudents() {
    return userRepository.findAllByRole('Siswa');
  },

  async deleteUser(userId, requesterId) {
    if (Number(userId) === Number(requesterId)) {
      throw new AppError('Tidak bisa menghapus akun sendiri.', 400);
    }
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User tidak ditemukan.', 404);
    }

    // Ujian "dimiliki" oleh guru pembuatnya (FK teacher_id sengaja tidak di-cascade,
    // supaya menghapus akun guru tidak diam-diam menghapus ujian + seluruh riwayat
    // pengerjaan siswa). Cek dulu supaya adminnya dapat pesan yang jelas.
    if (user.role_name === 'Guru') {
      const exams = await examRepository.findAllByTeacher(userId);
      if (exams.length > 0) {
        throw new AppError(
          `Tidak bisa menghapus akun ini karena masih memiliki ${exams.length} ujian. Hapus atau alihkan ujian tersebut terlebih dahulu.`,
          409
        );
      }
    }

    try {
      await userRepository.deleteById(userId);
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
        throw new AppError(
          'Akun ini masih terhubung dengan data lain di sistem sehingga tidak bisa dihapus.',
          409
        );
      }
      throw err;
    }

    return { message: 'User berhasil dihapus.' };
  },
};

module.exports = userService;
