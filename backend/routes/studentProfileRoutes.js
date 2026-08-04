const express = require('express');
const router = express.Router();
const studentProfileController = require('../controllers/studentProfileController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/student/profile/me',  roleMiddleware('Siswa'), studentProfileController.getMyProfile);
router.post('/student/profile/me', roleMiddleware('Siswa'), studentProfileController.saveMyProfile);

module.exports = router;