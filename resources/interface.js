var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;

var Account = require('../models/account');
var Job = require('../models/job');
var Component = require('../models/component');
var Phase = require('../models/phase');
var Building = require('../models/building');

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
  buildTree: function(jobid, rootPhaseId, rootBuildingId) {
    rootPhaseId = rootPhaseId || null;
    rootBuildingId = rootBuildingId || null;
    return Job.findById(jobid).then(function(job) {
      if(job == null) throw new Error('job with that id ("'+jobid+'") does not exist');

      var q = {job: job._id};
      return Promise.all([Phase, Building, Component].map((m)=>m.find(q))).then(function(arr) {
        var included = {phases: {}, buildings: {}, components: {}};
        var tree = [];

        var bool = function(element, values) {
          if(Array.isArray(values)) return element instanceof ObjectId ? values.some((v)=>element.equals(v)) : values.some((v)=>v==element);
          return element instanceof ObjectId ? element.equals(values) : element == values;
        }

        var components = arr[2];
        var recurse = function(currentRootPhase, currentRootBuilding, level, phaseEnabled, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants) {
          //phaseDescendants = !phaseEnabled && phaseDescendants;
          //buildingDescendants = !buildingEnabled && buildingDescendants;
          if(phaseEnabled) {
            var phases = arr[0].filter(function(p) {
              return bool(p.parent, currentRootPhase);
            });
          }
          if(buildingEnabled) {
            var buildings = arr[1].filter(function(b) {
              return bool(b.parent, currentRootBuilding);
            });
          }

          var phase, building, component;
          if(phaseEnabled) {
            for(var i=0; phase=phases[i], i < phases.length; i++) {
              tree.push({type: 'phase', _id: phase._id, level: level});
              if(!(phase._id in included.phases)) included.phases[phase._id] = phase;

              if(buildingEnabled) {
                for(var j=0; building=buildings[j], j < buildings.length; j++) {
                  tree.push({type: 'building', _id: building._id, level: level+1});
                  if(!(building._id in included.buildings)) included.buildings[building._id] = building;

                  if(componentEnabled) {
                    // phase, building, and component enabled
                    for(var k=0; component=components[k], k < components.length; k++) {
                      if(bool(component.phase, phase._id) && bool(component.building, building._id)) {
                        tree.push({type: 'component', _id: component._id, level: level+2});
                        if(!(component._id in included.components)) included.components[component._id] = component;
                      }
                    }
                  }
                  recurse(phase._id, building._id, level+1, false, buildingEnabled, componentEnabled);
                }
              } else if (componentEnabled) {
                building = {'_id':currentRootBuilding};
                // phase and component enabled
                for(var k=0; component=components[k], k < components.length; k++) {
                  if(bool(component.phase, phase._id) && bool(component.building, building._id)) {
                    tree.push({type: 'component', _id: component._id, level: level+2});
                    if(!(component._id in included.components)) included.components[component._id] = component;
                  }
                }
              }
              recurse(phase._id, currentRootBuilding, level+1, phaseEnabled, buildingEnabled, componentEnabled);
            }
          } else if (buildingEnabled) {
            phase = {'_id':currentRootPhase};
            for(var j=0; building=buildings[j], j < buildings.length; j++) {
              tree.push({type: 'building', _id: building._id, level: level+1});
              if(!(building._id in included.buildings)) included.buildings[building._id] = building;

              if(componentEnabled) {
                for(var k=0; component=components[k], k < components.length; k++) {
                  if(bool(component.phase, phase._id) && bool(component.building, building._id)) {
                    tree.push({type: 'component', _id: component._id, level: level});
                    if(!(component._id in included.components)) included.components[component._id] = component;
                  }
                }
              }
              recurse(currentRootPhase, building._id, 1, phaseEnabled, buildingEnabled, componentEnabled);
            }
          } else if (componentEnabled) {
            phase = {'_id':currentRootPhase};
            building = {'_id':currentRootBuilding};
            for(var k=0; component=components[k], k < components.length; k++) {
              if(bool(component.phase, phase._id) && bool(component.building, building._id)) {
                tree.push({type: 'component', _id: component._id, level: level});
                if(!(component._id in included.components)) included.components[component._id] = component;
              }
            }
          }
        }
        recurse(rootPhaseId, rootBuildingId, 0, true, true, true);

        return {tree: tree, included: included};
      });
    });
  }
};

module.exports = iface;
