import { app } from '../core/dom.js';
import { Store } from '../core/store.js';
import { api } from '../core/api.js';
import { toast } from '../core/utils.js';
import { navigate, dashboardHashFor } from '../core/router.js';

// ---- Ikon mata (show/hide password) ----
const EYE_OPEN_SVG = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
</svg>`;
const EYE_OFF_SVG = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.847 0 1.669-.105 2.454-.303M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
</svg>`;

// Bungkus sebuah <input type="password"> dengan tombol ikon mata untuk toggle show/hide
function passwordFieldHtml({ name, label, autocomplete, required = true, minlength }) {
  return `
    <div>
      <label class="label">${label}</label>
      <div class="relative">
        <input class="input pr-11" type="password" name="${name}" ${required ? 'required' : ''}
               ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${minlength ? `minlength="${minlength}"` : ''}>
        <button type="button" data-toggle-password
                class="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors">
          ${EYE_OPEN_SVG}
        </button>
      </div>
    </div>`;
}

// Aktifkan semua tombol toggle password di dalam root yang diberikan
function attachPasswordToggles(root) {
  root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = isHidden ? EYE_OFF_SVG : EYE_OPEN_SVG;
    });
  });
}

// Animasi loading ala Material Design (Google): progress bar tipis di atas card
// + spinner pada tombol submit + form dikunci sementara.
function setFormLoading(form, submitBtn, submitLabel, progressBar, isLoading, loadingText) {
  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75');
    submitLabel.innerHTML = `
      <span class="inline-flex items-center gap-2">
        <span class="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
        ${loadingText}
      </span>`;
    progressBar.classList.remove('hidden');
    [...form.elements].forEach((el) => {
      if (el !== submitBtn) {
        el.disabled = true;
        el.classList.add('opacity-60');
      }
    });
  } else {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-75');
    submitLabel.textContent = submitLabel.dataset.idleText || submitLabel.textContent;
    progressBar.classList.add('hidden');
    [...form.elements].forEach((el) => {
      el.disabled = false;
      el.classList.remove('opacity-60');
    });
  }
}

export function renderLogin() {
  const LOGIN_SUCCESS_DELAY_MS = 1000; // jeda animasi ala Google setelah login sukses
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <div class="text-center mb-7">
          <div class="w-14 h-14 rounded-2xl bg-brand-500 mx-auto mb-3 flex items-center justify-center text-2xl shadow-[var(--shadow-soft)]">🐻</div>
          <h1 class="text-2xl font-bold tracking-tight text-ink font-heading">Halo Sahabat Pintar!</h1>
          <p class="text-sm text-slate-500 mt-1">Ayo masuk ke ruang ujianmu</p>
        </div>
        <div class="auth-card p-6 relative overflow-hidden">
          <div id="login-progress" class="linear-progress absolute top-0 left-0 hidden"></div>
          <form id="login-form" class="space-y-4">
            <div>
              <label class="label">Username</label>
              <input class="input" type="text" name="username" required autocomplete="username" placeholder="Tulis nama penggunamu">
            </div>
            ${passwordFieldHtml({ name: 'password', label: 'Password', autocomplete: 'current-password' })}
            <button type="submit" id="login-submit-btn" class="btn btn-primary w-full">
              <span id="login-submit-label" data-idle-text="Masuk Yuk! 🚀">Masuk Yuk! 🚀</span>
            </button>
          </form>
          <p class="text-sm text-slate-500 mt-4 text-center">
            Belum punya akun?
            <a href="#register" class="text-[#e94a76] font-semibold hover:underline">Daftar di sini</a>
          </p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  attachPasswordToggles(form);

  const submitBtn = document.getElementById('login-submit-btn');
  const submitLabel = document.getElementById('login-submit-label');
  const progressBar = document.getElementById('login-progress');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setFormLoading(form, submitBtn, submitLabel, progressBar, true, 'Memeriksa akun...');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        auth: false,
        body: { username: fd.get('username'), password: fd.get('password') },
      });
      Store.token = result.token;
      Store.user = result.user;
      // Tetap tampilkan animasi loading sejenak walau prosesnya instan di lokal,
      // supaya transisinya terasa halus (mirip alur login Google).
      submitLabel.innerHTML = `
        <span class="inline-flex items-center gap-2">
          <span class="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
          Berhasil, masuk...
        </span>`;
      setTimeout(() => {
        toast('Login berhasil.', 'success');
        navigate(dashboardHashFor(result.user));
      }, LOGIN_SUCCESS_DELAY_MS);
    } catch (err) {
      toast(err.message, 'error');
      setFormLoading(form, submitBtn, submitLabel, progressBar, false);
    }
  });
}

