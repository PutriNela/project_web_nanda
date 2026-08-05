import { app } from '../core/dom.js';
import { api } from '../core/api.js';
import { Store } from '../core/store.js';
import { toast, escapeHtml, fmtScore, confirmDialog, enableImageLightbox } from '../core/utils.js';
import { navigate } from '../core/router.js';

/* ================================================================
   UTILITIES
   ================================================================ */
const PALETTE = [
  '#1a73e8','#e8453c','#34a853','#fa7b17',
  '#a142f4','#0098d4','#db4437','#0b8043',
  '#ff7043','#00897b',
];

function cardColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ================================================================
   STUDENT NAV (custom, bukan generic shell)
   ================================================================ */
function studentNav({ showBack = false, backHash = '#dashboard-siswa', title = '' } = {}) {
  const user = Store.user;
  const ini  = initials(user?.name || '?');
  return `
    <header class="bg-[#ffe0eb]/75 backdrop-blur-md border-b border-[#ffb3cf]/70 sticky top-0 z-20">
      <div class="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          ${showBack ? `
            <button id="btn-nav-back" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors shrink-0">
              <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>` : ''}
          ${title ? `<span class="text-slate-400 text-sm hidden sm:inline">/</span>
                     <span class="text-slate-600 text-sm truncate hidden sm:inline">${escapeHtml(title)}</span>` : ''}
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-sm text-slate-500 hidden md:block truncate max-w-[140px]">${escapeHtml(user?.name || '')}</span>
          <div class="relative">
            <button id="nav-avatar-btn"
              class="w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center select-none"
              style="background-color: ${cardColor(user?.name || 'X')}">
              ${ini}
            </button>
            <div id="nav-dropdown" class="hidden absolute right-0 top-11 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-44 z-30">
              <button id="nav-profile-link" type="button" class="w-full text-left px-4 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <p class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(user?.name || '')}</p>
                <p class="text-xs text-slate-400">Mahasiswa</p>
              </button>
              <button id="btn-logout" class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">Keluar</button>
            </div>
          </div>
        </div>
      </div>
    </header>`;
}

function attachStudentNavEvents(backHash = '#dashboard-siswa') {
  document.getElementById('btn-nav-back')?.addEventListener('click', () => navigate(backHash));
  const avatarBtn = document.getElementById('nav-avatar-btn');
  const dropdown  = document.getElementById('nav-dropdown');
  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => dropdown?.classList.add('hidden'), { once: false });
  document.getElementById('nav-profile-link')?.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
    navigate('#profile');
  });
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Keluar dari akun?',
      message: 'Anda akan keluar dari sesi ini dan perlu login kembali untuk melanjutkan.',
      confirmLabel: 'Ya, Keluar',
      cancelLabel: 'Tidak',
      danger: true,
    });
    if (!confirmed) return;
    Store.clear();
    navigate('#login');
  });
}

/* ================================================================
   DASHBOARD — Teacher Cards (Google Classroom style)
   ================================================================ */
export async function renderSiswaDashboard() {
  app.innerHTML = studentNav() + `
    <div id="siswa-main" class="min-h-screen page-bg">
      <div class="max-w-6xl mx-auto px-5 py-8">
        <div class="mb-6">
          <h1 class="text-xl font-bold text-slate-900">Kelas Saya</h1>
          <p class="text-sm text-slate-500 mt-0.5">Pilih kelas untuk melihat tugas dan ujian.</p>
        </div>
        <div id="teacher-cards" class="text-sm text-slate-400">Memuat...</div>
      </div>
    </div>`;

  attachStudentNavEvents();

  let teachers;
  try {
    teachers = await api('/student/teachers');
  } catch (err) {
    document.getElementById('teacher-cards').innerHTML =
      `<p class="text-red-500">${escapeHtml(err.message)}</p>`;
    return;
  }

  const container = document.getElementById('teacher-cards');
  if (!teachers.length) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-20 h-20 rounded-2xl bg-slate-200 flex items-center justify-center mb-4">
          <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        </div>
        <p class="font-semibold text-slate-700 text-lg">Belum ada kelas</p>
        <p class="text-slate-400 text-sm mt-1 max-w-xs">Anda belum ditugaskan ke ujian apapun. Hubungi dosen atau admin.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${teachers.map(t => renderTeacherCard(t)).join('')}
    </div>`;

  container.querySelectorAll('[data-teacher-id]').forEach(card => {
    card.addEventListener('click', () => navigate(`#teacher/${card.dataset.teacherId}`));
  });
}

