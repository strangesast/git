var express = require('express');
var path = require('path');
var router = express.Router();
var fs = require('fs');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;


var users = require('./users');
var build = require('./build');

var iface = require('../resources/interface');

const PAGES_PATH = 'views/pages';
const VALID_PAGES = fs.readdirSync(PAGES_PATH).filter((file) => {
  return fs.statSync(path.join(PAGES_PATH, file)).isDirectory();
});

// for worker /app/ scope
const WORKER_FILENAME = 'sw.js';
router.get('/' + WORKER_FILENAME, function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public/javascripts/', WORKER_FILENAME));
});

// temporary
router.get('/', function(req, res, next) {
  //res.redirect(req.originalUrl + 'build/jobs');
  iface.Job.find({}).populate('owner').then(function(jobs) {
    res.render('pages/index/index', {jobs: jobs});
  });
});

router.use('/user', users); // offload login stuff

router.use('/build', build); // offload build stuff

router.get('/:pageName$', function(req, res, next) {
  if(VALID_PAGES.indexOf(req.params.pageName) === -1) return next();
  res.redirect(req.originalUrl + '/');
});

router.get('/:pageName/*', function(req, res, next) {
  console.log(req.param.pageName);
  var pageName = req.params.pageName || 'index';
  console.log(pageName);
  if(VALID_PAGES.indexOf(pageName) === -1) return next();
  if(!req.accepts('html')) {
    return next();
  }

  iface.getData().then(function(data) {
    return res.render('pages/'+pageName+'/page', {data : data});
  });
});

router.get('/:pageName?/', function(req, res, next) {
  var pageName = req.params.pageName || 'index';
  if(VALID_PAGES.indexOf(pageName) === -1) return next();
  if(!req.accepts('json')) {
    return next();
  }
  res.setHeader('Content-Type', 'application/json');
  return res.render('pages/'+pageName+'/template', function(err, html) {
    if(err) return next(err);
    return res.json({template: html});
  });
});

module.exports = router;
