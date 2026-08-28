const express = require('express');
const router = express.Router();
const asyncWrapper = require('../middleware/asyncWrapper');
const authController = require('../controllers/authController');

// Public auth routes
router.post('/signup', asyncWrapper(authController.signup));
router.post('/login', asyncWrapper(authController.login));
router.post('/logout', asyncWrapper(authController.logout));

module.exports = router;
