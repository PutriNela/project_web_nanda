import { Store } from './store.js';
import { renderLogin, renderRegister, renderVerifyOtp } from '../views/auth.js';
import { renderAdminDashboard } from '../views/admin.js';
import { renderGuruDashboard, renderExamBuilder, renderExamAssign, renderExamScores } from '../views/guru.js';
import { renderSiswaDashboard, renderTeacherView, renderExamTake } from '../views/siswa.js';
import { renderPengelolaSoalDashboard } from '../views/pengelolaSoal.js';
import { renderCompleteProfile, renderCompleteStudentProfile, renderProfilePage } from '../views/profile.js';

const routes = {
  '#login':                    renderLogin,
  '#register':                 renderRegister,
  '#dashboard-admin':          renderAdminDashboard,
  '#dashboard-guru':           renderGuruDashboard,
  '#dashboard-siswa':          renderSiswaDashboard,
  '#dashboard-pengelola-soal': renderPengelolaSoalDashboard,
  '#complete-profile':         renderCompleteProfile,
  '#complete-student-profile': renderCompleteStudentProfile,
  '#profile':                  renderProfilePage,
};

export function navigate(hash) {
  if (window.location.hash === hash) router();
  else window.location.hash = hash;
}

export function dashboardHashFor(user) {
  const slugMap = { Admin: 'admin', Guru: 'guru', Siswa: 'siswa', 'Pengelola Soal': 'pengelola-soal' };
  const slug = slugMap[user.role] || 'siswa';
  return `#dashboard-${slug}`;
}

function profileCompletionRoute(user) {
  if (user.role === 'Guru')  return '#complete-profile';
  if (user.role === 'Siswa') return '#complete-student-profile';
  return null;
}

function needsProfileCompletion(user) {
  return (user.role === 'Guru' || user.role === 'Siswa') && !user.profile_completed;
}

export function router() {
  const hash = window.location.hash || '#login';
  const user = Store.user;

  // --- Profile completion pages ---
  if (hash === '#complete-profile') {
    if (!user) return navigate('#login');
    if (user.role !== 'Guru') return navigate(dashboardHashFor(user));
    return renderCompleteProfile();
  }
  if (hash === '#complete-student-profile') {
    if (!user) return navigate('#login');
    if (user.role !== 'Siswa') return navigate(dashboardHashFor(user));
    return renderCompleteStudentProfile();
  }

  // --- Halaman Profil (update nama / avatar setelah onboarding) ---
  if (hash === '#profile') {
    if (!user) return navigate('#login');
    if (user.role === 'Admin') return navigate(dashboardHashFor(user));
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
    return renderProfilePage();
  }

  // --- Verifikasi OTP registrasi (tidak butuh login) ---
  if (hash.startsWith('#verify-otp/')) {
    return renderVerifyOtp(decodeURIComponent(hash.split('/')[1]));
  }

  // --- Parameterized routes ---
  if (hash.startsWith('#exam-take/')) {
    if (!user || user.role !== 'Siswa') return navigate('#login');
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
    return renderExamTake(hash.split('/')[1]);
  }
  if (hash.startsWith('#teacher/')) {
    if (!user || user.role !== 'Siswa') return navigate('#login');
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
    return renderTeacherView(hash.split('/')[1]);
  }
  if (hash.startsWith('#exam-builder/')) {
    if (!user || user.role !== 'Guru') return navigate('#login');
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
    return renderExamBuilder(hash.split('/')[1]);
  }
  if (hash.startsWith('#exam-assign/')) {
    if (!user || user.role !== 'Guru') return navigate('#login');
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
    return renderExamAssign(hash.split('/')[1]);
  }
  if (hash.startsWith('#exam-scores/')) {
    if (!user || user.role !== 'Guru') return navigate('#login');
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
    return renderExamScores(hash.split('/')[1]);
  }

  // --- Auth guard dashboard ---
  if (hash.startsWith('#dashboard')) {
    if (!user) return navigate('#login');
    const expected = dashboardHashFor(user);
    if (hash !== expected) return navigate(expected);
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
  }

  // --- Redirect jika sudah login ---
  if ((hash === '#login' || hash === '#register') && user) {
    if (needsProfileCompletion(user)) return navigate(profileCompletionRoute(user));
    return navigate(dashboardHashFor(user));
  }

  const renderer = routes[hash];
  if (renderer) return renderer();
  navigate(user ? dashboardHashFor(user) : '#login');
}