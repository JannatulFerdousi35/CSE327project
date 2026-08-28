const express = require('express');
const router = express.Router();
const asyncWrapper = require('../middleware/asyncWrapper');

// Auth middleware may export the function directly or as a named export.
const auth = require('../middleware/auth');
const requireAuth = auth && (auth.requireAuth || auth) ;

const issuesController = require('../controllers/issuesController');
const { createIssue } = require('../controllers/issuesCreateController');

// Public
router.get('/issues', asyncWrapper(issuesController.listIssues));
router.get('/issues/:id', asyncWrapper(issuesController.getIssue));
router.get('/issues/stats', asyncWrapper(issuesController.stats));

// Authenticated
router.get('/issues/my-reports', requireAuth, asyncWrapper(issuesController.myReports));
router.post('/issues', requireAuth, asyncWrapper(createIssue));

module.exports = router;
