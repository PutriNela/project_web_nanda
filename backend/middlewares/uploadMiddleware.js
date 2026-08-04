/**
 * Upload Middleware
 * Konfigurasi multer untuk dua jenis upload:
 * - profileUpload : foto profil dosen (field: 'photo')
 * - questionUpload: gambar soal ujian (field: 'image')
 * Disimpan di backend/uploads/{profiles|questions}/
 * Di-serve Express sebagai static di /uploads/...
 */
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

function makeStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads', subfolder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  });
}

function imageFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  const err    = new Error('Hanya file gambar (JPEG, PNG, GIF, WebP) yang diizinkan.');
  err.statusCode = 400;
  cb(err);
}

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Wrap multer middleware agar error diteruskan dengan statusCode yang benar
function wrap(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        const e    = new Error('Ukuran file terlalu besar. Maksimal 5 MB.');
        e.statusCode = 400;
        return next(e);
      }
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    });
  };
}

const profileUpload  = wrap(multer({ storage: makeStorage('profiles'),  fileFilter: imageFilter, limits: { fileSize: MAX_SIZE } }).single('photo'));
const questionUpload = wrap(multer({ storage: makeStorage('questions'), fileFilter: imageFilter, limits: { fileSize: MAX_SIZE } }).single('image'));

module.exports = { profileUpload, questionUpload };
