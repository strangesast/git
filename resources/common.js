var common = (function() {
  var ObjectId;
  if(typeof require !== 'undefined') {
    ObjectId = require('mongoose').Types.ObjectId;
  }
  var bool = function(element, values) {
    if(Array.isArray(values)) return (ObjectId != null && element instanceof ObjectId) ? values.some((v)=>element.equals(v)) : values.some((v)=>v==element);
    return (ObjectId != null && element instanceof ObjectId) ? element.equals(values) : element == values;
  }

  var getDescendants = function(arr) {
    return function func(ob) {
      children = arr.filter(function(el) {
        return (ObjectId != null && el['parent'] instanceof ObjectId) ? el['parent'].equals(ob['_id']) : el['parent'] == ob['_id'];
      });
      morechildren = children.map(func);
      if(morechildren.length) morechildren = morechildren.reduce((a, b)=>a.concat(b));
      return [ob].concat(children, morechildren);
    };
  }

  return {
    assembleTree: function(data) {
      // data = [phases, buildings, components]
      var getPhaseDescendants = getDescendants(data[0]);
      var getBuildingDescendants = getDescendants(data[1]);
      
      var components = data[2];

      return function func(currentRootPhase, currentRootBuilding, level, phaseEnabled, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants, emptyFolders) {
        var included = {phases: {}, buildings: {}, components: {}};
        var tree = [];

        // simplify stuff later
        var append = function(arr) {
          for(var i=0; i < arr.length; i++) {
            tree.push(arr[i]);
          }
        };
        var types = ['phases', 'buildings', 'components'];
        var extend = function(ob) {
          for(var i=0, type; type=types[i], i < types.length; i++) {
            for(var prop in ob[type]) {
              included[type][prop] = ob[type][prop];
            }
          }
        };

        if(!phaseEnabled) phaseDescendants = true;
        if(!buildingEnabled) buildingDescendants = true;
        // doesn't make sense when type is enabled
        //phaseDescendants = !phaseEnabled && phaseDescendants;
        //buildingDescendants = !buildingEnabled && buildingDescendants;

        // for determining descendants
        var phases, buildings;
        if(phaseEnabled) phases = data[0].filter((p) => bool(p.parent, currentRootPhase));
        if(buildingEnabled) buildings = data[1].filter((b) => bool(b.parent, currentRootBuilding));

        var phase, building, component;
        if(phaseEnabled) {
          for(var i=0; phase=phases[i], i < phases.length; i++) {
            tree.push({type: 'phase', _id: phase._id, level: level});
            if(!(phase._id in included.phases)) included.phases[phase._id] = phase;

            let both = func(phase._id, currentRootBuilding, level+1, phaseEnabled, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants, emptyFolders);
            extend(both.included);
            append(both.tree);
          }
        }
        //                     otherwise building is repeated after phase on first level
        if (buildingEnabled && (level != 0 || !phaseEnabled)) {
          phase = {'_id':currentRootPhase};
          for(var j=0; building=buildings[j], j < buildings.length; j++) {
            tree.push({type: 'building', _id: building._id, level: level});
            if(!(building._id in included.buildings)) included.buildings[building._id] = building;

            let both = func(currentRootPhase, building._id, level+1, false, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants, emptyFolders);
            extend(both.included);
            append(both.tree);
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
        if(!emptyFolders) { // hide empty folders
          var typeArr = tree.map((el)=>el.type);
          var i=0;

          while(i < tree.length) {
            var nextPhase = typeArr.indexOf('phase', i+1);
            var nextBuilding = typeArr.indexOf('building', i+1);
            var nextFolder = Math.min(nextPhase == -1 ? Infinity : nextPhase, nextBuilding == -1 ? Infinity : nextBuilding);
            var nextComp = typeArr.indexOf('component', i);
            if(typeArr[i] === 'component' || (nextComp != -1 && ( // is component or still components still available
                    (nextFolder == Infinity && tree[nextComp].level > tree[i].level) || // no more folders, next comp is lower
                    (nextComp < nextFolder && tree[nextComp].level > tree[i].level) || // comp up next, lower
                    (nextFolder != Infinity && tree[nextFolder].level > tree[i].level)) // folder up next, lower
                  )) {
              i++;
            } else {
              typeArr.splice(i, 1);
              tree.splice(i, 1);
            }
          }
        }
        return {
          tree: tree,
          included: included
        };
      };
    }
  };
})();

if(typeof exports !== 'undefined') {
  if(typeof module !== 'undefined' && module.exports) {
    exports = module.exports = common;
  } else {
    exports.common = common;
  }
} else {
  this['common'] = common;
}
