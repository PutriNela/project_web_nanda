import { app } from '../core/dom.js';
import { api, apiUpload } from '../core/api.js';
import { toast, escapeHtml, fmtScore, enableImageLightbox } from '../core/utils.js';
import { shell, attachLogout, attachShellNav } from '../layout/shell.js';

const GURU_NAV_ICON = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h3m-7 5h10a2 2 0 002-2V7.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0012.586 3H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`;
const GURU_NAV_ITEMS = [{ key: 'dashboard', label: 'Ujian Saya', icon: GURU_NAV_ICON }];

function attachGuruShellNav() {
  attachShellNav(() => navigate('#dashboard-guru'));
}
import { navigate } from '../core/router.js';
import { Store } from '../core/store.js';
import { renderBankSoalBrowser } from '../core/bankSoalBrowser.js';

/* ---- helpers ---- */
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/* ---- Dashboard utama ---- */
export async function renderGuruDashboard() {
  app.innerHTML = shell('Guru', GURU_NAV_ITEMS, 'dashboard', `<div id="guru-content" class="text-sm text-slate-500">Memuat data...</div>`);
  attachLogout();
  attachGuruShellNav();

  let exams = [], subjects = [], profile = null;
  try {
    [exams, subjects, profile] = await Promise.all([
      api('/exams/mine'),
      api('/subjects'),
      api('/profile/me'),
    ]);
  } catch (err) {
    document.getElementById('guru-content').innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
    return;
  }

  const content = document.getElementById('guru-content');
  const displayName = profile?.full_name || Store.user?.name || '';
  const hasPhoto = !!profile?.photo_url;

  content.innerHTML = `
    <div class="space-y-8">

      <!-- INFO PROFIL -->
      <section class="card p-5 mb-2">
        <div class="flex items-start gap-5 flex-wrap justify-between">
          <div class="flex items-start gap-5 flex-wrap">
            <!-- Avatar / Foto: bersih secara default, overlay kamera muncul saat hover -->
            <label id="avatar-container" class="avatar-edit-trigger relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
              <input type="file" id="photo-file-input" accept="image/*" class="sr-only">
              ${hasPhoto
                ? `<img id="profile-img" src="${profile.photo_url}" alt="Foto profil" class="w-full h-full object-cover">`
                : `<span class="text-2xl font-bold text-slate-600">${initials(displayName)}</span>`}
              <span class="avatar-overlay absolute inset-0 bg-slate-900/55 flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </span>
            </label>
            <!-- Info profil -->
            <div class="space-y-1.5">
              <p class="text-xs text-slate-400 uppercase tracking-widest font-semibold">Profil Anda</p>
              <p class="text-lg font-bold text-slate-800">${escapeHtml(displayName || '—')}</p>
              <p class="text-sm text-slate-500 leading-relaxed">
                Nomor Induk: <span class="font-medium text-slate-600">${escapeHtml(profile?.nomor_induk || '—')}</span>
              </p>
              <div class="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-500 leading-relaxed">
                <span>📞 ${escapeHtml(profile?.phone || '—')}</span>
                <span>📍 ${escapeHtml(profile?.address || '—')}</span>
              </div>
              ${profile?.subjects?.length
                ? `<div class="flex flex-wrap gap-1.5 mt-2">
                    ${profile.subjects.map(s => `<span class="badge border-[#d5cbff] text-[#e94a76] bg-[#fff0f5]">${escapeHtml(s.subject_name)}</span>`).join('')}
                  </div>`
                : '<p class="text-xs text-slate-400 mt-1">Belum ada mata kuliah yang ditetapkan.</p>'}
            </div>
          </div>
          <button id="btn-edit-profile" class="btn btn-outline shrink-0">Edit Profil</button>
        </div>
      </section>

      <!-- MODAL EDIT PROFIL (tersembunyi) -->
      <div id="edit-profile-modal" class="hidden fixed inset-0 z-40 items-center justify-center px-4 py-8 overflow-y-auto">
        <div class="modal-backdrop" id="edit-profile-backdrop"></div>
        <div class="modal-panel relative w-full max-w-lg p-6 my-auto fade-in">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg text-slate-800">Edit Profil</h3>
            <button type="button" id="btn-close-edit-profile" class="btn-ghost">✕</button>
          </div>
          <form id="edit-profile-form" class="space-y-4">
            ${hasPhoto ? `
            <div class="flex items-center justify-between bg-slate-50 rounded-lg px-3.5 py-2.5">
              <span class="text-sm text-slate-500">Foto profil saat ini</span>
              <button type="button" id="btn-remove-photo" class="text-xs font-semibold text-red-600 hover:underline">Hapus foto</button>
            </div>` : ''}
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nama Lengkap + Gelar</label>
                <input class="input" type="text" name="full_name" value="${escapeHtml(profile?.full_name || '')}" required>
              </div>
              <div>
                <label class="label">Nomor Induk (NIP / NIDN / ID Kepegawaian)</label>
                <input class="input" type="text" name="nomor_induk" value="${escapeHtml(profile?.nomor_induk || '')}" required>
              </div>
            </div>
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nomor Telepon</label>
                <input class="input" type="tel" name="phone" value="${escapeHtml(profile?.phone || '')}" required>
              </div>
              <div>
                <label class="label">Alamat</label>
                <input class="input" type="text" name="address" value="${escapeHtml(profile?.address || '')}" required>
              </div>
            </div>
            <div>
              <label class="label">Mata Kuliah yang Diajar</label>
              <div class="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                ${subjects.length === 0
                  ? `<p class="px-3 py-2 text-xs text-slate-400">Belum ada mata kuliah tersedia.</p>`
                  : subjects.map(s => {
                      const checked = profile?.subjects?.some(ps => ps.id === s.id) ? 'checked' : '';
                      return `
                        <label class="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" name="subject_ids" value="${s.id}" ${checked} class="shrink-0">
                          ${escapeHtml(s.subject_name)}
                        </label>`;
                    }).join('')}
              </div>
            </div>
            <div class="flex gap-2 justify-end pt-1">
              <button type="button" id="btn-cancel-edit-profile" class="btn btn-outline">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      </div>

      <!-- HEADER UJIAN -->
      <section class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold">Ujian Saya</h1>
          <p class="text-sm text-slate-500">Kelola ujian, soal, penugasan siswa, dan pantau hasil di sini.</p>
        </div>
        <button id="btn-new-exam" class="btn btn-primary">+ Buat Ujian</button>
      </section>

      <!-- FORM BUAT UJIAN -->
      <div id="new-exam-form-wrap" class="hidden card p-5">
        <h2 class="font-bold mb-3">Ujian Baru</h2>
        <form id="new-exam-form" class="grid md:grid-cols-2 gap-3">
          <div>
            <label class="label">Judul Ujian</label>
            <input class="input" type="text" name="title" required>
          </div>
          <div>
            <label class="label">Mata Pelajaran</label>
            <select class="input" name="subject_id" required>
              <option value="">— pilih —</option>
              ${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.subject_name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label">Durasi (menit)</label>
            <input class="input" type="number" name="duration" min="1" value="60" required>
          </div>
          <div>
            <label class="label">Nilai Minimal Lulus (Passing Grade)</label>
            <input class="input" type="number" name="minimum_score" min="0" max="100" step="0.01" value="75" required>
          </div>
          <div class="md:col-span-2 flex gap-2 justify-end">
            <button type="button" id="btn-cancel-new-exam" class="btn btn-outline">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan Ujian</button>
          </div>
        </form>
      </div>

      <!-- TABEL UJIAN -->
      <section class="card overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left">
            <tr>
              <th class="table-cell">Judul</th>
              <th class="table-cell">Mapel</th>
              <th class="table-cell text-center">Durasi</th>
              <th class="table-cell text-center">Nilai Minimal</th>
              <th class="table-cell">Status</th>
              <th class="table-cell text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${exams.length === 0
              ? `<tr><td class="table-cell text-slate-400" colspan="6">Belum ada ujian. Buat ujian baru di atas.</td></tr>`
              : exams.map(e => `
                <tr>
                  <td class="table-cell font-medium">${escapeHtml(e.title)}</td>
                  <td class="table-cell">${escapeHtml(e.subject_name)}</td>
                  <td class="table-cell table-cell-num">${e.duration} menit</td>
                  <td class="table-cell table-cell-num">${fmtScore(e.minimum_score)}</td>
                  <td class="table-cell">${e.is_active
                    ? '<span class="badge border-[#d5cbff] text-[#e94a76] bg-[#fff0f5]">Aktif</span>'
                    : '<span class="badge border-slate-300 text-slate-500">Nonaktif</span>'}</td>
                  <td class="table-cell whitespace-nowrap">
                    <div class="flex items-center gap-1.5 justify-end">
                      <a href="#exam-builder/${e.id}" class="btn btn-outline !py-1.5 !px-3 !text-xs" data-tip="Kelola soal">Soal</a>
                      <button type="button" class="icon-btn" data-menu-toggle="${e.id}" data-tip="Aksi lainnya">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z"/></svg>
                      </button>
                      <div class="hidden dropdown-fixed card p-1.5 w-44 text-left" data-menu-panel="${e.id}">
                        <a href="#exam-assign/${e.id}" class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-slate-600 hover:bg-[#fff0f5] hover:text-[#e94a76]">
                          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                          Tugaskan Siswa
                        </a>
                        <a href="#exam-scores/${e.id}" class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-slate-600 hover:bg-[#fff0f5] hover:text-[#e94a76]">
                          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                          Lihat Nilai
                        </a>
                        <button type="button" class="flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50" data-delete-exam="${e.id}">
                          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          Hapus Ujian
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </section>
    </div>
  `;

  // Upload / hapus foto profil
  document.getElementById('photo-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await apiUpload('/profile/photo', 'photo', file);
      toast('Foto profil diperbarui.', 'success');
      renderGuruDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('btn-remove-photo')?.addEventListener('click', async () => {
    if (!confirm('Hapus foto profil?')) return;
    try {
      await api('/profile/photo', { method: 'DELETE' });
      toast('Foto profil dihapus.', 'success');
      renderGuruDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Toggle modal edit profil
  const editModal = document.getElementById('edit-profile-modal');
  const openEditModal = () => { editModal.classList.remove('hidden'); editModal.classList.add('flex'); };
  const closeEditModal = () => { editModal.classList.add('hidden'); editModal.classList.remove('flex'); };
  document.getElementById('btn-edit-profile').addEventListener('click', openEditModal);
  document.getElementById('btn-cancel-edit-profile').addEventListener('click', closeEditModal);
  document.getElementById('btn-close-edit-profile').addEventListener('click', closeEditModal);
  document.getElementById('edit-profile-backdrop').addEventListener('click', closeEditModal);

  // Submit edit profil
  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const subject_ids = [...fd.getAll('subject_ids')].map(Number);
    try {
      await api('/profile/me', {
        method: 'POST',
        body: {
          full_name:   fd.get('full_name'),
          nomor_induk: fd.get('nomor_induk'),
          address:     fd.get('address'),
          phone:       fd.get('phone'),
          subject_ids,
        },
      });
      toast('Profil berhasil diperbarui.', 'success');
      renderGuruDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Toggle form ujian baru
  document.getElementById('btn-new-exam').addEventListener('click', () => {
    document.getElementById('new-exam-form-wrap').classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-new-exam').addEventListener('click', () => {
    document.getElementById('new-exam-form-wrap').classList.add('hidden');
  });

  document.getElementById('new-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/exams', {
        method: 'POST',
        body: {
          title:         fd.get('title'),
          subject_id:    Number(fd.get('subject_id')),
          duration:      Number(fd.get('duration')),
          minimum_score: Number(fd.get('minimum_score')),
        },
      });
      toast('Ujian berhasil dibuat.', 'success');
      renderGuruDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });

  // Dropdown menu aksi tabel ujian (fixed positioning, lepas dari clipping overflow-x-auto)
  function positionMenuPanel(btn, panel) {
    const rect = btn.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 176; // w-44 fallback
    let left = rect.right - panelWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    let top = rect.bottom + 4;
    // Kalau ruang di bawah tidak cukup, tampilkan di atas tombol
    const estimatedPanelHeight = panel.scrollHeight || 140;
    if (top + estimatedPanelHeight > window.innerHeight - 8) {
      top = rect.top - estimatedPanelHeight - 4;
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function closeAllMenus() {
    content.querySelectorAll('[data-menu-panel]').forEach(p => p.classList.add('hidden'));
  }

  content.querySelectorAll('[data-menu-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.menuToggle;
      const panel = content.querySelector(`[data-menu-panel="${id}"]`);
      const isOpen = !panel.classList.contains('hidden');
      closeAllMenus();
      if (!isOpen) {
        panel.classList.remove('hidden');
        positionMenuPanel(btn, panel);
      }
    });
  });
  document.addEventListener('click', closeAllMenus);
  window.addEventListener('scroll', closeAllMenus, true);
  window.addEventListener('resize', closeAllMenus);

  content.querySelectorAll('[data-delete-exam]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Hapus ujian ini beserta seluruh soal dan riwayat pengerjaannya?')) return;
    try {
      await api(`/exams/${btn.dataset.deleteExam}`, { method: 'DELETE' });
      toast('Ujian dihapus.', 'success');
      renderGuruDashboard();
    } catch (err) { toast(err.message, 'error'); }
  }));
}