function renderTeacherCard(teacher) {
  const color      = cardColor(teacher.teacher_name);
  const ini        = initials(teacher.teacher_full_name || teacher.teacher_name);
  const displayName = teacher.teacher_full_name || teacher.teacher_name;
  const subjects   = teacher.subjects || '—';
  const pending    = teacher.pending_count || 0;
  const total      = teacher.total_exams || 0;
  const hasPhoto   = !!teacher.photo_url;

  return `
    <div data-teacher-id="${teacher.teacher_id}"
      class="rounded-2xl overflow-hidden cursor-pointer select-none
             transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
      style="background-color: color-mix(in srgb, ${color} 10%, #fff0f5); border: 1px solid color-mix(in srgb, ${color} 25%, #ffd9e4);">

      <!-- Blok warna atas -->
      <div class="relative h-24 flex items-center justify-center" style="background-color:${color};">
        <div class="w-14 h-14 rounded-full overflow-hidden border-[3px] border-white/70 shadow-sm flex items-center justify-center bg-white/20">
          ${hasPhoto
            ? `<img src="${teacher.photo_url}" alt="${escapeHtml(displayName)}" class="w-full h-full object-cover">`
            : `<span class="text-white text-lg font-bold">${ini}</span>`}
        </div>
        <span class="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/25 border border-white/50 text-white text-[10px] font-bold flex items-center justify-center">
          ${ini}
        </span>
      </div>

      <!-- Bagian bawah (pink) -->
      <div class="px-3.5 pt-3 pb-3">
        <p class="font-heading font-bold text-sm leading-snug text-slate-800 line-clamp-2">
          ${escapeHtml(subjects)} - ${escapeHtml(displayName)}
        </p>
        <p class="text-xs text-slate-400 mt-0.5">-</p>
        <div class="flex items-center justify-between mt-1.5 gap-2">
          <span class="text-xs text-slate-500">${total} ujian</span>
          ${pending > 0
            ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white bg-red-500 shrink-0">
                 ${pending} belum selesai
               </span>`
            : `<span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white bg-emerald-500 shrink-0">
                 Semua selesai
               </span>`}
        </div>
      </div>
    </div>`;
}

/* ================================================================
   TEACHER DETAIL VIEW (Google Classroom-inspired layout)
   ================================================================ */
export async function renderTeacherView(teacherId) {
  app.innerHTML = studentNav({ showBack: true, backHash: '#dashboard-siswa', title: 'Memuat...' }) +
    `<div id="tv-main" class="min-h-screen page-bg"><div class="py-20 text-center text-sm text-slate-400">Memuat kelas...</div></div>`;
  attachStudentNavEvents('#dashboard-siswa');

  let teachers, allExams;
  try {
    [teachers, allExams] = await Promise.all([
      api('/student/teachers'),
      api('/student/exams'),
    ]);
  } catch (err) {
    document.getElementById('tv-main').innerHTML =
      `<p class="text-red-500 p-6">${escapeHtml(err.message)}</p>`;
    return;
  }

  const teacher = teachers.find(t => String(t.teacher_id) === String(teacherId));
  if (!teacher) {
    toast('Kelas tidak ditemukan.', 'error');
    return navigate('#dashboard-siswa');
  }

  const exams = allExams.filter(e => String(e.teacher_id) === String(teacherId));
  const color  = cardColor(teacher.teacher_name);
  const ini    = initials(teacher.teacher_full_name || teacher.teacher_name);
  const hasPhoto = !!teacher.photo_url;

  const upcoming = exams.filter(e =>
    e.exam_status === 'belum_dikerjakan' ||
    e.exam_status === 'harus_mengulang' ||
    e.exam_status === 'sedang_berlangsung'
  );

  app.innerHTML = `
    <div class="min-h-screen page-bg flex flex-col">
      ${studentNav({ showBack: true, backHash: '#dashboard-siswa', title: teacher.teacher_full_name || teacher.teacher_name })}

      <!-- Banner -->
      <div class="h-44 md:h-52 relative overflow-hidden" style="background-color:${color};">
        <div class="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-white opacity-10"></div>
        <div class="absolute right-20 -bottom-16 w-48 h-48 rounded-full bg-white opacity-10"></div>
        <div class="max-w-5xl mx-auto px-6 h-full flex items-end pb-6">
          <div class="flex items-end gap-4">
            <div class="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/40 bg-white/25 flex items-center justify-center shrink-0 mb-0.5">
              ${hasPhoto
                ? `<img src="${teacher.photo_url}" alt="${escapeHtml(teacher.teacher_full_name || teacher.teacher_name)}" class="w-full h-full object-cover">`
                : `<span class="text-white text-xl font-bold">${ini}</span>`}
            </div>
            <div>
              <h1 class="text-white text-2xl md:text-3xl font-bold leading-tight">
                ${escapeHtml(teacher.teacher_full_name || teacher.teacher_name)}
              </h1>
              <p class="text-white/75 text-sm mt-0.5">${escapeHtml(teacher.subjects || '—')}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 max-w-5xl w-full mx-auto px-5 py-6">
        <div class="flex flex-col md:flex-row gap-5">

          <!-- Sidebar: Upcoming -->
          <aside class="w-full md:w-72 shrink-0">
            <div class="bg-white border border-slate-200 rounded-xl p-4 md:sticky md:top-20">
              <p class="font-bold text-sm text-slate-800 mb-3">Segera Dikerjakan</p>
              ${upcoming.length === 0
                ? `<div class="text-center py-4">
                    <p class="text-slate-400 text-sm">Tidak ada ujian yang perlu dikerjakan.</p>
                    <p class="text-slate-300 text-xs mt-1">Woohoo! 🎉</p>
                  </div>`
                : upcoming.map(e => `
                  <div class="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                    <div class="w-2 h-2 rounded-full mt-1.5 shrink-0" style="background-color:${color};"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-800 truncate">${escapeHtml(e.title)}</p>
                      <p class="text-xs text-slate-400 mt-0.5">${_statusLabel(e.exam_status)}</p>
                    </div>
                  </div>`).join('')}
            </div>
          </aside>

          <!-- Main: Exam Feed -->
          <main class="flex-1 min-w-0 space-y-3" id="exam-feed">
            ${exams.length === 0
              ? `<div class="bg-white border border-slate-200 rounded-xl p-8 text-center">
                  <p class="text-slate-400 text-sm">Belum ada ujian yang ditugaskan dari dosen ini.</p>
                </div>`
              : exams.map(e => renderExamFeedCard(e, color)).join('')}
          </main>
        </div>
      </div>
    </div>`;

  attachStudentNavEvents('#dashboard-siswa');

  // Attach start/resume buttons
  document.getElementById('exam-feed')?.querySelectorAll('[data-start-exam]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Memuat...';
      try {
        const result = await api(`/exams/${btn.dataset.startExam}/start`, { method: 'POST' });
        navigate(`#exam-take/${result.attempt.id}`);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = btn.dataset.label;
      }
    });
  });
  document.getElementById('exam-feed')?.querySelectorAll('[data-resume-exam]').forEach(btn => {
    btn.addEventListener('click', () => navigate(`#exam-take/${btn.dataset.resumeExam}`));
  });
}