export function renderRegister() {
  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-sm">
        <div class="text-center mb-7">
          <div class="w-14 h-14 rounded-2xl bg-brand-500 mx-auto mb-3 flex items-center justify-center text-2xl shadow-[var(--shadow-soft)]">📚</div>
          <h1 class="text-2xl font-bold tracking-tight text-ink font-heading">Daftar Akun</h1>
          <p class="text-sm text-slate-500 mt-1">Yuk gabung di ruang belajar UjiCerdas</p>
        </div>
        <div class="auth-card p-6 relative overflow-hidden">
          <div id="register-progress" class="linear-progress absolute top-0 left-0 hidden"></div>
          <form id="register-form" class="space-y-4">
            <div>
              <label class="label">Nama Lengkap</label>
              <input class="input" type="text" name="name" required>
            </div>
            <div>
              <label class="label">Username</label>
              <input class="input" type="text" name="username" required>
            </div>
            <div>
              <label class="label">Email (Gmail)</label>
              <input class="input" type="email" name="email" placeholder="nama@gmail.com"
                     pattern="^[^\\s@]+@gmail\\.com$"
                     title="Gunakan alamat email dengan domain @gmail.com" required>
              <p class="text-xs text-slate-400 mt-1">Kode OTP akan dikirim ke email ini.</p>
            </div>
            ${passwordFieldHtml({ name: 'password', label: 'Password', minlength: 6 })}
            <div>
              <label class="label">Daftar Sebagai</label>
              <select class="input" name="roleName" required>
                <option value="Siswa">Siswa / Mahasiswa</option>
                <option value="Guru">Guru / Dosen</option>
              </select>
            </div>
            <button type="submit" id="register-submit-btn" class="btn btn-primary w-full">
              <span id="register-submit-label" data-idle-text="Daftar">Daftar</span>
            </button>
          </form>
          <p class="text-sm text-slate-500 mt-4 text-center">
            Sudah punya akun?
            <a href="#login" class="text-[#e94a76] font-semibold hover:underline">Masuk di sini</a>
          </p>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('register-form');
  attachPasswordToggles(form);

  const submitBtn = document.getElementById('register-submit-btn');
  const submitLabel = document.getElementById('register-submit-label');
  const progressBar = document.getElementById('register-progress');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = fd.get('username');
    setFormLoading(form, submitBtn, submitLabel, progressBar, true, 'Mengirim kode...');
    try {
      await api('/auth/register', {
        method: 'POST',
        auth: false,
        body: {
          name: fd.get('name'),
          username,
          email: fd.get('email'),
          password: fd.get('password'),
          roleName: fd.get('roleName'),
        },
      });
      toast('Kode OTP telah dikirim ke email Anda.', 'success');
      navigate(`#verify-otp/${encodeURIComponent(username)}`);
    } catch (err) {
      toast(err.message, 'error');
      setFormLoading(form, submitBtn, submitLabel, progressBar, false);
    }
  });
}

