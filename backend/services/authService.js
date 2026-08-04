/**
 * Auth Service
 * Business Logic Layer - aturan registrasi, approval, dan login (async/await, MySQL).
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { generateOtp } = require('../utils/otp');
const { sendOtpEmail } = require('./emailService');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);
const OTP_RESEND_COOLDOWN_MINUTES = parseInt(process.env.OTP_RESEND_COOLDOWN_MINUTES || '3', 10);
const GMAIL_ONLY_REGEX = /^[^\s@]+@gmail\.com$/i;

const authService = {
  /**
   * Registrasi mandiri untuk role Guru atau Siswa.
   * Akun baru berstatus 'unverified' dan HARUS verifikasi OTP email (@gmail.com)
   * dulu sebelum berpindah ke status 'pending' (baru terlihat oleh Admin untuk approval).
   * Role 'Admin' tidak boleh dibuat lewat jalur registrasi publik.
   */
  async register({ username, password, name, roleName, email }) {
    if (!username || !password || !name || !roleName || !email) {
      throw new AppError('Semua field wajib diisi.');
    }
    if (roleName === 'Admin') {
      throw new AppError('Registrasi mandiri untuk role Admin tidak diizinkan.', 403);
    }
    if (!GMAIL_ONLY_REGEX.test(email)) {
      throw new AppError('Email harus menggunakan domain @gmail.com.');
    }

    const role = await userRepository.findRoleByName(roleName);
    if (!role) {
      throw new AppError('Role tidak valid. Pilih Guru atau Siswa.');
    }

    const existingUsername = await userRepository.findByUsername(username);
    if (existingUsername) {
      throw new AppError('Username sudah digunakan.', 409);
    }

    const existingEmail = await userRepository.findByEmail(email);
    if (existingEmail) {
      throw new AppError('Email sudah terdaftar.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await userRepository.create({
      username,
      email,
      password: hashedPassword,
      name,
      role_id: role.id,
      status: 'unverified',
    });

    const otpCode = generateOtp();
    const now = Date.now();
    await userRepository.setOtp(newUser.id, {
      otpCode,
      otpExpiresAt: now + OTP_EXPIRES_MINUTES * 60000,
      otpLastSentAt: now,
    });

    await sendOtpEmail(email, otpCode, { name, purpose: 'register' });

    return {
      username: newUser.username,
      email,
      otpExpiresInMinutes: OTP_EXPIRES_MINUTES,
      resendCooldownMinutes: OTP_RESEND_COOLDOWN_MINUTES,
    };
  },

  /**
   * Verifikasi kode OTP yang dikirim ke email. Jika benar & belum kedaluwarsa,
   * status akun berpindah dari 'unverified' -> 'pending' (masuk antrian approval Admin).
   */
  async verifyOtp({ username, otp }) {
    if (!username || !otp) {
      throw new AppError('Username dan kode OTP wajib diisi.');
    }

    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new AppError('Akun tidak ditemukan.', 404);
    }
    if (user.status !== 'unverified') {
      throw new AppError('Akun ini tidak memerlukan verifikasi OTP.', 400);
    }
    if (!user.otp_code) {
      throw new AppError('Tidak ada kode OTP aktif. Silakan kirim ulang OTP.', 400);
    }
    if (Date.now() > Number(user.otp_expires_at)) {
      throw new AppError('Kode OTP sudah kedaluwarsa. Silakan kirim ulang OTP.', 400);
    }
    if (String(otp).trim() !== String(user.otp_code)) {
      throw new AppError('Kode OTP salah.', 400);
    }

    const updated = await userRepository.markEmailVerified(user.id);
    const { password: _omit, otp_code, ...safeUser } = updated;
    return { ...safeUser, role: updated.role_name };
  },

  /**
   * Kirim ulang kode OTP baru. Dibatasi cooldown (default 3 menit) sejak
   * pengiriman OTP terakhir agar tidak disalahgunakan / spam email.
   */
  async resendOtp({ username }) {
    if (!username) {
      throw new AppError('Username wajib diisi.');
    }

    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new AppError('Akun tidak ditemukan.', 404);
    }
    if (user.status !== 'unverified') {
      throw new AppError('Akun ini tidak memerlukan verifikasi OTP.', 400);
    }

    const cooldownMs = OTP_RESEND_COOLDOWN_MINUTES * 60000;
    const elapsed = Date.now() - Number(user.otp_last_sent_at || 0);
    if (elapsed < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
      throw new AppError(`Mohon tunggu ${remainingSeconds} detik sebelum meminta kode OTP baru.`, 429);
    }

    const otpCode = generateOtp();
    const now = Date.now();
    await userRepository.setOtp(user.id, {
      otpCode,
      otpExpiresAt: now + OTP_EXPIRES_MINUTES * 60000,
      otpLastSentAt: now,
    });

    await sendOtpEmail(user.email, otpCode, { name: user.name, purpose: 'resend' });

    return {
      message: 'Kode OTP baru telah dikirim ke email Anda.',
      otpExpiresInMinutes: OTP_EXPIRES_MINUTES,
      resendCooldownMinutes: OTP_RESEND_COOLDOWN_MINUTES,
    };
  },

  /**
   * Admin membuat akun (termasuk akun Admin baru) secara langsung
   * dengan status langsung 'approved'.
   */
  async createUserByAdmin({ username, password, name, roleName }) {
    if (!username || !password || !name || !roleName) {
      throw new AppError('Semua field wajib diisi.');
    }

    const role = await userRepository.findRoleByName(roleName);
    if (!role) {
      throw new AppError('Role tidak valid.');
    }

    const existing = await userRepository.findByUsername(username);
    if (existing) {
      throw new AppError('Username sudah digunakan.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await userRepository.create({
      username,
      password: hashedPassword,
      name,
      role_id: role.id,
      status: 'approved',
    });

    const { password: _omit, ...safeUser } = newUser;
    return { ...safeUser, role: newUser.role_name };
  },

  /**
   * Login. Hanya akun berstatus 'approved' yang boleh masuk.
   */
  async login({ username, password }) {
    if (!username || !password) {
      throw new AppError('Username dan password wajib diisi.');
    }

    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new AppError('Username atau password salah.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Username atau password salah.', 401);
    }

    if (user.status === 'unverified') {
      throw new AppError('Email Anda belum diverifikasi. Silakan cek email dan masukkan kode OTP.', 403);
    }
    if (user.status === 'pending') {
      throw new AppError('Akun Anda masih menunggu persetujuan Admin.', 403);
    }
    if (user.status === 'rejected') {
      throw new AppError('Akun Anda ditolak oleh Admin.', 403);
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role_name, profile_completed: user.profile_completed },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const { password: _omit, ...safeUser } = user;
    return { token, user: { ...safeUser, role: user.role_name, profile_completed: user.profile_completed } };
  },

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new AppError('Token tidak valid atau sudah kedaluwarsa.', 401);
    }
  },
};

module.exports = authService;