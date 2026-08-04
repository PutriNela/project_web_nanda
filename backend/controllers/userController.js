/**
 * User Controller
 * Controller Layer - manajemen user oleh Admin (approval, list, create, delete).
 */
const userService = require('../services/userService');
const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

const userController = {
  // GET /api/users/pending
  listPending: asyncHandler(async (req, res) => {
    const users = await userService.listPendingUsers();
    res.status(200).json({ success: true, data: users });
  }),

  // GET /api/users
  listAll: asyncHandler(async (req, res) => {
    const users = await userService.listAllUsers();
    res.status(200).json({ success: true, data: users });
  }),

  // GET /api/users/teachers
  listTeachers: asyncHandler(async (req, res) => {
    const teachers = await userService.getTeachers();
    res.status(200).json({ success: true, data: teachers });
  }),

  // GET /api/users/students
  listStudents: asyncHandler(async (req, res) => {
    const students = await userService.getStudents();
    res.status(200).json({ success: true, data: students });
  }),

  // PATCH /api/users/:id/approve
  approve: asyncHandler(async (req, res) => {
    const user = await userService.approveUser(req.params.id);
    res.status(200).json({ success: true, message: 'User disetujui.', data: user });
  }),

  // PATCH /api/users/:id/reject
  reject: asyncHandler(async (req, res) => {
    const user = await userService.rejectUser(req.params.id);
    res.status(200).json({ success: true, message: 'User ditolak.', data: user });
  }),

  // POST /api/users - Admin membuat akun langsung (termasuk Admin baru)
  create: asyncHandler(async (req, res) => {
    const { username, password, name, roleName } = req.body;
    const user = await authService.createUserByAdmin({ username, password, name, roleName });
    res.status(201).json({ success: true, message: 'Akun berhasil dibuat.', data: user });
  }),

  // DELETE /api/users/:id
  remove: asyncHandler(async (req, res) => {
    const result = await userService.deleteUser(req.params.id, req.user.id);
    res.status(200).json({ success: true, ...result });
  }),
};

module.exports = userController;
