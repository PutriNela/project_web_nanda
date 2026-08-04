import { app } from '../core/dom.js';
import { api, apiUpload } from '../core/api.js';
import { toast, escapeHtml, enableImageLightbox } from '../core/utils.js';
import { shell, attachLogout } from '../layout/shell.js';
import { renderBankSoalBrowser } from '../core/bankSoalBrowser.js';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const DIFFICULTY_OPTIONS = ['Mudah', 'Sedang', 'Sulit'];
const DIFFICULTY_BADGE_MAP = {
  Mudah:  'border-[#d5cbff] text-[#5b2ad1] bg-[#f4f2ff]',
  Sedang: 'border-amber-300 text-amber-700 bg-amber-50',
  Sulit:  'border-red-300 text-red-700 bg-red-50',
};

function difficultyBadge(difficulty) {
  return `<span class="badge ${DIFFICULTY_BADGE_MAP[difficulty] || 'border-slate-300 text-slate-500'}">${escapeHtml(difficulty || '—')}</span>`;
}

/**
 * Dashboard Pengelola Soal — role independen yang HANYA mengelola Bank Soal miliknya sendiri.
 * Tidak punya akses ujian, penilaian, atau data siswa sama sekali.
 */
export async function renderPengelolaSoalDashboard() {
  app.innerHTML = shell('Pengelola Soal', 'dashboard', `<div id="ps-content" class="text-sm text-slate-500">Memuat Bank Soal...</div>`);
  attachLogout();

  let subjects = [];
  try {
    subjects = await api('/subjects');
  } catch (err) {
    document.getElementById('ps-content').innerHTML = `<p class="text-red-600 text-sm">${escapeHtml(err.message)}</p>`;
    return;
  }

  const content = document.getElementById('ps-content');
  content.innerHTML = `
    <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-xl font-bold">Bank Soal</h1>
        <p class="text-sm text-slate-500 mt-1">Kelola seluruh soal di Bank Soal dari semua guru. Anda bisa mengedit dan menghapus soal siapa pun.</p>
      </div>
      <button type="button" id="btn-show-new-question" class="btn btn-primary">+ Buat Soal Baru</button>
    </div>

    <!-- FORM BUAT SOAL BARU -->
    <div id="new-question-form-wrap" class="hidden card p-5 mb-6">
      <h2 class="font-bold mb-3">Buat Soal Baru</h2>
      <form id="add-question-form" class="space-y-3">
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
              ${DIFFICULTY_OPTIONS.map(d => `<option value="${d}" ${d === 'Sedang' ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="label">Bobot Nilai Soal</label>
            <input class="input" type="number" name="score_weight" value="1" min="0.1" step="0.1" required>
          </div>
        </div>
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

    <div id="ps-bank-browser"></div>
  `;

  // Cache soal yang sedang tampil di halaman aktif, dipakai handler edit/hapus/gambar di bawah.
  const questionCache = new Map();

  const browser = renderBankSoalBrowser(document.getElementById('ps-bank-browser'), {
    subjects,
    title: 'Kumpulan Soal',
    fetchQuestions: ({ subject_id, difficulty }) => {
      const params = new URLSearchParams();
      if (subject_id) params.set('subject_id', subject_id);
      if (difficulty) params.set('difficulty', difficulty);
      return api(`/questions/bank${params.toString() ? `?${params}` : ''}`);
    },
    renderItem: (q, idx) => renderQuestionCard(q, idx),
    afterRender: (itemListEl, pageItems) => {
      questionCache.clear();
      pageItems.forEach(q => questionCache.set(Number(q.id), q));
      enableImageLightbox(itemListEl);
      attachQuestionListEvents(itemListEl, questionCache, browser);
    },
  });

  /* ---- Toggle form Buat Soal Baru ---- */
  const newQForm = document.getElementById('new-question-form-wrap');
  document.getElementById('btn-show-new-question').addEventListener('click', () => {
    newQForm.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-new-question').addEventListener('click', () => {
    newQForm.classList.add('hidden');
  });

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
      const question = await api('/questions', {
        method: 'POST',
        body: {
          question_text: fd.get('question_text'),
          subject_id: Number(fd.get('subject_id')),
          difficulty: fd.get('difficulty'),
          score_weight: Number(fd.get('score_weight')),
          options,
        },
      });
      const imageFile = imgInput.files[0];
      if (imageFile && question?.id) {
        await apiUpload(`/questions/${question.id}/image`, 'image', imageFile);
      }
      toast('Soal ditambahkan ke Bank Soal.', 'success');
      renderPengelolaSoalDashboard();
    } catch (err) {
      toast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tambah Soal';
    }
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
      browser.refresh();
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ---- Aksi per-soal: dipasang ulang tiap kali daftar (per halaman) dirender oleh browser ---- */
  function attachQuestionListEvents(itemListEl, questionCache, browserInstance) {
    itemListEl.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-q]');
      if (editBtn) {
        const q = questionCache.get(Number(editBtn.dataset.editQ));
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
      const deleteBtn = e.target.closest('[data-delete-q]');
      if (deleteBtn) {
        const confirmed = confirm('Hapus soal ini secara PERMANEN dari Bank Soal? Soal akan hilang dari SEMUA ujian yang memakainya.');
        if (!confirmed) return;
        try {
          await api(`/questions/${deleteBtn.dataset.deleteQ}`, { method: 'DELETE' });
          toast('Soal dihapus dari Bank Soal.', 'success');
          browserInstance.refresh();
        } catch (err) { toast(err.message, 'error'); }
        return;
      }
      const delImg = e.target.closest('[data-delete-q-img]');
      if (delImg) {
        if (!confirm('Hapus gambar soal ini?')) return;
        try {
          await api(`/questions/${delImg.dataset.deleteQImg}/image`, { method: 'DELETE' });
          toast('Gambar dihapus.', 'success');
          browserInstance.refresh();
        } catch (err) { toast(err.message, 'error'); }
        return;
      }
    });

    itemListEl.addEventListener('change', async (e) => {
      const input = e.target.closest('[data-upload-q-img]');
      if (!input || !input.files[0]) return;
      const qId = input.dataset.uploadQImg;
      try {
        await apiUpload(`/questions/${qId}/image`, 'image', input.files[0]);
        toast('Gambar soal diunggah.', 'success');
        browserInstance.refresh();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
}

function renderQuestionCard(q, idx) {
  return `
    <div class="card p-4">
      <div class="flex justify-between items-start gap-3 mb-2">
        <p class="font-medium text-sm flex-1">
          ${idx + 1}. ${escapeHtml(q.question_text)}
          <span class="text-xs text-slate-400 font-normal ml-1">(bobot ${q.score_weight})</span>
        </p>
        <div class="flex items-center gap-1.5 shrink-0">
          <button class="btn btn-outline !py-1 !px-2.5 !text-xs" data-edit-q="${q.id}">Edit</button>
          <button class="btn btn-danger !py-1 !px-2.5 !text-xs" data-delete-q="${q.id}">Hapus</button>
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5 mb-3">
        ${q.subject_name ? `<span class="badge border-slate-200 text-slate-500">${escapeHtml(q.subject_name)}</span>` : ''}
        ${difficultyBadge(q.difficulty)}
        <span class="badge border-slate-200 text-slate-500">oleh ${escapeHtml(q.teacher_name || 'Guru terhapus')}</span>
      </div>

      ${q.image_url
        ? `<div class="mb-3">
            <img src="${q.image_url}" alt="Gambar soal" data-lightbox class="max-h-40 rounded-lg border border-slate-200 object-contain bg-slate-50">
            <div class="flex items-center gap-3 mt-1.5">
              <label class="text-xs text-slate-500 cursor-pointer hover:text-slate-800 underline">
                Ganti gambar
                <input type="file" accept="image/*" data-upload-q-img="${q.id}" class="sr-only">
              </label>
              <button class="text-xs text-red-500 hover:underline" data-delete-q-img="${q.id}">Hapus gambar</button>
            </div>
          </div>`
        : `<div class="mb-3">
            <label class="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer hover:text-slate-800 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 hover:border-slate-500 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Tambah gambar soal
              <input type="file" accept="image/*" data-upload-q-img="${q.id}" class="sr-only">
            </label>
          </div>`}

      <ul class="space-y-1">
        ${q.options.map((o, i) => `
          <li class="flex items-center gap-2 text-sm ${o.is_correct ? 'text-emerald-700 font-semibold' : 'text-slate-600'}">
            <span class="w-5 h-5 rounded border ${o.is_correct ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-slate-400'} inline-flex items-center justify-center text-[10px] font-bold shrink-0">${OPTION_LETTERS[i] || '?'}</span>
            ${escapeHtml(o.option_text)}
          </li>`).join('')}
      </ul>
    </div>`;
}