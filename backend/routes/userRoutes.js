const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Semua route di bawah ini wajib login sebagai Admin
router.use(authMiddleware, roleMiddleware('Admin'));

router.get('/pending', userController.listPending);
router.get('/teachers', userController.listTeachers);
router.get('/students', userController.listStudents);
router.get('/', userController.listAll);
router.post('/', userController.create);
router.patch('/:id/approve', userController.approve);
router.patch('/:id/reject', userController.reject);
router.delete('/:id', userController.remove);

module.exports = router;
