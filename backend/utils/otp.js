/**
 * OTP Utility
 * Menghasilkan kode OTP numerik untuk verifikasi email.
 */
function generateOtp(length = 6) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
}

module.exports = { generateOtp };