function renderExamFeedCard(exam, accentColor) {
  const { action, label, labelClass } = _examAction(exam);
  const statusPill = _statusPill(exam.exam_status);

  return `
    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden
                hover:border-slate-300 transition-colors duration-150">
      <div class="flex items-start gap-4 p-4 md:p-5">
        <!-- Icon -->
        <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
             style="background-color:${accentColor}20;">
          <svg class="w-5 h-5" style="color:${accentColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        </div>
        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-start justify-between gap-2 mb-1">
            <p class="font-semibold text-slate-900 text-sm">${escapeHtml(exam.title)}</p>
            ${statusPill}
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mb-3">
            <span>📚 ${escapeHtml(exam.subject_name)}</span>
            <span>⏱ ${exam.duration} menit</span>
            <span>🎯 Nilai minimal ${fmtScore(exam.minimum_score)}</span>
            <span>Ditugaskan ${fmtDate(exam.assigned_at)}</span>
          </div>

          ${exam.exam_status === 'harus_mengulang' ? `
            <div class="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-xs text-amber-700">
              Percobaan sebelumnya: <strong>${fmtScore(exam.last_score)}</strong>
              — belum mencapai batas minimal <strong>${fmtScore(exam.minimum_score)}</strong>
              (${exam.attempt_count}× percobaan)
            </div>` : ''}

          ${exam.exam_status === 'lulus' ? `
            <div class="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3 text-xs text-emerald-700">
              Lulus dengan nilai <strong>${fmtScore(exam.last_score)}</strong> dalam ${exam.attempt_count}× percobaan.
            </div>` : ''}

          <!-- Action -->
          ${action}
        </div>
      </div>
    </div>`;
}

