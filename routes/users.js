const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/users - Lista de usuarios (email + role) para selects de responsables
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, 'email role').sort({ role: 1, email: 1 });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
