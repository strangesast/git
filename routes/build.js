var express = require('express');
var path = require('path');
var router = express.Router();
var fs = require('fs');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;

var iface = require('../resources/interface');

router.get('/', function(req, res, next) {
  iface.Job.find({}).then(function(docs) {
    res.render('pages/build/index', {jobs: docs});
    
  }).catch(function(err) {
    next(err);
  });
});

router.get('/:id', function(req, res, next) {
  if(!ObjectId.isValid(req.params.id)) return next();
  console.log(req.params.id);
  iface.Job.findById(req.params.id).populate('owner').then(function(doc) {
    if(doc == null) return next({error: new Error('not found'), status: 404});
    res.redirect(path.join('/app/build/', doc.owner.username, doc.shortname.split(' ').join('_')));

  }).catch(function(err) {
    next(err);
  });
});

router.get('/:username', function(req, res, next) {
  res.redirect(path.join('/app/user/', req.params.username, '/jobs'));
});

router.get('/:username/:id', function(req, res, next) {
  var id = req.params.id;
  var username = req.params.username;
  if(!ObjectId.isValid(id)) return next();
  iface.Account.findOne({username: username}).then(function(user) {
    if(user == null) return next({status: 404, error: new Error('not found')});
    iface.Job.findById(id).then(function(doc) {
      if(doc == null) return next({status: 404, error: new Error('not found')});
      res.redirect(path.join('/app/build/', username, doc.shortname.split(' ').join('_')));
    });
  });
});

router.get('/:username/:shortname', function(req, res, next) {
  var shortname = req.params.shortname.split('_').join(' ');;
  var username = req.params.username;
  var rootPhase = req.query.rootPhase;
  var rootBuilding = req.query.rootBuilding;

  iface.Account.findOne({username: username}).then(function(user) {
    if(user == null) return next({status: 404, error: new Error('not found')});
    return iface.Job.findOne({owner: user._id, shortname: shortname}).populate('owner').then(function(job) {
      if(job == null) return next({status: 404, error: new Error('not found')});


      var options = {};
      for(var prop in req.query) {
        if(!isNaN(req.query[prop])) {
          options[prop] = Number(req.query[prop]);
        } else {
          options[prop] = req.query[prop];
        }
      }
      var queryPromise = req.query.query ? iface.sqlQuery('SELECT * FROM core_development.part_catalogs where purchaseable=1 && active=1 && description like ? limit 10', [req.query.query + '%']) : Promise.resolve([]);
      var treePromise = iface.buildTree(job._id, rootPhase || null, rootBuilding || null, options);
      var partPromise = iface.sqlQuery('SELECT * FROM core_development.part_catalogs where purchaseable=1 && active=1 limit 100').then(function(arr) {
        var obj = {};
        var subobj;
        for(var i=0; i < arr.length; i++) {
          subobj = {};
          for(var prop in arr[i]) {
            subobj[prop] = arr[i][prop];
          }
          obj[subobj.version_id] = subobj;
        }
        return obj;
      });
      var allPromise = Promise.all([Phase, Building, Component].map((m)=>m
        .find({job: job._id})
        .populate('parent', 'name')
        .populate('phase', 'name')
        .populate('building', 'name')
        .populate('parts')
      )).then(function(arr) {
        return {phases: arr[0], buildings: arr[1], components: arr[2]};
      });

      return Promise.all([allPromise, treePromise, partPromise, queryPromise]).then(function(all) {
        var data = all[0];
        console.log(JSON.stringify(job));
        data.job = job;
        data.tree = all[1].tree;
        data.included = all[1].included;
        data.parts = all[2];
        data.user = req.user;
        data.queryResult = all[3];
        data.options = options;
        res.render('pages/build/job', data);
      });
    });
  }).catch(function(err) {
    return next(err);
  });
});


module.exports = router;