function _examAction(exam) {
  if (exam.exam_status === 'lulus') {
    return {
      action: `<button class="btn btn-outline opacity-50 cursor-not-allowed !text-xs !py-1.5" disabled>Sudah Lulus</button>`,
      label: 'Sudah Lulus',
    };
  }
  if (exam.exam_status === 'sedang_berlangsung') {
    return {
      action: `<button data-resume-exam="${exam.ongoing_attempt_id}" class="btn btn-primary !text-xs !py-1.5">Lanjutkan Ujian →</button>`,
      label: 'Lanjutkan',
    };
  }
  if (exam.exam_status === 'harus_mengulang') {
    return {
      action: `<button data-start-exam="${exam.id}" data-label="Ulangi Ujian (Remedial)" class="btn btn-primary !text-xs !py-1.5">Ulangi Ujian (Remedial)</button>`,
      label: 'Remedial',
    };
  }
  return {
    action: `<button data-start-exam="${exam.id}" data-label="Mulai Ujian" class="btn btn-primary !text-xs !py-1.5">Mulai Ujian →</button>`,
    label: 'Mulai',
  };
}

function _statusPill(status) {
  const map = {
    belum_dikerjakan:  ['bg-slate-100 text-slate-600',  'Belum Dikerjakan'],
    sedang_berlangsung:['bg-blue-50 text-blue-700',     'Sedang Berlangsung'],
    lulus:             ['bg-emerald-50 text-emerald-700','Lulus'],
    harus_mengulang:   ['bg-amber-50 text-amber-700',   'Harus Mengulang'],
  };
  const [cls, label] = map[status] || ['bg-slate-100 text-slate-600', status];
  return `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${cls}">${label}</span>`;
}

function _statusLabel(status) {
  const map = {
    belum_dikerjakan:   'Belum dikerjakan',
    sedang_berlangsung: 'Sedang berlangsung',
    harus_mengulang:    'Perlu diulang',
  };
  return map[status] || status;
}

/* ================================================================
   EXAM TAKING — Timer + Autosave + Question Navigator
   ================================================================ */
let examTimerInterval = null;

