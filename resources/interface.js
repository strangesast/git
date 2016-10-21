var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var mysql = require('mysql');

var Account = require('../models/account');
var Job = require('../models/job');
var Phase = require('../models/phase');
var Building = require('../models/building');
var Component = require('../models/component');

var common = require('./common')

var iface = {
  nameToModel: function(name) {
    var Model;
    switch(name) {
      case 'jobs':
      case 'job':
        return Job;
      case 'phases':
      case 'phase':
        return Phase;
      case 'buildings':
      case 'building':
        return Building;
      case 'components':
      case 'component':
        return Component;
      default:
        throw new Error('unknown name "'+name+'"');
    }
  },
  Job: Job,
  Phase: Phase,
  Account: Account,
  Building: Building,
  Component: Component,
  getData: function() { // temporary
    return Promise.all([
      'jobs',
      'phases',
      'buildings',
      'components'
    ].map((name)=>{
      return iface.nameToModel(name).find({}).then((docs) => {
        return [name, docs];
      });

    })).then(function(pairs) {
      var obj = {};
      pairs.forEach(function(pair) {
        obj[pair[0]] = pair[1];
      });
      return obj;
    });
  },
  verify: function(Model, id) {
    // if null, return null.  throw error if id invalid / doesn't exist
    if(id==null) return Promise.resolve(id);
    if(Model==null) return new Error('model required');
    if(!ObjectId.isValid(id)) return Promise.reject(new Error('invalid id format'));
    return Model.findById(id);
  },
  tin: function(ob) {
    // true if null
    return ob == null ? true : !!ob;
  },
  buildTree: function(jobid, rootPhaseId, rootBuildingId, options) {
    rootPhaseId = rootPhaseId || null;
    rootBuildingId = rootBuildingId || null;
    options = options || {};
    var rootPhaseDoc, rootBuildingDoc, q;
    return Job.findById(jobid).then(function(job) {
      if(job == null) throw new Error('job with that id ("'+jobid+'") does not exist');
      q = {job: job._id};

      // check that root phase/building do exist (or are null)
      // check that rootPhases specified are null or valid
      return Promise.all([
        iface.verify(Phase, rootPhaseId).then((doc) => rootPhaseDoc = doc),
        iface.verify(Building, rootBuildingId).then((doc) => rootBuildingDoc = doc)
      ]);
    }).then(function() {
        // get phases etc belonging to job
        return Promise.all([Phase, Building, Component].map((m)=>m.find(q)));

    }).then(function(arr) {
      var phases = arr[0], buildings = arr[1], components = arr[2];
      var tree = common.betterTree(
          {enabled: options.phaseEnabled, root: rootPhaseId, objects: phases},
          {enabled: options.buildingEnabled, root: rootBuildingId, objects: buildings},
          {enabled: options.componentEnabled, root: null, objects: components},
          0,
          {included: true});
      return tree;
    });
  },
  sqlQuery: function(query, arr) {
    return new Promise(function(resolve, reject) {
      var connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'russell',
        database: 'core_development'
      });
      
      connection.connect(function(err) {
        if(err) throw err;
        connection.query(query, arr, function(err, rows, fields) {
          if(err) reject(err);
          resolve(rows);
        });
      });
    }).catch(function(err) {
      console.log(err);
      return [];
    });
  }
};

module.exports = iface;
