import { escapeHtml } from './utils.js';

/**
 * Komponen Bank Soal drill-down: Mapel -> Tingkat Kesulitan -> "Kumpulan Soal"
 * (search bar + pagination 10/halaman). Dipakai ulang di Admin, Pengelola Soal,
 * dan modal "Ambil dari Bank Soal" milik Guru — hanya beda `subjects` yang
 * dikirim (Guru: cuma mapel yang diajar) dan `renderItem`/`afterRender` (aksi
 * per-soal beda tiap role).
 *
 * Tidak ada lagi fitur "tampilkan seluruh soal": defaultnya cuma tampil
 * container pemilihan kategori (Mapel), soal baru dimuat setelah Mapel +
 * Tingkat Kesulitan dipilih.
 */

const DIFFICULTY_LEVELS = ['Mudah', 'Sedang', 'Sulit'];
const DIFFICULTY_STYLES = {
  Mudah:  'border-[#d5cbff] text-[#e94a76] bg-[#fff0f5]',
  Sedang: 'border-amber-300 text-amber-700 bg-amber-50',
  Sulit:  'border-red-300 text-red-700 bg-red-50',
};
const PAGE_SIZE = 10;

/**
 * @param {HTMLElement} root
 * @param {Object} opts
 * @param {Array}    opts.subjects        - daftar mapel yang boleh dipilih (sudah difilter sesuai role)
 * @param {Function} opts.fetchQuestions  - async ({subject_id, difficulty}) => questions[]
 * @param {Function} opts.renderItem      - (question, indexGlobal) => htmlString kartu soal
 * @param {Function} [opts.afterRender]   - (itemListEl, questionsDitampilkan) => void, attach event listener aksi
 * @param {String}   [opts.title]         - judul container hasil, default "Kumpulan Soal"
 * @param {String}   [opts.emptySubjectsMessage]
 * @returns {{ refresh: Function }}
 */
