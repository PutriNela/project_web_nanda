/**
 * Email Service
 * Mengirim email verifikasi OTP lewat SMTP Gmail (Nodemailer).
 *
 * Wajib diset di .env:
 *   EMAIL_USER           -> alamat Gmail pengirim
 *   EMAIL_APP_PASSWORD   -> App Password Gmail (bukan password akun biasa),
 *                           dibuat di: Akun Google > Keamanan > Verifikasi 2 Langkah > App Passwords
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);

/**
 * Kirim kode OTP ke email calon user.
 * @param {string} to - alamat email tujuan (@gmail.com)
 * @param {string} otp - kode OTP 6 digit
 * @param {{ name?: string, purpose?: 'register'|'resend' }} opts
 */
async function sendOtpEmail(to, otp, { name = '', purpose = 'register' } = {}) {
  // Kode OTP ditaruh di subject (pola yang dipakai Google/WhatsApp/dll) supaya:
  // 1) langsung kelihatan di preview notifikasi tanpa perlu buka email
  // 2) subject jadi unik tiap kirim, tidak template statis yang gampang dihafal spam filter
  const subject = purpose === 'resend'
    ? `${otp} adalah kode verifikasi baru Anda - CBT App`
    : `${otp} adalah kode verifikasi Anda - CBT App`;

  const greeting = name ? `Halo ${name},` : 'Halo,';

  // Sengaja dibuat sesederhana mungkin, mirip email personal biasa - bukan
  // template "kotak kode warna-warni" khas email marketing/OTP massal yang
  // sering dikenali sebagai pola spam oleh Gmail.
  const text = `${greeting}

Kode verifikasi Anda: ${otp}

Kode ini berlaku ${OTP_EXPIRES_MINUTES} menit. Abaikan email ini jika Anda tidak meminta kode ini.

- CBT App`;

  const html = `
    <div style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
      <div style="max-width: 440px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="padding: 24px 28px 0 28px;">
          <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: #6366f1; text-transform: uppercase;">CBT App</p>
          <h1 style="margin: 0 0 16px 0; font-size: 19px; font-weight: 600; color: #0f172a;">Kode Verifikasi Email</h1>
        </div>
        <div style="padding: 0 28px;">
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">${greeting}</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
            Gunakan kode berikut untuk memverifikasi email pendaftaran akun Anda.
          </p>
          <div style="margin: 0 0 20px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #0f172a;">${otp}</span>
          </div>
          <p style="margin: 0 0 4px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
            Kode berlaku selama ${OTP_EXPIRES_MINUTES} menit.
          </p>
          <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
            Abaikan email ini jika Anda tidak meminta kode ini.
          </p>
        </div>
        <div style="padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">CBT App &mdash; Computer Based Test</p>
        </div>
      </div>
    </div>
  `;

  try {
    const info = await getTransporter().sendMail({
      from: `"CBT App" <${process.env.EMAIL_USER}>`,
      replyTo: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    });
    // Log status pengiriman biar gampang dilacak kalau ada yang komplain "OTP tidak sampai".
    console.log(
      `[emailService] OTP terkirim ke ${to} | messageId=${info.messageId} | response=${info.response}`
    );
    if (info.rejected && info.rejected.length > 0) {
      console.warn(`[emailService] Email ditolak server untuk: ${info.rejected.join(', ')}`);
    }
    return info;
  } catch (err) {
    console.error(`[emailService] Gagal kirim OTP ke ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendOtpEmail };