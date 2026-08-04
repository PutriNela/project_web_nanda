/**
 * Student Profile Controller
 */
const studentProfileService = require('../services/studentProfileService');
const asyncHandler = require('../utils/asyncHandler');

const studentProfileController = {
  // GET /api/student/profile/me
  getMyProfile: asyncHandler(async (req, res) => {
    const profile = await studentProfileService.getProfile(req.user.id);
    res.status(200).json({ success: true, data: profile });
  }),

  // POST /api/student/profile/me
  saveMyProfile: asyncHandler(async (req, res) => {
    const { full_name, nim, address, phone } = req.body;
    const profile = await studentProfileService.saveProfile(req.user.id, {
      full_name, nim, address, phone,
    });
    res.status(200).json({ success: true, message: 'Profil berhasil disimpan.', data: profile });
  }),
};

module.exports = studentProfileController;