export async function renderExamTake(attemptId) {
  if (examTimerInterval) clearInterval(examTimerInterval);
  app.innerHTML = `<div class="min-h-screen flex items-center justify-center page-bg text-sm text-slate-400">Memuat soal ujian...</div>`;

  let data;
  try {
    data = await api(`/attempts/${attemptId}/questions`);
  } catch (err) {
    toast(err.message, 'error');
    return navigate('#dashboard-siswa');
  }

  const { attempt, exam, questions, existingAnswers } = data;
  const answerState = {};
  existingAnswers.forEach(a => { answerState[a.question_id] = a.selected_option_id; });

  const startTime = new Date(attempt.start_time.replace(' ', 'T')).getTime();
  const endTime   = startTime + exam.duration * 60 * 1000;
  const color     = cardColor(exam.title);

  app.innerHTML = `
    <div class="min-h-screen flex flex-col page-bg">
      <!-- Sticky header -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div class="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="font-bold text-slate-900 text-sm truncate">${escapeHtml(exam.title)}</p>
            <p class="text-xs text-slate-400">Percobaan ke-${attempt.attempt_number} · ${questions.length} soal</p>
          </div>
          <div id="timer"
            class="text-base font-bold tabular-nums px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 shrink-0 min-w-[64px] text-center">
            --:--
          </div>
        </div>
      </header>

      <!-- Question navigator -->
      <div class="bg-white border-b border-slate-200">
        <div class="max-w-3xl mx-auto px-5 py-2 flex gap-1.5 flex-wrap">
          ${questions.map((q, idx) => `
            <a href="#q-${q.id}"
              id="nav-${q.id}"
              class="w-8 h-8 flex items-center justify-center text-xs rounded-lg border border-slate-200
                     bg-white hover:border-slate-400 transition-colors font-medium text-slate-600 nav-dot">
              ${idx + 1}
            </a>`).join('')}
        </div>
      </div>

      <!-- Questions -->
      <main class="flex-1 max-w-3xl w-full mx-auto px-5 py-6">
        <form id="exam-form" class="space-y-4">
          ${questions.map((q, idx) => `
            <div class="bg-white border border-slate-200 rounded-xl p-5 scroll-mt-28" id="q-${q.id}">
              <p class="font-semibold text-slate-900 text-sm mb-4 leading-relaxed">
                <span class="inline-block w-6 h-6 rounded-full text-white text-xs font-bold
                             flex items-center justify-center mr-2 shrink-0 align-middle"
                      style="background-color:${color};">${idx + 1}</span>
                ${escapeHtml(q.question_text)}
              </p>

              <!-- Gambar soal (jika ada) -->
              ${q.image_url ? `
                <div class="mb-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src="${q.image_url}" alt="Gambar soal ${idx + 1}" data-lightbox
                    class="w-full max-h-72 object-contain">
                </div>` : ''}

              <div class="space-y-2">
                ${q.options.map((o, oi) => `
                  <label class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer
                                hover:border-slate-400 hover:bg-slate-50 transition-all duration-150
                                has-[:checked]:border-2 option-label"
                         style="--checked-color:${color};"
                         data-option="${o.id}">
                    <span class="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center shrink-0
                                 radio-visual transition-all">
                    </span>
                    <input type="radio" name="q_${q.id}" value="${o.id}" data-question="${q.id}"
                           ${answerState[q.id] == o.id ? 'checked' : ''} class="sr-only">
                    <span class="text-sm text-slate-700">${escapeHtml(o.option_text)}</span>
                  </label>`).join('')}
              </div>
            </div>`).join('')}

          <div class="flex justify-between items-center pb-10 pt-2">
            <p id="answer-count" class="text-sm text-slate-400"></p>
            <button type="submit" class="btn btn-primary rounded-xl px-6 py-3">Submit Ujian</button>
          </div>
        </form>
      </main>
    </div>`;

  // Klik gambar soal untuk preview penuh layar
  enableImageLightbox(app);

  // Inject radio style helper
  const style = document.createElement('style');
  style.textContent = `
    .option-label:has(input:checked) {
      border-color: var(--checked-color);
      background-color: color-mix(in srgb, var(--checked-color) 8%, white);
    }
    .option-label:has(input:checked) .radio-visual {
      border-color: var(--checked-color);
      background-color: var(--checked-color);
    }
    .option-label:has(input:checked) .radio-visual::after {
      content: '';
      display: block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: white;
    }
    .nav-dot.answered {
      color: white;
      border-color: transparent;
    }`;
  document.head.appendChild(style);

  // Update nav dot color
  function markAnswered(questionId) {
    const dot = document.getElementById(`nav-${questionId}`);
    if (dot) {
      dot.classList.add('answered');
      dot.style.backgroundColor = color;
    }
  }

  // Pre-mark existing answers
  Object.keys(answerState).forEach(qid => markAnswered(qid));

  // Update answer counter
  function updateAnswerCount() {
    const total    = questions.length;
    const answered = document.querySelectorAll('#exam-form input[type=radio]:checked').length;
    const el = document.getElementById('answer-count');
    if (el) el.textContent = `${answered} dari ${total} soal dijawab`;
  }
  updateAnswerCount();

  // Autosave
  document.querySelectorAll('#exam-form input[type=radio]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const questionId = Number(e.target.dataset.question);
      markAnswered(questionId);
      updateAnswerCount();
      try {
        await api(`/attempts/${attemptId}/answer`, {
          method: 'POST',
          body: { question_id: questionId, selected_option_id: Number(e.target.value) },
        });
      } catch (err) {
        toast('Gagal menyimpan: ' + err.message, 'error');
      }
    });
  });

  // Submit
  async function doSubmit(isTimeout) {
    if (examTimerInterval) clearInterval(examTimerInterval);
    try {
      const result = await api(`/attempts/${attemptId}/submit`, { method: 'POST', body: { isTimeout } });
      renderExamResult(result);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  document.getElementById('exam-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const answered = document.querySelectorAll('#exam-form input[type=radio]:checked').length;
    const total    = questions.length;
    const msg = answered < total
      ? `Anda baru menjawab ${answered} dari ${total} soal. Yakin ingin submit sekarang?`
      : 'Yakin ingin submit ujian sekarang?';
    if (confirm(msg)) doSubmit(false);
  });

  // Timer
  const timerEl = document.getElementById('timer');
  function tick() {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      timerEl.textContent = '00:00';
      clearInterval(examTimerInterval);
      toast('Waktu habis. Ujian disubmit otomatis.', 'info');
      doSubmit(true);
      return;
    }
    const s = Math.floor(remaining / 1000);
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${sec}`;
    if (remaining < 5 * 60 * 1000) {
      timerEl.style.color = '#dc2626';
      timerEl.style.borderColor = '#fca5a5';
      timerEl.style.background = '#fef2f2';
    }
  }
  tick();
  examTimerInterval = setInterval(tick, 1000);
}

/* ================================================================
   EXAM RESULT
   ================================================================ */
function renderExamResult(result) {
  if (examTimerInterval) clearInterval(examTimerInterval);
  const passed = result.is_passed;
  const color  = passed ? '#059669' : '#d97706';
  const bg     = passed ? '#ecfdf5' : '#fffbeb';
  const border = passed ? '#a7f3d0' : '#fde68a';

  app.innerHTML = `
    <div class="min-h-screen page-bg flex items-center justify-center px-4">
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
        <!-- Icon -->
        <div class="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
             style="background-color:${bg}; border: 2px solid ${border};">
          ${passed
            ? `<svg class="w-8 h-8" style="color:${color};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>`
            : `<svg class="w-8 h-8" style="color:${color};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4l16 16M4 20L20 4"/>
              </svg>`}
        </div>

        <p class="text-xs uppercase tracking-widest font-semibold mb-1" style="color:${color};">
          ${passed ? 'Selamat! Anda Lulus' : 'Belum Mencapai Nilai Minimal'}
        </p>
        <p class="text-5xl font-bold text-slate-900 mb-1">${fmtScore(result.final_score)}</p>
        <p class="text-sm text-slate-400 mb-5">Nilai minimal: <strong>${fmtScore(result.minimum_score)}</strong></p>

        <div class="rounded-xl p-3 mb-6 text-sm" style="background-color:${bg}; color:${color};">
          ${passed
            ? 'Hasil ini sudah tersimpan. Ujian dinyatakan selesai.'
            : 'Jangan menyerah! Anda dapat mengulang ujian ini dari dashboard.'}
        </div>

        <button id="btn-back" class="btn btn-primary w-full rounded-xl py-3">
          Kembali ke Dashboard
        </button>
      </div>
    </div>`;

  document.getElementById('btn-back').addEventListener('click', () => navigate('#dashboard-siswa'));
}