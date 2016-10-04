var express = require('express');
var path = require('path');
var router = express.Router();
var fs = require('fs');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;


var users = require('./users');

var Account = require('../models/account');
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

// temporary
router.get('/', function(req, res, next) {
  //res.redirect(req.originalUrl + 'build/jobs');
  Job.find({}).populate('owner').then(function(jobs) {
    res.render('pages/index/index', {jobs: jobs});
  });
});

router.use('/user', users); // offload login stuff

router.get('/user/:id/jobs', function(req, res, next) {
  if(!ObjectId.isValid(req.params.id)) return next();
  Account.findById(req.params.id).then(function(doc) {
    if(doc == null) return next({status: 404, error: new Error('not found')});
    res.redirect(path.join('/app/user/', doc.username, '/jobs'));
  }).catch(function(err) {
    next(err);
  });
});

router.get('/user/:username/jobs', function(req, res, next) {
  Account.findOne({username: req.params.username}).then(function(user) {
    if(user == null) return next({status: 404, error: new Error('not found')});
    Job.find({owner: user._id}).then(function(docs) {
      res.render('pages/user/jobs', {jobs: docs, user: user});
    });
  });
});

router.get('/build', function(req, res, next) {
  Job.find({}).then(function(docs) {
    res.render('pages/build/index', {jobs: docs});
    
  }).catch(function(err) {
    next(err);
  });
});

router.get('/build/:id', function(req, res, next) {
  if(!ObjectId.isValid(req.params.id)) return next();
  Job.findById(req.params.id).populate('owner').then(function(doc) {
    if(doc == null) return next({error: new Error('not found'), status: 404});
    res.redirect(path.join(doc.owner.username, doc.shortname.split(' ').join('_')));

  }).catch(function(err) {
    next(err);
  });
});

router.get('/build/:user', function(req, res, next) {
  res.redirect(path.join('/app/user/', req.params.user, '/jobs'));
});

router.get('/build/:username/:shortname', function(req, res, next) {
  var shortname = req.params.shortname;
  var username = req.params.username;
  Account.findOne({username: username}).then(function(user) {
    if(user == null) return next({status: 404, error: new Error('not found')});

    return Job.findOne({owner: user._id, shortname: shortname.split('_').join(' ')}).then(function(job) {
      if(job == null) return next({status: 404, error: new Error('not found')});

      var q = {job: job._id};
      var names = ['phases', 'buildings', 'components'];
      return Promise.all(names.map((n)=>nameToModel(n).find(q).populate('parent'))).then(function(arr) {
        var result = {};
        names.forEach((n, i)=>{
          result[n] = arr[i];
        });
        result.job = job;
        res.render('pages/build/job', result);
      });
    });
  }).catch(function(err) {
    return next(err);
  });
});

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