export function renderVerifyOtp(username) {
  const OTP_EXPIRY_SECONDS = 10 * 60;
  const RESEND_COOLDOWN_SECONDS = 3 * 60;
  const POST_SUCCESS_DELAY_MS = 1000; // jeda animasi ala Google setelah verifikasi sukses

  app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-sm">
        <div class="text-center mb-7">
          <div class="w-11 h-11 rounded-xl bg-[#e94a76] mx-auto mb-3 flex items-center justify-center text-white font-extrabold font-heading">UC</div>
          <h1 class="text-2xl font-bold tracking-tight text-ink font-heading">Verifikasi Email</h1>
          <p class="text-sm text-slate-500 mt-1">Masukkan kode OTP yang dikirim ke email Gmail Anda</p>
        </div>
        <div class="auth-card p-6 relative overflow-hidden">
          <div id="otp-progress" class="linear-progress absolute top-0 left-0 hidden"></div>
          <form id="otp-form" class="space-y-4">
            <div>
              <label class="label">Kode OTP</label>
              <input class="input text-center tracking-[0.5em] text-lg" type="text" name="otp"
                     inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autofocus>
            </div>
            <p class="text-xs text-slate-500 text-center" id="otp-expiry-label"></p>
            <button type="submit" id="otp-submit-btn" class="btn btn-primary w-full">
              <span id="otp-submit-label" data-idle-text="Verifikasi">Verifikasi</span>
            </button>
          </form>
          <button id="resend-otp-btn" type="button" class="btn btn-outline w-full mt-3" disabled>Kirim Ulang OTP (3:00)</button>
          <p class="text-sm text-slate-500 mt-4 text-center">
            Salah akun?
            <a href="#register" class="text-[#e94a76] font-semibold hover:underline">Daftar ulang</a>
          </p>
        </div>
      </div>
    </div>
  `;

  let expirySeconds = OTP_EXPIRY_SECONDS;
  let cooldownSeconds = RESEND_COOLDOWN_SECONDS;

  const expiryLabel = document.getElementById('otp-expiry-label');
  const resendBtn = document.getElementById('resend-otp-btn');
  const form = document.getElementById('otp-form');
  const submitBtn = document.getElementById('otp-submit-btn');
  const submitLabel = document.getElementById('otp-submit-label');
  const progressBar = document.getElementById('otp-progress');

  const tick = () => {
    // Hentikan timer kalau halaman ini sudah tidak ditampilkan lagi (navigasi lain).
    if (!document.body.contains(form)) {
      clearInterval(timer);
      return;
    }

    expirySeconds = Math.max(0, expirySeconds - 1);
    cooldownSeconds = Math.max(0, cooldownSeconds - 1);

    const mm = String(Math.floor(expirySeconds / 60)).padStart(2, '0');
    const ss = String(expirySeconds % 60).padStart(2, '0');
    expiryLabel.textContent = expirySeconds > 0
      ? `Kode berlaku hingga ${mm}:${ss}`
      : 'Kode OTP sudah kedaluwarsa. Silakan kirim ulang.';

    if (cooldownSeconds > 0) {
      resendBtn.disabled = true;
      const rmm = String(Math.floor(cooldownSeconds / 60)).padStart(2, '0');
      const rss = String(cooldownSeconds % 60).padStart(2, '0');
      resendBtn.textContent = `Kirim Ulang OTP (${rmm}:${rss})`;
    } else {
      resendBtn.disabled = false;
      resendBtn.textContent = 'Kirim Ulang OTP';
    }
  };

  const timer = setInterval(tick, 1000);
  tick();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setFormLoading(form, submitBtn, submitLabel, progressBar, true, 'Memverifikasi...');
    try {
      await api('/auth/verify-otp', {
        method: 'POST',
        auth: false,
        body: { username, otp: fd.get('otp') },
      });
      clearInterval(timer);
      // Tetap tampilkan animasi loading sejenak walau prosesnya instan di lokal,
      // supaya transisinya terasa halus (mirip alur verifikasi Google).
      resendBtn.disabled = true;
      submitLabel.innerHTML = `
        <span class="inline-flex items-center gap-2">
          <span class="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"></span>
          Berhasil, mengalihkan...
        </span>`;
      setTimeout(() => {
        toast('Email terverifikasi. Akun Anda menunggu persetujuan Admin.', 'success');
        navigate('#login');
      }, POST_SUCCESS_DELAY_MS);
    } catch (err) {
      toast(err.message, 'error');
      setFormLoading(form, submitBtn, submitLabel, progressBar, false);
    }
  });

  resendBtn.addEventListener('click', async () => {
    if (resendBtn.disabled) return;
    resendBtn.disabled = true;
    try {
      await api('/auth/resend-otp', {
        method: 'POST',
        auth: false,
        body: { username },
      });
      toast('Kode OTP baru telah dikirim ke email Anda.', 'success');
      expirySeconds = OTP_EXPIRY_SECONDS;
      cooldownSeconds = RESEND_COOLDOWN_SECONDS;
    } catch (err) {
      toast(err.message, 'error');
      resendBtn.disabled = false;
    }
  });
}