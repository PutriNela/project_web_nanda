/**
 * Auth Controller
 * Controller Layer - hanya menangani req/res, validasi parameter awal,
 * dan meneruskan ke Service Layer.
 */
const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const asyncHandler = require('../utils/asyncHandler');

const authController = {
  register: asyncHandler(async (req, res) => {
    const { username, password, name, roleName, email } = req.body;
    const result = await authService.register({ username, password, name, roleName, email });
    res.status(201).json({
      success: true,
      message: 'Kode OTP telah dikirim ke email Anda. Verifikasi untuk melanjutkan proses persetujuan Admin.',
      data: result,
    });
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const { username, otp } = req.body;
    const user = await authService.verifyOtp({ username, otp });
    res.status(200).json({
      success: true,
      message: 'Email berhasil diverifikasi. Akun Anda menunggu persetujuan Admin.',
      data: user,
    });
  }),

  resendOtp: asyncHandler(async (req, res) => {
    const { username } = req.body;
    const result = await authService.resendOtp({ username });
    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  }),

  login: asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const result = await authService.login({ username, password });
    res.status(200).json({
      success: true,
      message: 'Login berhasil.',
      data: result,
    });
  }),

  // GET /api/auth/me - ambil profil user yang sedang login (butuh authMiddleware)
  me: asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.user.id);
    const { password, ...safeUser } = user;
    res.status(200).json({ success: true, data: { ...safeUser, role: user.role_name } });
  }),
};

module.exports = authController;