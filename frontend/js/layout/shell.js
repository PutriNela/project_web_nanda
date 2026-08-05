import { Store } from '../core/store.js';
import { escapeHtml, confirmDialog } from '../core/utils.js';
import { navigate } from '../core/router.js';

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * shell(roleLabel, navItems, activeKey, contentHtml)
 *
 * Bungkus konten dashboard dengan sidebar kiri (identitas, navigasi, keluar) + area konten.
 *
 * navItems: array of { key, label, icon (svg string), badge (number|string, optional) }
 *   Setiap item dirender sebagai tombol navigasi di sidebar ("navigasi card").
 *   Klik akan otomatis menonaktifkan item lain & mengaktifkan yang diklik (lihat attachShellNav).
 * activeKey: key item yang sedang aktif di awal render.
 */
export function shell(roleLabel, navItems, activeKey, contentHtml) {
  const user = Store.user;
  const items = Array.isArray(navItems) ? navItems : [];

  const navHtml = items.map(item => `
    <button type="button" data-nav-key="${item.key}"
            class="app-nav-item w-full text-left ${item.key === activeKey ? 'active' : ''}">
      <span class="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4">${item.icon || ''}</span>
      <span class="flex-1 truncate">${escapeHtml(item.label)}</span>
      ${item.badge ? `<span class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shrink-0">${item.badge}</span>` : ''}
    </button>
  `).join('');

  return `
    <div class="min-h-screen flex">
      <!-- SIDEBAR -->
      <aside class="app-sidebar w-64 shrink-0 hidden md:flex flex-col py-6 px-4">
        <div class="flex items-center gap-2.5 px-2 mb-8">
          <div class="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center font-extrabold text-white text-sm font-heading">UC</div>
          <div class="leading-tight">
            <p class="text-white font-extrabold text-sm font-heading">UjiCerdas</p>
            <p class="text-[11px] text-brand-200">Ruang Belajar Seru</p>
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

        <nav class="flex-1 space-y-1 px-2 overflow-y-auto">
          ${navHtml}
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
          ${items.length > 1 ? `
          <div class="px-5 pb-3 flex gap-2 overflow-x-auto">
            ${items.map(item => `
              <button type="button" data-nav-key-mobile="${item.key}"
                      class="side-nav-item shrink-0 !py-1.5 !px-3 !text-xs ${item.key === activeKey ? 'active' : ''}">
                ${escapeHtml(item.label)}
                ${item.badge ? `<span class="ml-1 opacity-80">(${item.badge})</span>` : ''}
              </button>
            `).join('')}
          </div>` : ''}
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

/**
 * attachShellNav(onSelect)
 * Pasang event listener untuk item navigasi sidebar (desktop) & tab mobile.
 * Otomatis toggle class "active" pada tombol yang diklik, lalu panggil onSelect(key).
 * Dipanggil setelah shell() di-render ke DOM, sekali per render.
 */
export function attachShellNav(onSelect) {
  const desktopBtns = document.querySelectorAll('[data-nav-key]');
  const mobileBtns  = document.querySelectorAll('[data-nav-key-mobile]');

  function setActive(key) {
    desktopBtns.forEach(b => b.classList.toggle('active', b.dataset.navKey === key));
    mobileBtns.forEach(b => b.classList.toggle('active', b.dataset.navKeyMobile === key));
  }

  desktopBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setActive(btn.dataset.navKey);
      onSelect(btn.dataset.navKey);
    });
  });
  mobileBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setActive(btn.dataset.navKeyMobile);
      onSelect(btn.dataset.navKeyMobile);
    });
  });
}