const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimitMiddleware');

// Endpoint di bawah ini rawan brute-force/spam (login, register, OTP) — pakai limiter lebih ketat
// dari batas global (10 percobaan/15 menit per IP), di atas rate limit global yang berlaku di server.js.
router.post('/register',    authLimiter, authController.register);
router.post('/verify-otp',  authLimiter, authController.verifyOtp);
router.post('/resend-otp',  authLimiter, authController.resendOtp);
router.post('/login',       authLimiter, authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;