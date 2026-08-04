const express        = require('express');
const router         = express.Router();
const attemptController = require('../controllers/attemptController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware);

router.get('/student/exams',    roleMiddleware('Siswa'), attemptController.listStudentExams);
router.get('/student/teachers', roleMiddleware('Siswa'), attemptController.listStudentTeachers);

router.post('/exams/:id/start',  roleMiddleware('Siswa'), attemptController.start);
router.get('/exams/:id/scores',  roleMiddleware('Guru'),  attemptController.getScoreSummary);

router.get('/attempts/:attemptId/questions', roleMiddleware('Siswa'), attemptController.getQuestions);
router.post('/attempts/:attemptId/answer',   roleMiddleware('Siswa'), attemptController.saveAnswer);
router.post('/attempts/:attemptId/submit',   roleMiddleware('Siswa'), attemptController.submit);

module.exports = router;