const express = require('express');
const router = express.Router();

// Placeholder issue image routes
router.get('/:id', (req, res) => res.status(501).json({ success: false, message: 'Not implemented in this branch.' }));
module.exports = router;
