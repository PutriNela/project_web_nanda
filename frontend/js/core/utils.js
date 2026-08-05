/**
 * toast(message, type)
 * Menampilkan notifikasi singkat di pojok kanan atas.
 */
export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  const colors = {
    info: 'bg-slate-800 text-white',
    error: 'bg-red-600 text-white',
    success: 'bg-[#e94a76] text-white',
  };
  const el = document.createElement('div');
  el.className = `${colors[type]} px-4 py-2.5 text-sm font-medium rounded-xl shadow-lg max-w-sm fade-in`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/**
 * escapeHtml(str)
 * Mencegah XSS saat menyisipkan data user ke dalam template string HTML.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/**
 * fmtScore(score)
 * Format nilai numerik jadi 2 desimal, atau em-dash jika kosong.
 */
export function fmtScore(score) {
  if (score === null || score === undefined) return '—';
  return Number(score).toFixed(2);
}

/**
 * confirmDialog({ title, message, confirmLabel, cancelLabel, danger })
 * Modal konfirmasi kustom (tengah layar, background gelap) menggantikan confirm() bawaan browser.
 * Mengembalikan Promise<boolean> — true jika user klik "Ya", false jika "Tidak"/klik luar/Escape.
 */
export function confirmDialog({ title = 'Konfirmasi', message = '', confirmLabel = 'Ya', cancelLabel = 'Tidak', danger = false } = {}) {
  return new Promise((resolve) => {
    document.getElementById('confirm-dialog-root')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirm-dialog-root';
    overlay.className = 'fixed inset-0 z-[80] flex items-center justify-center px-4';
    overlay.innerHTML = `
      <div class="modal-backdrop" data-confirm-backdrop></div>
      <div class="modal-panel relative w-full max-w-sm p-6 fade-in text-center" role="alertdialog" aria-modal="true">
        <h3 class="font-bold text-lg text-slate-800 mb-2">${escapeHtml(title)}</h3>
        <p class="text-sm text-slate-500 leading-relaxed mb-6">${escapeHtml(message)}</p>
        <div class="flex gap-2">
          <button type="button" class="btn btn-outline flex-1" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} flex-1" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-confirm-ok]').focus();

    const cleanup = (result) => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
      resolve(result);
    };
    const onKeydown = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    overlay.querySelector('[data-confirm-ok]').addEventListener('click', () => cleanup(true));
    overlay.querySelector('[data-confirm-cancel]').addEventListener('click', () => cleanup(false));
    overlay.querySelector('[data-confirm-backdrop]').addEventListener('click', () => cleanup(false));
    document.addEventListener('keydown', onKeydown);
  });
}

/**
 * openImageLightbox(src, alt)
 * Preview gambar penuh layar (klik gambar soal untuk memperbesar).
 */
export function openImageLightbox(src, alt = 'Preview gambar') {
  document.getElementById('image-lightbox-root')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'image-lightbox-root';
  overlay.className = 'fixed inset-0 z-[75] flex items-center justify-center px-4 py-10';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/85 backdrop-blur-sm" data-lightbox-close></div>
    <button type="button"
      class="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      data-lightbox-close aria-label="Tutup preview">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
    <img src="${src}" alt="${escapeHtml(alt)}" class="relative max-w-full max-h-full rounded-lg shadow-2xl object-contain fade-in">
  `;
  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  };
  const onKeydown = (e) => { if (e.key === 'Escape') close(); };

  overlay.querySelectorAll('[data-lightbox-close]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', onKeydown);
}

/**
 * enableImageLightbox(root, selector)
 * Pasang klik-untuk-preview pada semua <img> yang cocok dengan selector di dalam root.
 */
export function enableImageLightbox(root, selector = '[data-lightbox]') {
  root.querySelectorAll(selector).forEach(img => {
    img.classList.add('cursor-zoom-in');
    img.addEventListener('click', () => openImageLightbox(img.src, img.alt));
  });
}