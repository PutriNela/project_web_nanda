/**
 * Store
 * Menyimpan sesi login (JWT token + data user) di localStorage,
 * agar tetap login walau halaman di-refresh.
 */
export const Store = {
  get token() {
    return localStorage.getItem('token');
  },
  set token(v) {
    v ? localStorage.setItem('token', v) : localStorage.removeItem('token');
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      return null;
    }
  },
  set user(v) {
    v ? localStorage.setItem('user', JSON.stringify(v)) : localStorage.removeItem('user');
  },
  clear() {
    this.token = null;
    this.user = null;
  },
};
