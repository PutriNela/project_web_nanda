import { Store } from '../core/store.js';
import { escapeHtml, confirmDialog } from '../core/utils.js';
import { navigate } from '../core/router.js';

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * shell(roleLabel, activeLabel, contentHtml)
 * Bungkus konten dashboard dengan sidebar kiri (identitas, keluar) + area konten.
 */
export function shell(roleLabel, activeLabel, contentHtml) {
  const user = Store.user;

  return `
    <div class="min-h-screen flex">
      <!-- SIDEBAR -->
      <aside class="app-sidebar w-64 shrink-0 hidden md:flex flex-col py-6 px-4">
        <div class="flex items-center gap-2.5 px-2 mb-8">
          <div class="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center font-extrabold text-white text-sm">UC</div>
          <div class="leading-tight">
            <p class="text-white font-extrabold text-sm">UjiCerdas</p>
            <p class="text-[11px] text-brand-200">Sistem Ujian CBT</p>
          </div>
        </div>

        <div class="px-2 mb-6">
          <div class="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
            <div class="w-9 h-9 rounded-full bg-brand-500/80 flex items-center justify-center text-white text-xs font-bold shrink-0">
              ${initials(user?.name)}
            </div>
            <div class="min-w-0">
              ${roleLabel === 'Guru'
                ? `<button type="button" id="btn-header-profile" class="block text-left text-sm text-white font-semibold truncate hover:underline">${escapeHtml(user?.name || '')}</button>`
                : `<p class="text-sm text-white font-semibold truncate">${escapeHtml(user?.name || '')}</p>`}
              <p class="text-[11px] text-brand-200">${escapeHtml(roleLabel)}</p>
            </div>
          </div>
        </div>

        <nav class="flex-1 space-y-1 px-2">
          <span class="app-nav-item active">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            Beranda
          </span>
        </nav>

        <button id="btn-logout" type="button" class="app-nav-item w-full mt-4 !text-rose-200 hover:!bg-rose-500/20 hover:!text-rose-100">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Keluar
        </button>
      </aside>

      <!-- MAIN -->
      <div class="flex-1 min-w-0 flex flex-col">
        <header class="md:hidden bg-white/90 backdrop-blur sticky top-0 z-30 shadow-[0_1px_0_0_var(--border)]">
          <div class="px-5 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center font-extrabold text-white text-[11px]">UC</div>
              <p class="text-sm text-slate-500 leading-tight">${escapeHtml(roleLabel)} — ${escapeHtml(user?.name || '')}</p>
            </div>
            <button id="btn-logout-mobile" class="btn btn-outline !py-1.5 !px-3 !text-xs">Keluar</button>
          </div>
        </header>
        <main class="flex-1 w-full mx-auto px-5 md:px-8 py-7 md:py-8 max-w-6xl">
          ${contentHtml}
        </main>
        <footer class="py-6 text-center text-xs text-slate-400">
          UjiCerdas — Sistem Ujian Berbasis Komputer, Lokal &amp; Mandiri
        </footer>
      </div>
    </div>
  `;
}

/**
 * attachLogout()
 * Pasang event listener tombol "Keluar". Dipanggil setelah shell() di-render ke DOM.
 */
export function attachLogout() {
  async function doLogout() {
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
  }

  document.getElementById('btn-logout')?.addEventListener('click', doLogout);
  document.getElementById('btn-logout-mobile')?.addEventListener('click', doLogout);
  document.getElementById('btn-header-profile')?.addEventListener('click', () => navigate('#profile'));
}