/* ---- Exam Assign ---- */
export async function renderExamAssign(examId) {
  app.innerHTML = shell('Guru', GURU_NAV_ITEMS, 'dashboard', `<div id="assign-content" class="text-sm text-slate-500">Memuat data...</div>`);
  attachLogout();
  attachGuruShellNav();

  let exam, assigned, assignable;
  try {
    [exam, assigned, assignable] = await Promise.all([
      api(`/exams/${examId}`),
      api(`/exams/${examId}/assignments`),
      api(`/exams/${examId}/assignments/assignable`),
    ]);
  } catch (err) {
    document.getElementById('assign-content').innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
    return;
  }

  const content = document.getElementById('assign-content');
  content.innerHTML = `
    <a href="#dashboard-guru" class="text-sm text-slate-500 underline">&larr; Kembali ke Ujian Saya</a>
    <div class="mt-2 mb-6">
      <h1 class="text-xl font-bold">Penugasan Siswa — ${escapeHtml(exam.title)}</h1>
      <p class="text-sm text-slate-500">${escapeHtml(exam.subject_name)} · ${exam.duration} menit · Nilai minimal ${fmtScore(exam.minimum_score)}</p>
    </div>

    <div class="grid md:grid-cols-2 gap-6">
      <div class="card p-5">
        <h2 class="font-bold mb-3">Siswa Ditugaskan <span class="text-slate-400 font-normal">(${assigned.length})</span></h2>
        <div id="assigned-list">${renderAssignedTable(assigned, examId)}</div>
      </div>

      <div class="card p-5">
        <h2 class="font-bold mb-3">Tambah Siswa ke Ujian Ini</h2>
        <p class="text-xs text-slate-500 mb-3">
          Hanya siswa di bawah tanggung jawab Anda yang tersedia.
          Minta Admin untuk menambahkan siswa ke daftar Anda terlebih dahulu.
        </p>
        ${assignable.length === 0
          ? `<p class="text-sm text-slate-400">Semua siswa di bawah Anda sudah ditugaskan, atau Anda belum memiliki siswa.</p>`
          : `<div class="space-y-3">
               <div class="border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
                 ${assignable.map(s => `
                   <label class="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                     <input type="checkbox" name="assign_student" value="${s.id}" class="shrink-0">
                     <span>
                       <span class="font-medium">${escapeHtml(s.name)}</span>
                       <span class="text-slate-400 text-xs ml-1">${escapeHtml(s.username)}</span>
                     </span>
                   </label>`).join('')}
               </div>
               <div class="flex items-center gap-3">
                 <label class="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                   <input type="checkbox" id="check-all-students"> Pilih semua
                 </label>
                 <button id="btn-assign-students" class="btn btn-primary ml-auto">Tugaskan yang Dipilih</button>
               </div>
             </div>`}
      </div>
    </div>
  `;

  attachAssignEvents(content, examId);
}

