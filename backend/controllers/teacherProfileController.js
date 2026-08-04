/**
 * Teacher Profile Controller
 * Controller Layer - endpoint profil guru dan permintaan pengisian profil.
 */
const teacherProfileService = require('../services/teacherProfileService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const teacherProfileController = {
  // GET /api/profile/me — guru ambil profilnya sendiri
  getMyProfile: asyncHandler(async (req, res) => {
    const profile = await teacherProfileService.getProfile(req.user.id);
    res.status(200).json({ success: true, data: profile });
  }),

  // POST /api/profile/me — guru isi/update profilnya sendiri
  saveMyProfile: asyncHandler(async (req, res) => {
    const { full_name, nomor_induk, address, phone, subject_ids } = req.body;
    const profile = await teacherProfileService.saveProfile(req.user.id, {
      full_name, nomor_induk, address, phone, subject_ids,
    });
    res.status(200).json({
      success: true,
      message: 'Profil berhasil disimpan.',
      data: profile,
    });
  }),

  // POST /api/profile/photo — multipart, field: photo
  uploadPhoto: asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError('File foto tidak ditemukan.', 400);
    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    const profile = await teacherProfileService.updatePhoto(req.user.id, photoUrl);
    res.status(200).json({
      success: true,
      message: 'Foto profil diperbarui.',
      data: { photo_url: photoUrl, profile },
    });
  }),

  // DELETE /api/profile/photo
  removePhoto: asyncHandler(async (req, res) => {
    await teacherProfileService.removePhoto(req.user.id);
    res.status(200).json({ success: true, message: 'Foto profil dihapus.' });
  }),

  // GET /api/profile/request/me — guru cek status request miliknya
  getMyRequest: asyncHandler(async (req, res) => {
    const request = await teacherProfileService.getMyRequest(req.user.id);
    res.status(200).json({ success: true, data: request });
  }),

  // POST /api/profile/request — guru minta admin yang isi
  submitRequest: asyncHandler(async (req, res) => {
    const request = await teacherProfileService.submitRequest(req.user.id, req.body.message);
    res.status(201).json({
      success: true,
      message: 'Permintaan berhasil dikirim. Mohon tunggu Admin mengisi profil Anda.',
      data: request,
    });
  }),

  // DELETE /api/profile/request — guru batalkan permintaan
  cancelRequest: asyncHandler(async (req, res) => {
    const request = await teacherProfileService.cancelRequest(req.user.id);
    res.status(200).json({ success: true, message: 'Permintaan dibatalkan.', data: request });
  }),

  // GET /api/profile/requests — admin lihat semua request pending
  getPendingRequests: asyncHandler(async (req, res) => {
    const requests = await teacherProfileService.getAllPendingRequests();
    res.status(200).json({ success: true, data: requests });
  }),

  // GET /api/profile/all — admin lihat semua profil guru
  getAllProfiles: asyncHandler(async (req, res) => {
    const profiles = await teacherProfileService.getAllProfiles();
    res.status(200).json({ success: true, data: profiles });
  }),

  // POST /api/profile/teacher/:userId — admin isi profil atas nama guru
  saveProfileByAdmin: asyncHandler(async (req, res) => {
    const { full_name, nomor_induk, address, phone, subject_ids } = req.body;
    const profile = await teacherProfileService.saveProfile(req.params.userId, {
      full_name, nomor_induk, address, phone, subject_ids,
    });
    res.status(200).json({
      success: true,
      message: 'Profil guru berhasil disimpan oleh Admin.',
      data: profile,
    });
  }),
};

module.exports = teacherProfileController;