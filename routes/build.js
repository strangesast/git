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
  iface.Job.findById(req.params.id).populate('owner').then(function(doc) {
    if(doc == null) return next({error: new Error('not found'), status: 404});
    res.redirect(path.join(doc.owner.username, doc.shortname.split(' ').join('_')));

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

  iface.Account.findOne({username: username}).then(function(user) {
    if(user == null) return next({status: 404, error: new Error('not found')});
    return iface.Job.findOne({owner: user._id, shortname: shortname}).then(function(job) {
      if(job == null) return next({status: 404, error: new Error('not found')});


      var treePromise = iface.buildTree(job._id);
      var allPromise = Promise.all([Phase, Building, Component].map((m)=>m
        .find({job: job._id})
        .populate('parent', 'name')
        .populate('phase', 'name')
        .populate('building', 'name')
      )).then(function(arr) {
        return {phases: arr[0], buildings: arr[1], components: arr[2]};
      });

      Promise.all([allPromise, treePromise]).then(function(all) {
        var data = all[0];
        data.job = job;
        data.tree = all[1].tree;
        data.included = all[1].included;
        res.render('pages/build/job', data);
      });
    });
  }).catch(function(err) {
    return next(err);
  });
  /*
  iface.Account.findOne({username: username}).then(function(user) {
    if(user == null) return next({status: 404, error: new Error('not found')});

    return iface.Job.findOne({owner: user._id, shortname: shortname.split('_').join(' ')}).then(function(job) {
      if(job == null) return next({status: 404, error: new Error('not found')});

      var q = {job: job._id};
      var names = ['phases', 'buildings', 'components'];
      return Promise.all(names.map((n)=>iface.nameToModel(n)
            .find(q)
            .populate('parent', 'name')
            .populate('phase', 'name')
            .populate('building', 'name')
            )).then(function(arr) {
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
  */
});


module.exports = router;
