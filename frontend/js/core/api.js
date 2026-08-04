import { Store } from './store.js';

/**
 * api(path, options)
 * Wrapper fetch ke backend Express. Otomatis menyisipkan JWT (kecuali auth: false),
 * dan melempar Error berisi pesan dari backend jika respons gagal.
 */
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Store.token) headers['Authorization'] = `Bearer ${Store.token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { success: false, message: 'Respon server tidak valid.' };
  }

  if (!res.ok || !data.success) {
    if (res.status === 401) Store.clear();
    throw new Error(data.message || 'Terjadi kesalahan.');
  }
  return data.data;
}

/**
 * apiUpload(path, fieldName, file)
 * Upload satu file via multipart/form-data ke backend.
 * Dipakai untuk upload foto profil dan gambar soal.
 */
export async function apiUpload(path, fieldName, file) {
  const formData = new FormData();
  formData.append(fieldName, file);

  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Store.token}` },
    body: formData,
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { success: false, message: 'Respon server tidak valid.' };
  }

  if (!res.ok || !data.success) {
    if (res.status === 401) Store.clear();
    throw new Error(data.message || 'Upload gagal.');
  }
  return data.data;
}
