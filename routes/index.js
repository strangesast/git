var express = require('express');
var router = express.Router();

router.get(['/', '/app$'], function(req, res, next) {
  res.redirect('/app/');
});

module.exports = router;