function renderAssignedTable(assigned, examId) {
  if (assigned.length === 0) {
    return `<p class="text-sm text-slate-400">Belum ada siswa yang ditugaskan ke ujian ini.</p>`;
  }
  return `
    <table class="w-full text-xs">
      <thead class="bg-slate-50 text-left">
        <tr>
          <th class="table-cell">Nama</th>
          <th class="table-cell">Ditugaskan Oleh</th>
          <th class="table-cell">Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${assigned.map(s => `
          <tr>
            <td class="table-cell">
              <p class="font-medium">${escapeHtml(s.student_name)}</p>
              <p class="text-slate-400">${escapeHtml(s.username)}</p>
            </td>
            <td class="table-cell text-slate-500">${escapeHtml(s.assigned_by_name)}</td>
            <td class="table-cell">
              <button class="btn btn-danger !py-0.5 !px-2 !text-xs" data-unassign="${s.student_id}" data-exam="${examId}">Hapus</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function attachAssignEvents(content, examId) {
  const checkAll = content.querySelector('#check-all-students');
  if (checkAll) {
    checkAll.addEventListener('change', () => {
      content.querySelectorAll('[name="assign_student"]').forEach(cb => cb.checked = checkAll.checked);
    });
  }

  const btnAssign = content.querySelector('#btn-assign-students');
  if (btnAssign) {
    btnAssign.addEventListener('click', async () => {
      const checked = [...content.querySelectorAll('[name="assign_student"]:checked')];
      if (!checked.length) { toast('Pilih minimal satu siswa.', 'error'); return; }
      const studentIds = checked.map(cb => Number(cb.value));
      try {
        await api(`/exams/${examId}/assignments`, { method: 'POST', body: { studentIds } });
        toast(`${studentIds.length} siswa berhasil ditugaskan.`, 'success');
        renderExamAssign(examId);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  content.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-unassign]');
    if (!btn) return;
    if (!confirm('Hapus siswa ini dari penugasan ujian?')) return;
    try {
      await api(`/exams/${btn.dataset.exam}/assignments/${btn.dataset.unassign}`, { method: 'DELETE' });
      toast('Siswa dihapus dari penugasan.', 'success');
      renderExamAssign(examId);
    } catch (err) { toast(err.message, 'error'); }
  });
}


/* ---- Exam Builder ---- */
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const DIFFICULTY_OPTIONS = ['Mudah', 'Sedang', 'Sulit'];

function difficultyBadge(difficulty) {
  const map = {
    Mudah: 'border-[#d5cbff] text-[#e94a76] bg-[#fff0f5]',
    Sedang: 'border-amber-300 text-amber-700 bg-amber-50',
    Sulit: 'border-red-300 text-red-700 bg-red-50',
  };
  return `<span class="badge ${map[difficulty] || 'border-slate-300 text-slate-500'}">${escapeHtml(difficulty || '—')}</span>`;
}

export async function renderExamBuilder(examId) {
  app.innerHTML = shell('Guru', GURU_NAV_ITEMS, 'dashboard', `<div id="builder-content" class="text-sm text-slate-500">Memuat soal...</div>`);
  attachLogout();
  attachGuruShellNav();

  let exam, questions, subjects, profile;
  try {
    [exam, questions, subjects, profile] = await Promise.all([
      api(`/exams/${examId}`),
      api(`/exams/${examId}/questions`),
      api('/subjects'),
      api('/profile/me'),
    ]);
  } catch (err) {
    document.getElementById('builder-content').innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
    return;
  }
  // Mapel yang diajar guru ini saja — dipakai untuk membatasi pilihan di modal "Ambil dari Bank Soal".
  const myTaughtSubjects = profile?.subjects || [];

  const myId = Store.user?.id;
  const content = document.getElementById('builder-content');
  content.innerHTML = `
    <a href="#dashboard-guru" class="text-sm text-slate-500 underline">&larr; Kembali ke Ujian Saya</a>
    <div class="mt-2 mb-6">
      <h1 class="text-xl font-bold">${escapeHtml(exam.title)}</h1>
      <p class="text-sm text-slate-500">${escapeHtml(exam.subject_name)} · ${exam.duration} menit · Nilai minimal ${fmtScore(exam.minimum_score)}</p>
    </div>

    <!-- Pilihan sumber soal -->
    <section class="flex items-center gap-2 mb-6">
      <button type="button" id="btn-show-new-question" class="btn btn-primary">+ Buat Soal Baru</button>
      <button type="button" id="btn-show-bank-modal" class="btn btn-outline">+ Ambil dari Bank Soal</button>
    </section>

    <!-- FORM BUAT SOAL BARU (otomatis masuk Bank Soal + terhubung ke ujian ini) -->
    <div id="new-question-form-wrap" class="hidden card p-5 mb-6">
      <h2 class="font-bold mb-3">Buat Soal Baru</h2>
      <p class="text-xs text-slate-500 mb-3">Soal ini otomatis tersimpan ke Bank Soal dan bisa dipakai ulang di ujian lain.</p>
      <form id="add-question-form" class="space-y-3">
        <div>
          <label class="label">Teks Pertanyaan</label>
          <textarea class="input" name="question_text" rows="2" required></textarea>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="label">Mata Pelajaran</label>
            <select class="input" name="subject_id" required>
              ${subjects.map(s => `<option value="${s.id}" ${Number(s.id) === Number(exam.subject_id) ? 'selected' : ''}>${escapeHtml(s.subject_name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label">Tingkat Kesulitan</label>
            <select class="input" name="difficulty" required>
              ${DIFFICULTY_OPTIONS.map(d => `<option value="${d}" ${d === 'Sedang' ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label">Bobot Nilai Soal</label>
            <input class="input" type="number" name="score_weight" value="1" min="0.1" step="0.1" required>
          </div>
        </div>
        <!-- Gambar soal -->
        <div>
          <label class="label">Gambar Soal <span class="font-normal text-slate-400">(opsional)</span></label>
          <input type="file" accept="image/*" id="new-question-image" name="question_image"
            class="block text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer w-full">
          <div id="new-question-preview" class="hidden mt-2">
            <img id="new-question-preview-img" class="max-h-28 rounded-lg border border-slate-200 object-contain">
            <button type="button" id="btn-clear-image" class="text-xs text-red-500 mt-1 hover:underline">Batalkan gambar</button>
          </div>
        </div>
        <div class="space-y-2">
          ${[0,1,2,3,4].map(i => `
            <div class="flex items-center gap-2">
              <input type="radio" name="correct_option" value="${i}" ${i===0?'checked':''} class="shrink-0">
              <input class="input" type="text" name="option_${i}" placeholder="Opsi jawaban ${OPTION_LETTERS[i]}" ${i < 2 ? 'required' : ''}>
            </div>`).join('')}
        </div>
        <p class="text-xs text-slate-500">Pilih radio button di samping opsi yang merupakan jawaban benar. Minimal 2 opsi (A-B), maksimal 5 opsi (A-E) — kosongkan opsi yang tidak dipakai.</p>
        <div class="flex gap-2 justify-end">
          <button type="button" id="btn-cancel-new-question" class="btn btn-outline">Batal</button>
          <button type="submit" class="btn btn-primary">Tambah Soal</button>
        </div>
      </form>
    </div>

    <!-- MODAL AMBIL DARI BANK SOAL -->
    <div id="bank-modal" class="hidden fixed inset-0 z-40 items-center justify-center px-4 py-8 overflow-y-auto">
      <div class="modal-backdrop" id="bank-modal-backdrop"></div>
      <div class="modal-panel relative w-full max-w-2xl p-6 my-auto fade-in">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-slate-800">Ambil dari Bank Soal</h3>
          <button type="button" id="btn-close-bank-modal" class="btn-ghost">✕</button>
        </div>
        <div id="bank-browser" class="max-h-[60vh] overflow-y-auto pr-1"></div>
        <div class="flex gap-2 justify-end mt-4">
          <button type="button" id="btn-cancel-bank" class="btn btn-outline">Batal</button>
          <button type="button" id="btn-attach-bank" class="btn btn-primary">Tambahkan yang Dipilih</button>
        </div>
      </div>
    </div>

    <!-- MODAL EDIT SOAL -->
    <div id="edit-question-modal" class="hidden fixed inset-0 z-40 items-center justify-center px-4 py-8 overflow-y-auto">
      <div class="modal-backdrop" id="edit-question-backdrop"></div>
      <div class="modal-panel relative w-full max-w-lg p-6 my-auto fade-in">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-slate-800">Edit Soal</h3>
          <button type="button" id="btn-close-edit-question" class="btn-ghost">✕</button>
        </div>
        <form id="edit-question-form" class="space-y-3">
          <input type="hidden" name="question_id">
          <div>
            <label class="label">Teks Pertanyaan</label>
            <textarea class="input" name="question_text" rows="2" required></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="label">Mata Pelajaran</label>
              <select class="input" name="subject_id" required>
                ${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.subject_name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label">Tingkat Kesulitan</label>
              <select class="input" name="difficulty" required>
                ${DIFFICULTY_OPTIONS.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label">Bobot Nilai</label>
              <input class="input" type="number" name="score_weight" min="0.1" step="0.1" required>
            </div>
          </div>
          <div id="edit-question-options" class="space-y-2"></div>
          <p class="text-xs text-slate-500">Pilih radio button di samping opsi yang merupakan jawaban benar.</p>
          <div class="flex gap-2 justify-end">
            <button type="button" id="btn-cancel-edit-question" class="btn btn-outline">Batal</button>
            <button type="submit" class="btn btn-primary">Simpan Perubahan</button>
          </div>
        </form>
      </div>
    </div>

    <h2 class="font-bold mb-3">Daftar Soal (${questions.length})</h2>
    <div class="space-y-3" id="question-list">
      ${questions.length === 0
        ? '<p class="text-sm text-slate-400">Belum ada soal. Buat soal baru atau ambil dari Bank Soal di atas.</p>'
        : questions.map((q, idx) => renderQuestionCard(q, idx, myId)).join('')}
    </div>
  `;

  // Klik gambar soal untuk preview penuh layar
  enableImageLightbox(content);

  /* ---- Toggle form Buat Soal Baru ---- */
  const newQForm = document.getElementById('new-question-form-wrap');
  document.getElementById('btn-show-new-question').addEventListener('click', () => {
    newQForm.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-new-question').addEventListener('click', () => {
    newQForm.classList.add('hidden');
  });

  // Preview gambar baru sebelum submit
  const imgInput = document.getElementById('new-question-image');
  const previewWrap = document.getElementById('new-question-preview');
  const previewImg = document.getElementById('new-question-preview-img');
  imgInput.addEventListener('change', () => {
    const file = imgInput.files[0];
    if (file) {
      previewImg.src = URL.createObjectURL(file);
      previewWrap.classList.remove('hidden');
    }
  });
  document.getElementById('btn-clear-image').addEventListener('click', () => {
    imgInput.value = '';
    previewImg.src = '';
    previewWrap.classList.add('hidden');
  });

  // Submit soal baru
  document.getElementById('add-question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const correctIdx = Number(fd.get('correct_option'));
    const options = [0,1,2,3,4]
      .map(i => ({ option_text: (fd.get(`option_${i}`) || '').trim(), is_correct: i === correctIdx }))
      .filter(o => o.option_text);
    if (!options.some(o => o.is_correct)) {
      toast('Opsi yang ditandai sebagai jawaban benar tidak boleh kosong.', 'error');
      return;
    }
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';
    try {
      const question = await api(`/exams/${examId}/questions`, {
        method: 'POST',
        body: {
          question_text: fd.get('question_text'),
          subject_id: Number(fd.get('subject_id')),
          difficulty: fd.get('difficulty'),
          score_weight: Number(fd.get('score_weight')),
          options,
        },
      });
      // Upload gambar jika ada
      const imageFile = imgInput.files[0];
      if (imageFile && question?.id) {
        await apiUpload(`/questions/${question.id}/image`, 'image', imageFile);
      }
      toast('Soal ditambahkan ke Bank Soal dan ujian ini.', 'success');
      renderExamBuilder(examId);
    } catch (err) {
      toast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tambah Soal';
    }
  });

  /* ---- Modal Ambil dari Bank Soal (hanya mapel yang diajar guru ini) ---- */
  const bankModal = document.getElementById('bank-modal');
  const bankBrowserEl = document.getElementById('bank-browser');
  const attachedIds = new Set(questions.map(q => q.id));
  const selectedBankIds = new Set();

  function renderBankQuestionOption(q) {
    const already = attachedIds.has(q.id);
    const checked = selectedBankIds.has(q.id);
    return `
      <label class="flex items-start gap-3 px-3 py-2.5 border border-slate-200 rounded-lg ${already ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50 hover:border-slate-300'}">
        <input type="checkbox" data-bank-id="${q.id}" ${checked ? 'checked' : ''} ${already ? 'disabled' : ''} class="shrink-0 mt-1">
        <span class="flex-1">
          <span class="block font-medium text-slate-700 text-sm">${escapeHtml(q.question_text)}</span>
          <span class="flex flex-wrap gap-1.5 mt-1.5">
            ${q.subject_name ? `<span class="badge border-slate-200 text-slate-500">${escapeHtml(q.subject_name)}</span>` : ''}
            ${difficultyBadge(q.difficulty)}
            <span class="badge border-slate-200 text-slate-500">oleh ${escapeHtml(q.teacher_name || 'Guru terhapus')}</span>
            ${already ? '<span class="badge border-slate-200 text-slate-400">Sudah di ujian ini</span>' : ''}
          </span>
        </span>
      </label>`;
  }

  // Modal dibangun ulang tiap dibuka supaya drill-down (Mapel -> Tingkat) selalu mulai dari awal.
  const openBankModal = () => {
    bankModal.classList.remove('hidden'); bankModal.classList.add('flex');
    renderBankSoalBrowser(bankBrowserEl, {
      subjects: myTaughtSubjects,
      title: 'Kumpulan Soal',
      emptySubjectsMessage: 'Anda belum ditetapkan mengajar mata pelajaran apa pun. Minta Admin melengkapi profil Anda terlebih dahulu.',
      fetchQuestions: ({ subject_id, difficulty }) => {
        const params = new URLSearchParams();
        if (subject_id) params.set('subject_id', subject_id);
        if (difficulty) params.set('difficulty', difficulty);
        return api(`/questions/bank${params.toString() ? `?${params}` : ''}`);
      },
      renderItem: (q) => renderBankQuestionOption(q),
      afterRender: (itemListEl) => {
        itemListEl.querySelectorAll('[data-bank-id]').forEach(cb => {
          cb.addEventListener('change', () => {
            const id = Number(cb.dataset.bankId);
            if (cb.checked) selectedBankIds.add(id); else selectedBankIds.delete(id);
          });
        });
      },
    });
  };
  const closeBankModal = () => { bankModal.classList.add('hidden'); bankModal.classList.remove('flex'); };

  document.getElementById('btn-show-bank-modal').addEventListener('click', openBankModal);
  document.getElementById('btn-cancel-bank').addEventListener('click', closeBankModal);
  document.getElementById('btn-close-bank-modal').addEventListener('click', closeBankModal);
  document.getElementById('bank-modal-backdrop').addEventListener('click', closeBankModal);

  document.getElementById('btn-attach-bank').addEventListener('click', async () => {
    if (selectedBankIds.size === 0) { toast('Pilih minimal satu soal dari Bank Soal.', 'error'); return; }
    try {
      await api(`/exams/${examId}/questions/attach`, {
        method: 'POST',
        body: { question_ids: [...selectedBankIds] },
      });
      toast(`${selectedBankIds.size} soal ditambahkan dari Bank Soal.`, 'success');
      renderExamBuilder(examId);
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ---- Modal Edit Soal ---- */
  const editModal = document.getElementById('edit-question-modal');
  const openEditModal = () => { editModal.classList.remove('hidden'); editModal.classList.add('flex'); };
  const closeEditModal = () => { editModal.classList.add('hidden'); editModal.classList.remove('flex'); };
  document.getElementById('btn-cancel-edit-question').addEventListener('click', closeEditModal);
  document.getElementById('btn-close-edit-question').addEventListener('click', closeEditModal);
  document.getElementById('edit-question-backdrop').addEventListener('click', closeEditModal);

  function renderEditOptions(options) {
    const wrap = document.getElementById('edit-question-options');
    const slots = [0,1,2,3,4].map(i => options[i] || { option_text: '', is_correct: false });
    wrap.innerHTML = slots.map((o, i) => `
      <div class="flex items-center gap-2">
        <input type="radio" name="edit_correct_option" value="${i}" ${o.is_correct ? 'checked' : ''} class="shrink-0">
        <input class="input" type="text" name="edit_option_${i}" placeholder="Opsi jawaban ${OPTION_LETTERS[i]}" value="${escapeHtml(o.option_text)}" ${i < 2 ? 'required' : ''}>
      </div>`).join('');
  }

  document.getElementById('edit-question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const correctIdx = Number(fd.get('edit_correct_option'));
    const options = [0,1,2,3,4]
      .map(i => ({ option_text: (fd.get(`edit_option_${i}`) || '').trim(), is_correct: i === correctIdx }))
      .filter(o => o.option_text);
    if (!options.some(o => o.is_correct)) {
      toast('Opsi yang ditandai sebagai jawaban benar tidak boleh kosong.', 'error');
      return;
    }
    try {
      await api(`/questions/${fd.get('question_id')}`, {
        method: 'PUT',
        body: {
          question_text: fd.get('question_text'),
          subject_id: Number(fd.get('subject_id')),
          difficulty: fd.get('difficulty'),
          score_weight: Number(fd.get('score_weight')),
          options,
        },
      });
      toast('Soal berhasil diperbarui.', 'success');
      closeEditModal();
      renderExamBuilder(examId);
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ---- Aksi per-soal (event delegation) ---- */
  document.getElementById('question-list').addEventListener('click', async (e) => {
    // Edit soal (hanya penulis asli)
    const editBtn = e.target.closest('[data-edit-q]');
    if (editBtn) {
      const q = questions.find(x => Number(x.id) === Number(editBtn.dataset.editQ));
      if (!q) return;
      const form = document.getElementById('edit-question-form');
      form.elements['question_id'].value = q.id;
      form.elements['question_text'].value = q.question_text;
      form.elements['subject_id'].value = q.subject_id || '';
      form.elements['difficulty'].value = q.difficulty || 'Sedang';
      form.elements['score_weight'].value = q.score_weight;
      renderEditOptions(q.options || []);
      openEditModal();
      return;
    }
    // Lepas soal dari ujian ini saja (soal tetap di Bank Soal)
    const detachBtn = e.target.closest('[data-detach-q]');
    if (detachBtn) {
      const confirmed = confirm('Lepas soal ini dari ujian? Soal tetap tersimpan di Bank Soal untuk dipakai ujian lain.');
      if (!confirmed) return;
      try {
        await api(`/exams/${examId}/questions/${detachBtn.dataset.detachQ}`, { method: 'DELETE' });
        toast('Soal dilepas dari ujian ini.', 'success');
        renderExamBuilder(examId);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    // Hapus permanen dari Bank Soal (hanya penulis asli)
    const deleteBtn = e.target.closest('[data-delete-bank-q]');
    if (deleteBtn) {
      const confirmed = confirm('Hapus soal ini secara PERMANEN dari Bank Soal? Soal akan hilang dari SEMUA ujian yang memakainya.');
      if (!confirmed) return;
      try {
        await api(`/questions/${deleteBtn.dataset.deleteBankQ}`, { method: 'DELETE' });
        toast('Soal dihapus permanen dari Bank Soal.', 'success');
        renderExamBuilder(examId);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
    // Hapus gambar soal
    const delImg = e.target.closest('[data-delete-q-img]');
    if (delImg) {
      if (!confirm('Hapus gambar soal ini?')) return;
      try {
        await api(`/questions/${delImg.dataset.deleteQImg}/image`, { method: 'DELETE' });
        toast('Gambar dihapus.', 'success');
        renderExamBuilder(examId);
      } catch (err) { toast(err.message, 'error'); }
      return;
    }
  });

  // Upload gambar per soal (dari input file di question-list, hanya penulis asli — tombol tidak dirender jika bukan penulis)
  document.getElementById('question-list').addEventListener('change', async (e) => {
    const input = e.target.closest('[data-upload-q-img]');
    if (!input || !input.files[0]) return;
    const qId = input.dataset.uploadQImg;
    try {
      await apiUpload(`/questions/${qId}/image`, 'image', input.files[0]);
      toast('Gambar soal diunggah.', 'success');
      renderExamBuilder(examId);
    } catch (err) { toast(err.message, 'error'); }
  });
}

function renderQuestionCard(q, idx, myId) {
  const isAuthor = Number(q.teacher_id) === Number(myId);
  return `
    <div class="card p-4">
      <div class="flex justify-between items-start gap-3 mb-2">
        <p class="font-medium text-sm flex-1">
          ${idx + 1}. ${escapeHtml(q.question_text)}
          <span class="text-xs text-slate-400 font-normal ml-1">(bobot ${q.score_weight})</span>
        </p>
        <div class="flex items-center gap-1.5 shrink-0">
          ${isAuthor ? `<button class="btn btn-outline !py-1 !px-2.5 !text-xs" data-edit-q="${q.id}">Edit</button>` : ''}
          <button class="btn btn-outline !py-1 !px-2.5 !text-xs" data-detach-q="${q.id}" data-tip="Lepas dari ujian ini saja">Lepas</button>
          ${isAuthor ? `<button class="btn btn-danger !py-1 !px-2.5 !text-xs" data-delete-bank-q="${q.id}" data-tip="Hapus permanen dari Bank Soal">Hapus</button>` : ''}
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5 mb-3">
        ${q.subject_name ? `<span class="badge border-slate-200 text-slate-500">${escapeHtml(q.subject_name)}</span>` : ''}
        ${difficultyBadge(q.difficulty)}
        <span class="badge border-slate-200 text-slate-500">oleh ${escapeHtml(q.teacher_name || 'Guru terhapus')}${isAuthor ? ' (Anda)' : ''}</span>
      </div>

      <!-- Gambar soal -->
      ${q.image_url
        ? `<div class="mb-3">
            <img src="${q.image_url}" alt="Gambar soal" data-lightbox class="max-h-40 rounded-lg border border-slate-200 object-contain bg-slate-50">
            ${isAuthor ? `
            <div class="flex items-center gap-3 mt-1.5">
              <label class="text-xs text-slate-500 cursor-pointer hover:text-slate-800 underline">
                Ganti gambar
                <input type="file" accept="image/*" data-upload-q-img="${q.id}" class="sr-only">
              </label>
              <button class="text-xs text-red-500 hover:underline" data-delete-q-img="${q.id}">Hapus gambar</button>
            </div>` : ''}
          </div>`
        : (isAuthor ? `<div class="mb-3">
            <label class="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer hover:text-slate-800 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 hover:border-slate-500 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Tambah gambar soal
              <input type="file" accept="image/*" data-upload-q-img="${q.id}" class="sr-only">
            </label>
          </div>` : '')}

      <!-- Opsi jawaban -->
      <ul class="space-y-1">
        ${q.options.map((o, i) => `
          <li class="flex items-center gap-2 text-sm ${o.is_correct ? 'text-emerald-700 font-semibold' : 'text-slate-600'}">
            <span class="w-5 h-5 rounded border ${o.is_correct ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-slate-400'} inline-flex items-center justify-center text-[10px] font-bold shrink-0">${OPTION_LETTERS[i] || '?'}</span>
            ${escapeHtml(o.option_text)}
          </li>`).join('')}
      </ul>
    </div>`;
}

/* ---- Pantauan Nilai ---- */
export async function renderExamScores(examId) {
  app.innerHTML = shell('Guru', GURU_NAV_ITEMS, 'dashboard', `<div id="scores-content" class="text-sm text-slate-500">Memuat nilai...</div>`);
  attachLogout();
  attachGuruShellNav();

  let exam, summary;
  try {
    [exam, summary] = await Promise.all([api(`/exams/${examId}`), api(`/exams/${examId}/scores`)]);
  } catch (err) {
    document.getElementById('scores-content').innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
    return;
  }

  const statusBadge = (status) => {
    const map = {
      'Lulus':            'border-emerald-300 text-emerald-700 bg-emerald-50',
      'Harus Mengulang':  'border-amber-300 text-amber-700 bg-amber-50',
      'Belum Dikerjakan': 'border-slate-200 text-slate-500 bg-slate-50',
    };
    return `<span class="badge ${map[status] || 'border-slate-200 text-slate-500'}">${status}</span>`;
  };

  document.getElementById('scores-content').innerHTML = `
    <a href="#dashboard-guru" class="text-sm text-slate-500 underline">&larr; Kembali ke Ujian Saya</a>
    <div class="mt-2 mb-6">
      <h1 class="text-xl font-bold">Pantauan Nilai — ${escapeHtml(exam.title)}</h1>
      <p class="text-sm text-slate-500">Nilai minimal lulus: <strong>${fmtScore(exam.minimum_score)}</strong> · ${summary.length} siswa ditugaskan</p>
    </div>
    <div class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left">
          <tr>
            <th class="table-cell">Nama Siswa</th>
            <th class="table-cell">Nilai Tertinggi</th>
            <th class="table-cell">Status</th>
            <th class="table-cell text-center">Percobaan</th>
          </tr>
        </thead>
        <tbody>
          ${summary.length === 0
            ? `<tr><td class="table-cell text-slate-400" colspan="4">Belum ada siswa yang ditugaskan.</td></tr>`
            : summary.map(row => `
              <tr>
                <td class="table-cell font-medium">${escapeHtml(row.student_name)}</td>
                <td class="table-cell">${fmtScore(row.highest_score)}</td>
                <td class="table-cell">${statusBadge(row.status)}</td>
                <td class="table-cell text-center">${row.attempt_count > 0 ? `${row.attempt_count}x` : '<span class="text-slate-300">—</span>'}</td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}