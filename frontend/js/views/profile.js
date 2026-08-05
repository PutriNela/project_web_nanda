import { app } from '../core/dom.js';
import { api, apiUpload } from '../core/api.js';
import { Store } from '../core/store.js';
import { toast, escapeHtml, confirmDialog } from '../core/utils.js';
import { navigate } from '../core/router.js';

/* ================================================================
   HALAMAN PROFIL (update setelah onboarding — bukan halaman first sign up)
   Reachable dari klik nama/role di header (shell.js / studentNav dropdown).
   ================================================================ */
export async function renderProfilePage() {
  const user = Store.user;
  if (user?.role === 'Guru') return _renderTeacherProfileEdit();
  if (user?.role === 'Siswa') return _renderStudentProfileEdit();
  navigate('#login');
}

// ---- Guru: update nama, data diri, mata kuliah, dan foto profil ----
async function _renderTeacherProfileEdit() {
  const user = Store.user;
  let profile = null, subjects = [];
  try {
    [profile, subjects] = await Promise.all([api('/profile/me'), api('/subjects')]);
  } catch (err) {
    toast(err.message, 'error');
  }

  const hasPhoto = !!profile?.photo_url;
  app.innerHTML = `
    <div class="min-h-screen page-bg flex flex-col">
      ${_profileNav(user)}
      <main class="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <div class="mb-8">
          <a href="#dashboard-guru" class="text-sm text-slate-500 underline">&larr; Kembali ke Dashboard</a>
          <h1 class="text-2xl font-bold mt-2">Profil Saya</h1>
          <p class="text-sm text-slate-500 mt-1">Perbarui nama, data diri, dan foto profil Anda.</p>
        </div>

        <div class="card p-6">
          <div class="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
            <div class="relative w-20 h-20 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shrink-0 avatar-edit-trigger">
              ${hasPhoto
                ? `<img id="profile-photo-img" src="${profile.photo_url}" alt="Foto profil" class="w-full h-full object-cover">`
                : `<span class="text-2xl font-bold text-slate-500">${_initials(profile?.full_name || user?.name || '?')}</span>`}
              <label class="avatar-overlay absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 17a4 4 0 100-8 4 4 0 000 8z"/>
                </svg>
                <input type="file" accept="image/*" id="profile-photo-input" class="sr-only">
              </label>
            </div>
            <div>
              <p class="font-semibold text-slate-800">Foto Profil</p>
              ${hasPhoto
                ? `<button type="button" id="btn-remove-photo" class="text-xs text-red-500 hover:underline mt-1">Hapus foto</button>`
                : `<p class="text-xs text-slate-400 mt-1">Klik ikon kamera untuk unggah foto.</p>`}
            </div>
          </div>

          <form id="profile-edit-form" class="space-y-4">
            <div class="grid md:grid-cols-2 gap-4">
              <div>
                <label class="label">Nama Lengkap + Gelar</label>
                <input class="input" type="text" name="full_name" value="${escapeHtml(profile?.full_name || '')}" placeholder="Dr. Budi Santoso, M.Kom." required>
              </div>
              <div>
                <label class="label">Nomor Induk (NIP / NIDN)</label>
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
              ${subjects.length === 0
                ? `<p class="text-xs text-slate-400 italic">Belum ada mata kuliah tersedia.</p>`
                : `<div class="border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto rounded-lg">
                    ${subjects.map(s => {
                      const checked = profile?.subjects?.some(ps => ps.id === s.id) ? 'checked' : '';
                      return `<label class="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" name="subject_ids" value="${s.id}" class="shrink-0" ${checked}>
                        ${escapeHtml(s.subject_name)}
                      </label>`;
                    }).join('')}
                  </div>`}
            </div>
            <button type="submit" class="btn btn-primary w-full">Simpan Perubahan</button>
          </form>
        </div>
      </main>
    </div>
  `;

  _attachProfileLogout();

  document.getElementById('profile-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const subject_ids = [...fd.getAll('subject_ids')].map(Number);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      await api('/profile/me', {
        method: 'POST',
        body: {
          full_name: fd.get('full_name'),
          nomor_induk: fd.get('nomor_induk'),
          address: fd.get('address'),
          phone: fd.get('phone'),
          subject_ids,
        },
      });
      Store.user = { ...Store.user, name: fd.get('full_name') || Store.user.name };
      toast('Profil berhasil diperbarui.', 'success');
      _renderTeacherProfileEdit();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Simpan Perubahan';
    }
  });

  document.getElementById('profile-photo-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await apiUpload('/profile/photo', 'photo', file);
      toast('Foto profil diperbarui.', 'success');
      _renderTeacherProfileEdit();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('btn-remove-photo')?.addEventListener('click', async () => {
    if (!confirm('Hapus foto profil?')) return;
    try {
      await api('/profile/photo', { method: 'DELETE' });
      toast('Foto profil dihapus.', 'success');
      _renderTeacherProfileEdit();
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ---- Siswa: hanya update nama (tanpa avatar, sesuai keputusan produk) ----
async function _renderStudentProfileEdit() {
  const user = Store.user;
  let profile = null;
  try {
    profile = await api('/student/profile/me');
  } catch (err) {
    toast(err.message, 'error');
  }

  app.innerHTML = `
    <div class="min-h-screen page-bg flex flex-col">
      ${_profileNav(user)}
      <main class="flex-1 flex items-center justify-center px-6 py-10">
        <div class="w-full max-w-lg">
          <div class="mb-6">
            <a href="#dashboard-siswa" class="text-sm text-slate-500 underline">&larr; Kembali ke Kelas Saya</a>
          </div>
          <div class="text-center mb-8">
            <div class="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
              <span class="text-white text-2xl font-bold">${_initials(profile?.full_name || user?.name || '?')}</span>
            </div>
            <h1 class="text-2xl font-bold">Profil Saya</h1>
            <p class="text-sm text-slate-500 mt-1">Perbarui nama Anda.</p>
          </div>

          <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <form id="student-profile-edit-form" class="space-y-4">
              <div>
                <label class="label">Nama Lengkap</label>
                <input class="input rounded-lg" type="text" name="full_name" value="${escapeHtml(profile?.full_name || '')}" placeholder="Nama sesuai KTP / dokumen resmi" required>
              </div>
              <button type="submit" class="btn btn-primary w-full rounded-lg py-3 text-base">Simpan Perubahan</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  `;

  _attachProfileLogout();

  document.getElementById('student-profile-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      // Backend mewajibkan nim/address/phone tetap dikirim; kirim balik nilai lama
      // supaya field itu tidak ikut berubah — halaman ini memang cuma untuk update nama.
      await api('/student/profile/me', {
        method: 'POST',
        body: {
          full_name: fd.get('full_name'),
          nim: profile?.nim || '',
          address: profile?.address || '',
          phone: profile?.phone || '',
        },
      });
      Store.user = { ...Store.user, name: fd.get('full_name') || Store.user.name };
      toast('Nama berhasil diperbarui.', 'success');
      _renderStudentProfileEdit();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Simpan Perubahan';
    }
  });
}

/* ================================================================
   TEACHER — Halaman lengkapi profil dosen
   ================================================================ */
export async function renderCompleteProfile() {
  let existingRequest = null, subjects = [];
  try {
    [existingRequest, subjects] = await Promise.all([
      api('/profile/request/me').catch(() => null),
      api('/subjects'),
    ]);
  } catch (_) {}

  const user = Store.user;
  app.innerHTML = `
    <div class="min-h-screen page-bg flex flex-col">
      ${_profileNav(user)}
      <main class="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <div class="mb-8">
          <span class="inline-block badge border-amber-300 text-amber-700 bg-amber-50 mb-3">Profil Belum Lengkap</span>
          <h1 class="text-2xl font-bold">Lengkapi Profil Anda</h1>
          <p class="text-sm text-slate-500 mt-1">Isi data profil sebelum dapat menggunakan sistem. Pilih salah satu cara di bawah.</p>
        </div>

        <div class="flex border-b border-slate-200 mb-6 gap-1">
          <button id="tab-self" class="px-4 py-2 text-sm font-semibold border-b-2 border-slate-900 -mb-px">Isi Sendiri</button>
          <button id="tab-request" class="px-4 py-2 text-sm font-semibold text-slate-500 border-b-2 border-transparent -mb-px hover:text-slate-800">Minta Admin</button>
        </div>

        <div id="panel-self">
          <div class="card p-6">
            <form id="profile-form" class="space-y-4">
              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label class="label">Nama Lengkap + Gelar</label>
                  <input class="input" type="text" name="full_name" placeholder="Dr. Budi Santoso, M.Kom." required>
                </div>
                <div>
                  <label class="label">Nomor Induk (NIP / NIDN)</label>
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
                <p class="text-xs text-slate-400 mb-2">Pilih satu atau lebih. Bisa diubah nanti.</p>
                ${subjects.length === 0
                  ? `<p class="text-xs text-slate-400 italic">Belum ada mata kuliah tersedia.</p>`
                  : `<div class="border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      ${subjects.map(s => `
                        <label class="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                          <input type="checkbox" name="subject_ids" value="${s.id}" class="shrink-0">
                          ${escapeHtml(s.subject_name)}
                        </label>`).join('')}
                    </div>`}
              </div>
              <button type="submit" class="btn btn-primary w-full">Simpan Profil &amp; Masuk Dashboard</button>
            </form>
          </div>
        </div>

        <div id="panel-request" class="hidden">
          ${existingRequest && existingRequest.status === 'pending'
            ? `<div class="card p-6 space-y-4">
                <div class="flex items-start gap-3">
                  <div class="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0"></div>
                  <div>
                    <p class="font-semibold">Permintaan sedang menunggu</p>
                    <p class="text-sm text-slate-500 mt-0.5">Admin akan mengisi profil Anda. Halaman ini akan terbuka setelah profil diisi.</p>
                    ${existingRequest.message ? `<p class="text-xs text-slate-400 mt-2 border-l-2 border-slate-200 pl-2 italic">"${escapeHtml(existingRequest.message)}"</p>` : ''}
                  </div>
                </div>
                <button id="btn-cancel-request" class="btn btn-danger w-full">Batalkan Permintaan</button>
              </div>`
            : `<div class="card p-6 space-y-4">
                <p class="text-sm text-slate-600">Kirim permintaan ke Admin agar mereka mengisi profil Anda.</p>
                <form id="request-form" class="space-y-3">
                  <div>
                    <label class="label">Pesan untuk Admin <span class="font-normal text-slate-400">(opsional)</span></label>
                    <textarea class="input" name="message" rows="3" placeholder="Contoh: NIP saya 198501012010011001."></textarea>
                  </div>
                  <button type="submit" class="btn btn-primary w-full">Kirim Permintaan ke Admin</button>
                </form>
              </div>`}
        </div>
      </main>
    </div>
  `;

  _attachProfileLogout();
  _attachTabs('tab-self', 'tab-request', 'panel-self', 'panel-request');

  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const subject_ids = [...fd.getAll('subject_ids')].map(Number);
    try {
      await api('/profile/me', { method: 'POST', body: { full_name: fd.get('full_name'), nomor_induk: fd.get('nomor_induk'), address: fd.get('address'), phone: fd.get('phone'), subject_ids } });
      Store.user = { ...Store.user, profile_completed: 1 };
      toast('Profil berhasil disimpan. Selamat datang!', 'success');
      navigate('#dashboard-guru');
    } catch (err) { toast(err.message, 'error'); }
  });
  document.getElementById('request-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/profile/request', { method: 'POST', body: { message: fd.get('message') } });
      toast('Permintaan dikirim ke Admin.', 'success');
      renderCompleteProfile();
    } catch (err) { toast(err.message, 'error'); }
  });
  document.getElementById('btn-cancel-request')?.addEventListener('click', async () => {
    if (!confirm('Batalkan permintaan?')) return;
    try { await api('/profile/request', { method: 'DELETE' }); toast('Permintaan dibatalkan.', 'success'); renderCompleteProfile(); }
    catch (err) { toast(err.message, 'error'); }
  });
}

/* ================================================================
   STUDENT — Halaman lengkapi profil mahasiswa
   ================================================================ */
export async function renderCompleteStudentProfile() {
  const user = Store.user;
  app.innerHTML = `
    <div class="min-h-screen page-bg flex flex-col">
      ${_profileNav(user)}
      <main class="flex-1 flex items-center justify-center px-6 py-10">
        <div class="w-full max-w-lg">
          <div class="text-center mb-8">
            <div class="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
              <span class="text-white text-2xl font-bold">${_initials(user?.name || '?')}</span>
            </div>
            <span class="inline-block badge border-amber-300 text-amber-700 bg-amber-50 mb-3">Satu Langkah Lagi</span>
            <h1 class="text-2xl font-bold">Lengkapi Data Diri</h1>
            <p class="text-sm text-slate-500 mt-1">Data ini dibutuhkan sebelum Anda dapat mengakses ujian.</p>
          </div>

          <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <form id="student-profile-form" class="space-y-4">
              <div>
                <label class="label">Nama Lengkap</label>
                <input class="input rounded-lg" type="text" name="full_name" placeholder="Nama sesuai KTP / dokumen resmi" required>
              </div>
              <div>
                <label class="label">NIM (Nomor Induk Mahasiswa)</label>
                <input class="input rounded-lg" type="text" name="nim" placeholder="cth. 2021010001" required>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label">Nomor Telepon</label>
                  <input class="input rounded-lg" type="tel" name="phone" placeholder="08xxxxxxxxxx" required>
                </div>
                <div>
                  <label class="label">Alamat</label>
                  <input class="input rounded-lg" type="text" name="address" placeholder="Kota / Kabupaten" required>
                </div>
              </div>
              <button type="submit" class="btn btn-primary w-full rounded-lg py-3 text-base">
                Simpan &amp; Masuk Dashboard
              </button>
            </form>
          </div>

          <p class="text-xs text-slate-400 text-center mt-4">
            Data ini hanya digunakan untuk keperluan akademik dan tidak dibagikan ke pihak ketiga.
          </p>
        </div>
      </main>
    </div>
  `;

  _attachProfileLogout();

  document.getElementById('student-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
    try {
      await api('/student/profile/me', {
        method: 'POST',
        body: { full_name: fd.get('full_name'), nim: fd.get('nim'), address: fd.get('address'), phone: fd.get('phone') },
      });
      Store.user = { ...Store.user, profile_completed: 1 };
      toast('Selamat datang, ' + (fd.get('full_name') || Store.user.name) + '!', 'success');
      navigate('#dashboard-siswa');
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Simpan & Masuk Dashboard';
    }
  });
}

/* ================================================================
   HELPERS
   ================================================================ */
function _initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function _profileNav(user) {
  return `
    <header class="border-b border-slate-200 bg-white">
      <div class="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
        <div></div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-500">${escapeHtml(user?.name || '')}</span>
          <button id="profile-logout-btn" class="btn btn-outline">Keluar</button>
        </div>
      </div>
    </header>`;
}

function _attachProfileLogout() {
  document.getElementById('profile-logout-btn')?.addEventListener('click', async () => {
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

function _attachTabs(tabAId, tabBId, panelAId, panelBId) {
  const tabA = document.getElementById(tabAId);
  const tabB = document.getElementById(tabBId);
  const panelA = document.getElementById(panelAId);
  const panelB = document.getElementById(panelBId);
  if (!tabA || !tabB) return;
  tabA.addEventListener('click', () => {
    tabA.classList.add('border-slate-900'); tabA.classList.remove('text-slate-500', 'border-transparent');
    tabB.classList.remove('border-slate-900'); tabB.classList.add('text-slate-500', 'border-transparent');
    panelA.classList.remove('hidden'); panelB.classList.add('hidden');
  });
  tabB.addEventListener('click', () => {
    tabB.classList.add('border-slate-900'); tabB.classList.remove('text-slate-500', 'border-transparent');
    tabA.classList.remove('border-slate-900'); tabA.classList.add('text-slate-500', 'border-transparent');
    panelB.classList.remove('hidden'); panelA.classList.add('hidden');
  });
}