export function renderBankSoalBrowser(root, opts) {
  const {
    subjects,
    fetchQuestions,
    renderItem,
    afterRender,
    title = 'Kumpulan Soal',
    emptySubjectsMessage = 'Belum ada mata pelajaran yang tersedia.',
  } = opts;

  const state = { subjectId: null, subjectName: '', difficulty: null, search: '', page: 1, allQuestions: null };

  function render() {
    root.innerHTML = `
      <div class="space-y-4">
        ${renderBreadcrumb()}
        ${!state.subjectId ? renderSubjectPicker() : ''}
        ${state.subjectId && !state.difficulty ? renderDifficultyPicker() : ''}
        ${state.subjectId && state.difficulty ? '<div id="bsb-results"></div>' : ''}
      </div>
    `;
    attachPickerEvents();
    if (state.subjectId && state.difficulty) loadResults();
  }

  function renderBreadcrumb() {
    if (!state.subjectId) return '';
    const parts = [`<button type="button" class="hover:underline hover:text-[#e94a76]" data-bsb-crumb="subject">Pilih Mapel</button>`];
    parts.push(`<span class="text-slate-300">/</span>`);
    parts.push(`<button type="button" class="hover:underline hover:text-[#e94a76] ${!state.difficulty ? 'font-semibold text-slate-700' : ''}" data-bsb-crumb="difficulty">${escapeHtml(state.subjectName)}</button>`);
    if (state.difficulty) {
      parts.push(`<span class="text-slate-300">/</span>`);
      parts.push(`<span class="font-semibold text-slate-700">${escapeHtml(state.difficulty)}</span>`);
    }
    return `<div class="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">${parts.join('')}</div>`;
  }

  function renderSubjectPicker() {
    if (subjects.length === 0) {
      return `<div class="card p-6 text-center text-sm text-slate-400">${escapeHtml(emptySubjectsMessage)}</div>`;
    }
    return `
      <div class="card p-5">
        <p class="label mb-3">Pilih Mata Pelajaran</p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          ${subjects.map(s => `
            <button type="button" data-bsb-subject="${s.id}" data-bsb-subject-name="${escapeHtml(s.subject_name)}"
              class="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 text-left text-sm font-medium text-slate-700 hover:border-[#b6a3ff] hover:bg-[#fff0f5] hover:text-[#e94a76] transition-colors">
              <span>${escapeHtml(s.subject_name)}</span>
              <svg class="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>`).join('')}
        </div>
      </div>`;
  }

  function renderDifficultyPicker() {
    return `
      <div class="card p-5">
        <p class="label mb-3">Pilih Tingkat Kesulitan — <span class="font-normal text-slate-500">${escapeHtml(state.subjectName)}</span></p>
        <div class="flex flex-wrap gap-2.5">
          ${DIFFICULTY_LEVELS.map(d => `
            <button type="button" data-bsb-difficulty="${d}"
              class="badge !text-sm !px-4 !py-2 cursor-pointer ${DIFFICULTY_STYLES[d]} hover:opacity-75 transition-opacity">
              ${d}
            </button>`).join('')}
        </div>
      </div>`;
  }

  function attachPickerEvents() {
    root.querySelectorAll('[data-bsb-subject]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.subjectId = btn.dataset.bsbSubject;
        state.subjectName = btn.dataset.bsbSubjectName;
        state.difficulty = null;
        state.allQuestions = null;
        render();
      });
    });
    root.querySelectorAll('[data-bsb-difficulty]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.difficulty = btn.dataset.bsbDifficulty;
        state.search = '';
        state.page = 1;
        state.allQuestions = null;
        render();
      });
    });
    root.querySelectorAll('[data-bsb-crumb]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.bsbCrumb;
        if (target === 'subject') { state.subjectId = null; state.subjectName = ''; state.difficulty = null; }
        if (target === 'difficulty') { state.difficulty = null; }
        state.allQuestions = null;
        render();
      });
    });
  }

  async function loadResults() {
    const resultsEl = root.querySelector('#bsb-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = renderSkeleton();
    if (state.allQuestions === null) {
      try {
        state.allQuestions = await fetchQuestions({ subject_id: state.subjectId, difficulty: state.difficulty });
      } catch (err) {
        resultsEl.innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
        return;
      }
    }
    renderList(resultsEl);
  }

  function renderSkeleton() {
    return `
      <div class="card p-5">
        <div class="flex items-center justify-between gap-3 mb-4">
          <div class="h-5 w-32 bg-slate-100 rounded animate-pulse"></div>
          <div class="h-9 w-full sm:w-64 bg-slate-100 rounded-lg animate-pulse"></div>
        </div>
        <div class="space-y-3">
          ${[1, 2, 3].map(() => '<div class="h-20 bg-slate-100 rounded-lg animate-pulse"></div>').join('')}
        </div>
      </div>`;
  }

  function renderList(resultsEl) {
    const q = state.search.trim().toLowerCase();
    const filtered = q
      ? state.allQuestions.filter(item => item.question_text.toLowerCase().includes(q))
      : state.allQuestions;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const pageItems = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    resultsEl.innerHTML = `
      <div class="card p-5">
        <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 class="font-bold text-slate-800">${escapeHtml(title)} <span class="text-slate-400 font-normal text-sm">(${filtered.length})</span></h3>
          <div class="relative w-full sm:w-64">
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" id="bsb-search" class="input !pl-9" placeholder="Cari teks soal..." value="${escapeHtml(state.search)}">
          </div>
        </div>
        <div id="bsb-item-list" class="space-y-3">
          ${pageItems.length === 0
            ? `<p class="text-sm text-slate-400 text-center py-6">${state.search ? 'Tidak ada soal yang cocok dengan pencarian.' : 'Belum ada soal untuk kategori ini.'}</p>`
            : pageItems.map((item, i) => renderItem(item, (state.page - 1) * PAGE_SIZE + i)).join('')}
        </div>
        ${totalPages > 1 ? `
        <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <p class="text-xs text-slate-400">Halaman ${state.page} dari ${totalPages}</p>
          <div class="flex gap-1.5">
            <button type="button" class="btn btn-outline !py-1 !px-2.5 !text-xs" id="bsb-prev" ${state.page <= 1 ? 'disabled' : ''}>&larr; Sebelumnya</button>
            <button type="button" class="btn btn-outline !py-1 !px-2.5 !text-xs" id="bsb-next" ${state.page >= totalPages ? 'disabled' : ''}>Berikutnya &rarr;</button>
          </div>
        </div>` : ''}
      </div>
    `;

    const itemListEl = resultsEl.querySelector('#bsb-item-list');
    afterRender?.(itemListEl, pageItems);

    const searchInput = resultsEl.querySelector('#bsb-search');
    let searchTimer;
    searchInput.addEventListener('input', () => {
      const cursorPos = searchInput.selectionStart;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = searchInput.value;
        state.page = 1;
        renderList(resultsEl);
        const freshInput = resultsEl.querySelector('#bsb-search');
        if (freshInput) { freshInput.focus(); freshInput.setSelectionRange(cursorPos, cursorPos); }
      }, 250);
    });
    resultsEl.querySelector('#bsb-prev')?.addEventListener('click', () => { state.page--; renderList(resultsEl); });
    resultsEl.querySelector('#bsb-next')?.addEventListener('click', () => { state.page++; renderList(resultsEl); });
  }

  render();

  return {
    /** Muat ulang daftar soal untuk kategori yang sedang aktif (mis. setelah hapus/edit/tambah soal) tanpa reset drill-down. */
    refresh() {
      state.allQuestions = null;
      if (state.subjectId && state.difficulty) {
        loadResults();
      } else {
        render();
      }
    },
  };
}