import { app } from '../core/dom.js';
import { Store } from '../core/store.js';
import { api } from '../core/api.js';
import { toast, escapeHtml } from '../core/utils.js';
import { shell, attachLogout, attachShellNav } from '../layout/shell.js';
import { renderBankSoalBrowser } from '../core/bankSoalBrowser.js';

export function statusBadge(status) {
  const map = {
    pending:  'border-amber-300 text-amber-700 bg-amber-50',
    approved: 'border-[#d5cbff] text-[#e94a76] bg-[#fff0f5]',
    rejected: 'border-red-300 text-red-700 bg-red-50',
  };
  const labelMap = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };
  return `<span class="badge ${map[status] || 'border-slate-300 text-slate-700'}">${labelMap[status] || status}</span>`;
}

let ADMIN_STATE = { tab: 'users', userFilter: 'pending' };

const ADMIN_NAV_ICONS = {
  users: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 10-4-4 4 4 0 004 4zm6 4a4 4 0 10-4-4"/></svg>`,
  assign: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
  academic: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.42A12.02 12.02 0 0122 9v3.5a1 1 0 01-.55.9L12 18l-9.45-4.6a1 1 0 01-.55-.9V9a12.02 12.02 0 013.84-1.42L12 14z"/></svg>`,
  banksoal: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>`,
};

export async function renderAdminDashboard() {
  let pending = [], allUsers = [], subjects = [], teachers = [], profileRequests = [];
  try {
    [pending, allUsers, subjects, teachers, profileRequests] = await Promise.all([
      api('/users/pending'),
      api('/users'),
      api('/subjects'),
      api('/users/teachers'),
      api('/profile/requests'),
    ]);
  } catch (err) {
    app.innerHTML = shell('Admin', [], 'users', `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`);
    attachLogout();
    return;
  }

  const data = { pending, allUsers, subjects, teachers, profileRequests };
  const usersBadge = pending.length + profileRequests.length;

  const navItems = [
    { key: 'users',    label: 'Manajemen Pengguna',       icon: ADMIN_NAV_ICONS.users,    badge: usersBadge || null },
    { key: 'assign',   label: 'Penugasan Guru & Siswa',    icon: ADMIN_NAV_ICONS.assign },
    { key: 'academic', label: 'Data Akademik',             icon: ADMIN_NAV_ICONS.academic },
    { key: 'banksoal', label: 'Bank Soal',                 icon: ADMIN_NAV_ICONS.banksoal },
  ];

  app.innerHTML = shell('Admin', navItems, ADMIN_STATE.tab || 'users',
    `<div id="admin-tab-panel" class="fade-in min-w-0"></div>`);
  attachLogout();

  const panel = document.getElementById('admin-tab-panel');

  function setTab(tab) {
    ADMIN_STATE.tab = tab;
    if (tab === 'users') renderUsersTab(panel, data);
    if (tab === 'assign') renderAssignTab(panel, data);
    if (tab === 'academic') renderAcademicTab(panel, data);
    if (tab === 'banksoal') renderBankSoalTab(panel, data);
  }

  attachShellNav(setTab);
  setTab(ADMIN_STATE.tab || 'users');
}

/* =========================================================
   SUBPAGE 1 — Manajemen Pengguna
   ========================================================= */
function renderUsersTab(panel, data) {
  const { pending, allUsers, subjects, profileRequests } = data;
  const filter = ADMIN_STATE.userFilter || 'pending';

  panel.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div class="flex gap-2 flex-wrap">
        <button type="button" class="btn ${filter === 'pending' ? 'btn-primary' : 'btn-outline'} !text-xs" data-user-filter="pending">
          Persetujuan Akun Baru ${pending.length ? `<span class="ml-1 opacity-80">(${pending.length})</span>` : ''}
        </button>
        <button type="button" class="btn ${filter === 'profile' ? 'btn-primary' : 'btn-outline'} !text-xs" data-user-filter="profile">
          Permintaan Pengisian Profil ${profileRequests.length ? `<span class="ml-1 opacity-80">(${profileRequests.length})</span>` : ''}
        </button>
        <button type="button" class="btn ${filter === 'all' ? 'btn-primary' : 'btn-outline'} !text-xs" data-user-filter="all">
          Seluruh Pengguna <span class="ml-1 opacity-80">(${allUsers.length})</span>
        </button>
      </div>
      <button type="button" id="btn-open-create-user" class="btn btn-primary">+ Tambah Pengguna</button>
    </div>

    <div id="users-filter-content"></div>

    <!-- FORM ISI PROFIL GURU (tersembunyi, muncul saat klik "Isi Profil") -->
    <div id="fill-profile-wrap" class="hidden card p-5 mt-6 border-l-4 border-l-[#e94a76]">
      <h2 class="font-bold mb-1 text-slate-800">Isi Profil Guru: <span id="fill-profile-name" class="font-normal"></span></h2>
      <p class="text-xs text-slate-500 mb-4">Data ini akan disimpan atas nama guru yang bersangkutan.</p>
      <form id="fill-profile-form" class="space-y-4">
        <input type="hidden" name="target_user_id">
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="label">Nama Lengkap + Gelar</label>
            <input class="input" type="text" name="full_name" placeholder="Dr. Budi Santoso, M.Kom." required>
          </div>
          <div>
            <label class="label">Nomor Induk (NIP / NIDN / ID Kepegawaian)</label>
            <input class="input" type="text" name="nomor_induk" required>
          </div>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="label">Nomor Telepon</label>
            <input class="input" type="tel" name="phone" required>
          </div>
          <div>
            <label class="label">Alamat</label>
            <input class="input" type="text" name="address" required>
          </div>
        </div>
        <div>
          <label class="label">Mata Kuliah yang Diajar</label>
          <div class="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
            ${subjects.length === 0
              ? `<p class="px-3 py-2 text-xs text-slate-400">Belum ada mata kuliah.</p>`
              : subjects.map(s => `
                <label class="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" name="subject_ids" value="${s.id}" class="shrink-0">
                  ${escapeHtml(s.subject_name)}
                </label>`).join('')}
          </div>
        </div>
        <div class="flex gap-2 justify-end">
          <button type="button" id="btn-cancel-fill" class="btn btn-outline">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan Profil Guru</button>
        </div>
      </form>
    </div>

    <!-- MODAL: TAMBAH PENGGUNA -->
    <div id="create-user-modal" class="hidden fixed inset-0 z-40 items-center justify-center px-4 py-8 overflow-y-auto">
      <div class="modal-backdrop" id="create-user-backdrop"></div>
      <div class="modal-panel relative w-full max-w-sm p-6 my-auto fade-in">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-slate-800">Tambah Pengguna</h3>
          <button type="button" id="btn-close-create-user" class="btn-ghost">✕</button>
        </div>
        <p class="text-xs text-slate-500 mb-4">Akun yang dibuat di sini langsung berstatus disetujui.</p>
        <form id="create-user-form" class="space-y-3">
          <div>
            <label class="label">Nama Lengkap</label>
            <input class="input" type="text" name="name" required>
          </div>
          <div>
            <label class="label">Username</label>
            <input class="input" type="text" name="username" required>
          </div>
          <div>
            <label class="label">Password</label>
            <input class="input" type="password" name="password" required minlength="6">
          </div>
          <div>
            <label class="label">Peran</label>
            <select class="input" name="roleName" required>
              <option value="Siswa">Siswa</option>
              <option value="Guru">Guru</option>
              <option value="Pengelola Soal">Pengelola Soal</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div class="flex gap-2 justify-end pt-1">
            <button type="button" id="btn-cancel-create-user" class="btn btn-outline">Batal</button>
            <button type="submit" class="btn btn-primary">Buat Akun</button>
          </div>
        </form>
      </div>
    </div>
  `;

  renderUsersFilterContent(panel, data);

  panel.querySelectorAll('[data-user-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      ADMIN_STATE.userFilter = btn.dataset.userFilter;
      renderUsersTab(panel, data);
    });
  });

  // --- Modal tambah pengguna ---
  const createModal = document.getElementById('create-user-modal');
  const openCreateModal = () => { createModal.classList.remove('hidden'); createModal.classList.add('flex'); };
  const closeCreateModal = () => { createModal.classList.add('hidden'); createModal.classList.remove('flex'); };
  document.getElementById('btn-open-create-user').addEventListener('click', openCreateModal);
  document.getElementById('btn-close-create-user').addEventListener('click', closeCreateModal);
  document.getElementById('btn-cancel-create-user').addEventListener('click', closeCreateModal);
  document.getElementById('create-user-backdrop').addEventListener('click', closeCreateModal);

  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/users', { method: 'POST', body: { name: fd.get('name'), username: fd.get('username'), password: fd.get('password'), roleName: fd.get('roleName') } });
      toast('Akun berhasil dibuat.', 'success');
      renderAdminDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });

  // --- Isi profil guru ---
  panel.querySelectorAll('[data-fill-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = document.getElementById('fill-profile-wrap');
      wrap.classList.remove('hidden');
      document.getElementById('fill-profile-name').textContent = btn.dataset.fillName;
      wrap.querySelector('[name="target_user_id"]').value = btn.dataset.fillProfile;
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.getElementById('btn-cancel-fill')?.addEventListener('click', () => {
    document.getElementById('fill-profile-wrap').classList.add('hidden');
  });
  document.getElementById('fill-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const targetUserId = fd.get('target_user_id');
    const subject_ids = [...fd.getAll('subject_ids')].map(Number);
    try {
      await api(`/profile/teacher/${targetUserId}`, {
        method: 'POST',
        body: {
          full_name:   fd.get('full_name'),
          nomor_induk: fd.get('nomor_induk'),
          address:     fd.get('address'),
          phone:       fd.get('phone'),
          subject_ids,
        },
      });
      toast('Profil guru berhasil disimpan.', 'success');
      renderAdminDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function renderUsersFilterContent(panel, data) {
  const { pending, allUsers, profileRequests } = data;
  const filter = ADMIN_STATE.userFilter || 'pending';
  const wrap = panel.querySelector('#users-filter-content');

  if (filter === 'pending') {
    wrap.innerHTML = `
      <div class="card overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left">
            <tr>
              <th class="table-cell">Nama</th>
              <th class="table-cell">Username</th>
              <th class="table-cell">Role</th>
              <th class="table-cell text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${pending.length === 0
              ? `<tr><td class="table-cell text-slate-400" colspan="4">Tidak ada akun yang menunggu persetujuan.</td></tr>`
              : pending.map(u => `
                <tr>
                  <td class="table-cell">${escapeHtml(u.name)}</td>
                  <td class="table-cell">${escapeHtml(u.username)}</td>
                  <td class="table-cell"><span class="badge border-slate-300 text-slate-700">${escapeHtml(u.role_name)}</span></td>
                  <td class="table-cell">
                    <div class="flex items-center gap-1.5 justify-end">
                      <button class="icon-btn" data-tip="Setujui" data-approve="${u.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                      </button>
                      <button class="icon-btn icon-btn-danger" data-tip="Tolak" data-reject="${u.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    wrap.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', async () => {
      try { await api(`/users/${btn.dataset.approve}/approve`, { method: 'PATCH' }); toast('Akun disetujui.', 'success'); renderAdminDashboard(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    wrap.querySelectorAll('[data-reject]').forEach(btn => btn.addEventListener('click', async () => {
      try { await api(`/users/${btn.dataset.reject}/reject`, { method: 'PATCH' }); toast('Akun ditolak.', 'success'); renderAdminDashboard(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  if (filter === 'profile') {
    wrap.innerHTML = `
      <div class="card overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left">
            <tr>
              <th class="table-cell">Nama Guru</th>
              <th class="table-cell">Username</th>
              <th class="table-cell">Pesan</th>
              <th class="table-cell">Diminta Sejak</th>
              <th class="table-cell text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${profileRequests.length === 0
              ? `<tr><td class="table-cell text-slate-400" colspan="5">Tidak ada permintaan saat ini.</td></tr>`
              : profileRequests.map(r => `
                <tr>
                  <td class="table-cell font-medium">${escapeHtml(r.name)}</td>
                  <td class="table-cell">${escapeHtml(r.username)}</td>
                  <td class="table-cell text-slate-500 max-w-xs truncate">${r.message ? escapeHtml(r.message) : '<span class="text-slate-300">—</span>'}</td>
                  <td class="table-cell text-slate-500">${r.created_at}</td>
                  <td class="table-cell text-right">
                    <button class="btn btn-primary !py-1.5 !px-3 !text-xs" data-fill-profile="${r.user_id}" data-fill-name="${escapeHtml(r.name)}">Isi Profil</button>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    wrap.querySelectorAll('[data-fill-profile]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fillWrap = document.getElementById('fill-profile-wrap');
        fillWrap.classList.remove('hidden');
        document.getElementById('fill-profile-name').textContent = btn.dataset.fillName;
        fillWrap.querySelector('[name="target_user_id"]').value = btn.dataset.fillProfile;
        fillWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  if (filter === 'all') {
    wrap.innerHTML = `
      <div class="card overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left">
            <tr>
              <th class="table-cell">Nama</th>
              <th class="table-cell">Username</th>
              <th class="table-cell">Role</th>
              <th class="table-cell">Status</th>
              <th class="table-cell text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${allUsers.map(u => `
              <tr>
                <td class="table-cell">${escapeHtml(u.name)}</td>
                <td class="table-cell">${escapeHtml(u.username)}</td>
                <td class="table-cell">${escapeHtml(u.role_name)}</td>
                <td class="table-cell">${statusBadge(u.status)}</td>
                <td class="table-cell text-right">
                  ${u.id === Store.user.id
                    ? '<span class="text-xs text-slate-400">Akun Anda</span>'
                    : `<button class="icon-btn icon-btn-danger" data-tip="Hapus pengguna" data-delete="${u.id}">
                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                       </button>`}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    wrap.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Hapus user ini secara permanen?')) return;
      try { await api(`/users/${btn.dataset.delete}`, { method: 'DELETE' }); toast('User dihapus.', 'success'); renderAdminDashboard(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }
}

/* =========================================================
   SUBPAGE 2 — Penugasan Guru & Siswa (accordion per guru)
   ========================================================= */
function renderAssignTab(panel, data) {
  const { teachers } = data;
  panel.innerHTML = `
    <div class="mb-5">
      <h2 class="text-lg font-bold text-slate-800">Penugasan Guru &amp; Siswa</h2>
      <p class="text-sm text-slate-500">Tentukan siswa mana yang berada di bawah tanggung jawab setiap guru.</p>
    </div>
    ${teachers.length === 0
      ? '<div class="card p-5 text-sm text-slate-400">Belum ada Guru yang terdaftar dan disetujui.</div>'
      : `<div class="space-y-3">
          ${teachers.map(t => `
            <div class="card overflow-hidden" id="teacher-block-${t.id}">
              <button type="button" class="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition-colors" data-toggle-teacher="${t.id}">
                <div>
                  <p class="font-semibold text-sm text-slate-800">${escapeHtml(t.name)}</p>
                  <p class="text-xs text-slate-400">${escapeHtml(t.username)}</p>
                </div>
                <svg class="w-4 h-4 text-slate-400 transition-transform shrink-0" data-chevron="${t.id}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div class="hidden p-4 space-y-3 border-t border-slate-100" id="teacher-panel-${t.id}">
                <div id="teacher-student-table-${t.id}" class="text-sm text-slate-400">Memuat...</div>
                <div class="border-t border-slate-100 pt-3">
                  <p class="label mb-2">Tambah Siswa ke Guru Ini</p>
                  <div class="flex gap-2">
                    <select class="input" id="select-student-${t.id}">
                      <option value="">Memuat daftar siswa...</option>
                    </select>
                    <button class="btn btn-primary whitespace-nowrap" data-assign-student="${t.id}">Tambah</button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`}
  `;

  panel.querySelectorAll('[data-toggle-teacher]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const teacherId = btn.dataset.toggleTeacher;
      const p = document.getElementById(`teacher-panel-${teacherId}`);
      const chevron = panel.querySelector(`[data-chevron="${teacherId}"]`);
      p.classList.toggle('hidden');
      chevron.classList.toggle('rotate-180');
      if (!p.classList.contains('hidden')) {
        await loadTeacherPanel(teacherId);
      }
    });
  });
}

/* =========================================================
   SUBPAGE 3 — Data Akademik (Mata Pelajaran)
   ========================================================= */
function renderAcademicTab(panel, data) {
  const { subjects } = data;
  panel.innerHTML = `
    <div class="mb-5">
      <h2 class="text-lg font-bold text-slate-800">Data Akademik — Mata Pelajaran</h2>
      <p class="text-sm text-slate-500">Kelola daftar mata pelajaran / mata kuliah yang tersedia di sistem.</p>
    </div>
    <div class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-left">
          <tr>
            <th class="table-cell">Nama Mata Pelajaran</th>
            <th class="table-cell text-right">Aksi</th>
          </tr>
        </thead>
        <tbody id="subject-table-body">
          ${subjects.length === 0
            ? '<tr><td class="table-cell text-slate-400" colspan="2">Belum ada mata pelajaran.</td></tr>'
            : subjects.map(s => `<tr><td class="table-cell">${escapeHtml(s.subject_name)}</td><td class="table-cell"></td></tr>`).join('')}
          <tr id="subject-inline-row">
            <td class="table-cell p-0" colspan="2">
              <form id="create-subject-form" class="flex items-center gap-2 px-4 py-2.5">
                <input class="input" type="text" name="subject_name" placeholder="+ Tambah mata pelajaran baru…" required>
                <button type="submit" class="btn btn-primary whitespace-nowrap !text-xs">Tambah</button>
              </form>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  panel.querySelector('#create-subject-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/subjects', { method: 'POST', body: { subject_name: fd.get('subject_name') } });
      toast('Mata pelajaran ditambahkan.', 'success');
      renderAdminDashboard();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* =========================================================
   SUBPAGE 4 — Bank Soal (Question Bank)
   Admin bisa melihat & menghapus soal mana pun, TAPI tidak bisa mengedit isinya
   (edit hanya untuk guru penulis asli, dikelola dari dashboard Guru).
   ========================================================= */
const DIFFICULTY_BADGE_MAP = {
  Mudah:  'border-[#d5cbff] text-[#e94a76] bg-[#fff0f5]',
  Sedang: 'border-amber-300 text-amber-700 bg-amber-50',
  Sulit:  'border-red-300 text-red-700 bg-red-50',
};

function renderAdminBankSoalCard(q) {
  return `
    <div class="card p-4">
      <div class="flex justify-between items-start gap-3 mb-2">
        <p class="font-medium text-sm flex-1">${escapeHtml(q.question_text)}
          <span class="text-xs text-slate-400 font-normal ml-1">(bobot ${q.score_weight})</span>
        </p>
        <button class="btn btn-danger !py-1 !px-2.5 !text-xs shrink-0" data-delete-banksoal="${q.id}">Hapus</button>
      </div>
      <div class="flex flex-wrap gap-1.5 mb-3">
        ${q.subject_name ? `<span class="badge border-slate-200 text-slate-500">${escapeHtml(q.subject_name)}</span>` : ''}
        <span class="badge ${DIFFICULTY_BADGE_MAP[q.difficulty] || 'border-slate-300 text-slate-500'}">${escapeHtml(q.difficulty || '—')}</span>
        <span class="badge border-slate-200 text-slate-500">oleh ${escapeHtml(q.teacher_name || 'Guru terhapus')}</span>
      </div>
      ${q.image_url ? `<img src="${q.image_url}" alt="Gambar soal" class="max-h-32 rounded-lg border border-slate-200 object-contain bg-slate-50 mb-3">` : ''}
      <ul class="space-y-1">
        ${(q.options || []).map(o => `
          <li class="flex items-center gap-2 text-sm ${o.is_correct ? 'text-emerald-700 font-semibold' : 'text-slate-600'}">
            <span class="w-4 h-4 border ${o.is_correct ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'} inline-block shrink-0"></span>
            ${escapeHtml(o.option_text)}
          </li>`).join('')}
      </ul>
    </div>`;
}

function renderBankSoalTab(panel, data) {
  const { subjects } = data;
  panel.innerHTML = `
    <div class="mb-5">
      <h2 class="text-lg font-bold text-slate-800">Bank Soal</h2>
      <p class="text-sm text-slate-500">Seluruh soal yang tersimpan di sistem (dari semua guru). Admin bisa menghapus soal, tapi tidak bisa mengedit isinya.</p>
    </div>
    <div id="banksoal-browser"></div>
  `;

  const browser = renderBankSoalBrowser(panel.querySelector('#banksoal-browser'), {
    subjects,
    fetchQuestions: ({ subject_id, difficulty }) => {
      const params = new URLSearchParams();
      if (subject_id) params.set('subject_id', subject_id);
      if (difficulty) params.set('difficulty', difficulty);
      return api(`/questions/bank${params.toString() ? `?${params}` : ''}`);
    },
    renderItem: (q) => renderAdminBankSoalCard(q),
    afterRender: (itemListEl) => {
      itemListEl.querySelectorAll('[data-delete-banksoal]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Hapus soal ini secara permanen dari Bank Soal? Soal akan hilang dari semua ujian yang memakainya.')) return;
          try {
            await api(`/questions/${btn.dataset.deleteBanksoal}`, { method: 'DELETE' });
            toast('Soal dihapus dari Bank Soal.', 'success');
            browser.refresh();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    },
  });
}

/* ---- Panel siswa per guru ---- */
async function loadTeacherPanel(teacherId) {
  const tableEl  = document.getElementById(`teacher-student-table-${teacherId}`);
  const selectEl = document.getElementById(`select-student-${teacherId}`);

  try {
    const [students, unassigned] = await Promise.all([
      api(`/teachers/${teacherId}/students`),
      api(`/teachers/${teacherId}/students/unassigned`),
    ]);

    tableEl.innerHTML = students.length === 0
      ? '<p class="text-slate-400 text-xs">Belum ada siswa yang di-assign ke guru ini.</p>'
      : `<table class="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
           <thead class="bg-slate-50 text-left">
             <tr>
               <th class="table-cell">Nama Siswa</th>
               <th class="table-cell">Username</th>
               <th class="table-cell text-right">Aksi</th>
             </tr>
           </thead>
           <tbody>
             ${students.map(s => `
               <tr>
                 <td class="table-cell">${escapeHtml(s.name)}</td>
                 <td class="table-cell text-slate-500">${escapeHtml(s.username)}</td>
                 <td class="table-cell text-right">
                   <button class="icon-btn icon-btn-danger !w-8 !h-8" data-tip="Hapus dari guru" data-unassign-student="${s.id}" data-from-teacher="${teacherId}">
                     <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                   </button>
                 </td>
               </tr>`).join('')}
           </tbody>
         </table>`;

    tableEl.querySelectorAll('[data-unassign-student]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Hapus siswa ini dari daftar guru?')) return;
        try {
          await api(`/teachers/${btn.dataset.fromTeacher}/students/${btn.dataset.unassignStudent}`, { method: 'DELETE' });
          toast('Siswa dihapus dari guru.', 'success');
          await loadTeacherPanel(teacherId);
        } catch (err) { toast(err.message, 'error'); }
      });
    });

    selectEl.innerHTML = unassigned.length === 0
      ? '<option value="">— semua siswa sudah di-assign —</option>'
      : '<option value="">— pilih siswa —</option>' +
        unassigned.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.username)})</option>`).join('');

  } catch (err) {
    tableEl.innerHTML = `<p class="text-red-600 text-xs">${escapeHtml(err.message)}</p>`;
  }

  const assignBtn = document.querySelector(`[data-assign-student="${teacherId}"]`);
  if (assignBtn && !assignBtn.dataset.bound) {
    assignBtn.dataset.bound = '1';
    assignBtn.addEventListener('click', async () => {
      const studentId = document.getElementById(`select-student-${teacherId}`).value;
      if (!studentId) { toast('Pilih siswa terlebih dahulu.', 'error'); return; }
      try {
        await api(`/teachers/${teacherId}/students`, { method: 'POST', body: { studentIds: [Number(studentId)] } });
        toast('Siswa berhasil di-assign.', 'success');
        await loadTeacherPanel(teacherId);
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}