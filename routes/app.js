var express = require('express');
var path = require('path');
var router = express.Router();
var fs = require('fs');

var Job = require('../models/job');
var Component = require('../models/component');
var Phase = require('../models/phase');
var Building = require('../models/building');

var nameToModel = function(name) {
  var Model;
  switch(name) {
    case 'jobs':
    case 'job':
      Model = Job;
      break;
    case 'phases':
    case 'phase':
      Model = Phase;
      break;
    case 'buildings':
    case 'building':
      Model = Building;
      break;
    case 'components':
    case 'component':
      Model = Component;
      break;
    default:
      throw new Error('unknown name "'+name+'"');
  }
  return Model;
}

var getData = function() {
  return Promise.all(['jobs', 'phases', 'buildings', 'components'].map((name)=>{
    return nameToModel(name).find({}).then((docs) => {
      return [name, docs];
    });

  })).then(function(pairs) {
    var obj = {};
    pairs.forEach(function(pair) {
      obj[pair[0]] = pair[1];
    });
    return obj;
  });
};

const PAGES_PATH = 'views/pages';
const VALID_PAGES = fs.readdirSync(PAGES_PATH).filter((file) => {
  return fs.statSync(path.join(PAGES_PATH, file)).isDirectory();
});

const WORKER_FILENAME = 'sw.js';
router.get('/' + WORKER_FILENAME, function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public/javascripts/', WORKER_FILENAME));
});

router.get('/:pageName$', function(req, res, next) {
  if(VALID_PAGES.indexOf(req.params.pageName) === -1) return next();
  res.redirect(req.originalUrl + '/');
});

router.get('/', function(req, res, next) {
  res.redirect(req.originalUrl + 'build/'); //temporary
});

router.get('/:pageName?/*', function(req, res, next) {
  var pageName = req.params.pageName || 'index';
  if(VALID_PAGES.indexOf(pageName) === -1) return next();
  if(!req.accepts('html')) {
    return next();
  }

  getData().then(function(data) {
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
