const express = require('express');
const router = express.Router();
const teacherProfileController = require('../controllers/teacherProfileController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { profileUpload } = require('../middlewares/uploadMiddleware');

router.use(authMiddleware);

// ---- Guru: profil sendiri ----
router.get('/profile/me',           roleMiddleware('Guru'), teacherProfileController.getMyProfile);
router.post('/profile/me',          roleMiddleware('Guru'), teacherProfileController.saveMyProfile);
router.post('/profile/photo',       roleMiddleware('Guru'), profileUpload, teacherProfileController.uploadPhoto);
router.delete('/profile/photo',     roleMiddleware('Guru'), teacherProfileController.removePhoto);
router.get('/profile/request/me',   roleMiddleware('Guru'), teacherProfileController.getMyRequest);
router.post('/profile/request',     roleMiddleware('Guru'), teacherProfileController.submitRequest);
router.delete('/profile/request',   roleMiddleware('Guru'), teacherProfileController.cancelRequest);

// ---- Admin: kelola profil & request ----
router.get('/profile/requests',           roleMiddleware('Admin'), teacherProfileController.getPendingRequests);
router.get('/profile/all',                roleMiddleware('Admin'), teacherProfileController.getAllProfiles);
router.post('/profile/teacher/:userId',   roleMiddleware('Admin'), teacherProfileController.saveProfileByAdmin);

module.exports = router;