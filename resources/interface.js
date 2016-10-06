var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var mysql = require('mysql');

var Account = require('../models/account');
var Job = require('../models/job');
var Phase = require('../models/phase');
var Building = require('../models/building');
var Component = require('../models/component');
var PartRef = require('../models/partref');

var bool = function(element, values) {
  if(Array.isArray(values)) return element instanceof ObjectId ? values.some((v)=>element.equals(v)) : values.some((v)=>v==element);
  return element instanceof ObjectId ? element.equals(values) : element == values;
}

var getDescendants = function(arr) {
  return function func(ob) {
    children = arr.filter(function(el) {
      return el['parent'] instanceof ObjectId ? el['parent'].equals(ob['_id']) : el['parent'] == ob['_id'];
    });
    morechildren = children.map(func);
    if(morechildren.length) morechildren = morechildren.reduce((a, b)=>a.concat(b));
    return [ob].concat(children, morechildren);
  };
}

var recurse = function(data) {
  
  var getPhaseDescendants = getDescendants(data[0]);
  var getBuildingDescendants = getDescendants(data[1]);
  
  var components = data[2];

  return function func(currentRootPhase, currentRootBuilding, level, phaseEnabled, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants) {
    var included = {phases: {}, buildings: {}, components: {}};
    var tree = [];

    if(phaseDescendants == null) phaseDescendants = true;
    if(buildingDescendants == null) buildingDescendants = true;
    // doesn't make sense when type is enabled
    phaseDescendants = !phaseEnabled && phaseDescendants;
    buildingDescendants = !buildingEnabled && buildingDescendants;

    if(phaseEnabled) {
      var phases = data[0].filter(function(p) {
        return bool(p.parent, currentRootPhase);
      });
    }
    if(buildingEnabled) {
      var buildings = data[1].filter(function(b) {
        return bool(b.parent, currentRootBuilding);
      });
    }


    var phase, building, component;
    if(phaseEnabled) {
      for(var i=0; phase=phases[i], i < phases.length; i++) {
        tree.push({type: 'phase', _id: phase._id, level: level});
        if(!(phase._id in included.phases)) included.phases[phase._id] = phase;

        let both = func(phase._id, currentRootBuilding, level+1, phaseEnabled, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants);
        ['phases', 'buildings', 'components'].forEach(function(type) {
          for(var prop in both.included[type]) {
            included[type][prop] = both.included[type][prop];
          }
        });
        both.tree.forEach(function(child) {
          tree.push(child);
        });
      }
    }
    if (buildingEnabled) {
      phase = {'_id':currentRootPhase};
      for(var j=0; building=buildings[j], j < buildings.length; j++) {
        tree.push({type: 'building', _id: building._id, level: level});
        if(!(building._id in included.buildings)) included.buildings[building._id] = building;

        let both = func(currentRootPhase, building._id, level+1, false, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants);
        ['phases', 'buildings', 'components'].forEach(function(type) {
          for(var prop in both.included[type]) {
            included[type][prop] = both.included[type][prop];
          }
        });
        both.tree.forEach(function(child) {
          tree.push(child);
        });
      }
    }
    if (componentEnabled) {
      phase = {'_id':currentRootPhase};
      building = {'_id':currentRootBuilding};
      var pdescendants;
      var bdescendants;
      if(phaseDescendants) pdescendants = getPhaseDescendants(phase).map((el)=>el._id);
      if(buildingDescendants) bdescendants = getBuildingDescendants(building).map((el)=>el._id);

      for(var k=0; component=components[k], k < components.length; k++) {
        if(bool(component.phase, pdescendants || phase._id) && bool(component.building, bdescendants || building._id)) {
          tree.push({type: 'component', _id: component._id, level: level});
          if(!(component._id in included.components)) included.components[component._id] = component;
        }
      }
    }
    return {tree: tree, included: included};
  }
}

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
      case 'partrefs':
      case 'partref':
        return PartRef;
      default:
        throw new Error('unknown name "'+name+'"');
    }
  },
  Job: Job,
  Phase: Phase,
  Account: Account,
  Building: Building,
  Component: Component,
  PartRef: PartRef,
  getData: function() { // temporary
    return Promise.all([
      'jobs',
      'phases',
      'buildings',
      'components',
      'partrefs'
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
  buildTree: function(jobid, rootPhaseId, rootBuildingId, options) {
    rootPhaseId = rootPhaseId || null;
    rootBuildingId = rootBuildingId || null;
    options = options || {};
    return Job.findById(jobid).then(function(job) {
      if(job == null) throw new Error('job with that id ("'+jobid+'") does not exist');

      var q = {job: job._id};
      return Promise.all([Phase, Building, Component].map((m)=>m.find(q))).then(function(arr) {
        return recurse(arr)(
          rootPhaseId, // root phase (filter, default null)
          rootBuildingId, // root building (filter, default null)
          0, // starting level
          options.phaseEnabled == null ? true : !!options.phaseEnabled,
          options.buildingEnabled == null ? true : !!options.buildingEnabled,
          options.componentEnabled == null ? true : !!options.componentEnabled,
          options.phaseDescendants == null ? false : !!options.phaseDescendants,
          options.buildingDescendants == null ? false : !!options.buildingDescendants
        );
      });
    });
  },
  sqlQuery: function(query) {
    return new Promise(function(resolve, reject) {
      var connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'russell',
        database: 'core_development'
      });
      
      connection.connect(function(err) {
        if(err) throw err;
        connection.query(query, function(err, rows, fields) {
          if(err) reject(err);
          resolve(rows);
        });
      });
    });
  }
};

module.exports = iface;
