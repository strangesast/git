const SPACE_KEY = 32;
const DOWNARROW_KEY = 40;
const UPARROW_KEY = 38;
const ENTER_KEY = 13;
const ESC_KEY = 27;
const BACKSPACE_KEY = 8;


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

  var common = {
    hasAncestor: function(obj, prop, root) {
      if(prop == root) return true;
      if(typeof obj == 'undefined' || obj ==  null || obj[prop] == null) return false;
      return obj[prop].indexOf(root) != -1 ? true : false;
    },
    getDescendants: function(arr) {
      var descendants = {};
      for(var i=0; i < arr.length; i++) {
        descendants[arr[i]['_id']] = [arr[i]['parent']];
      }
      for(var id in descendants) {
        let par;
        do {
          par = descendants[id].slice(-1)[0];
          if(par == null) break;
          if(descendants[par].indexOf(id) != -1) break; // should prob throw error
          descendants[id] = descendants[id].concat(descendants[par]);
        } while (par != null);
      }
      return descendants;
    },
    betterTree: function(phase, building, component, level, options) {
      level = level || 0;
      options = options || {};
      phase = {enabled: phase && phase.enabled, root: (phase && phase.root) ? phase.root : null, objects: phase.objects, descendants: phase.descendants};
      building = {enabled: building && building.enabled, root: (building && building.root) ? building.root : null, objects: building.objects, descendants: building.descendants};
      component = {enabled: component && component.enabled, root: (component && component.root) ? component.root : null, objects: component.objects, descendants: component.descendants};

      var all = [];
      var included = {};

      var types = {phase: phase, building: building, component: component};
      var ordered = ['component', 'building', 'phase'];

      for(var i=0, prop; prop = ordered[i], i < ordered.length; i++) {
        let type = types[prop];
        if(type.enabled) {
          let f = (ob) => ob['parent'] == type.root && (type != component || (common.hasAncestor(phase.descendants, ob['phase'], phase.root) && common.hasAncestor(building.descendants, ob['building'], building.root)));
          let parents = type.objects.filter(f);
          for(let j=0,_parent; _parent=parents[j], j < parents.length; j++) {
            let both = common.betterTree(
                {enabled: type == phase ? phase.enabled : false,        root: type == phase ? _parent['_id'] : phase.root, objects: phase.objects, descendants: phase.descendants},
                {enabled: type != component ? building.enabled : false, root: type == building ? _parent['_id'] : building.root, objects: building.objects, descendants: building.descendants},
                {enabled: component.enabled,                            root: type == component ? _parent['_id'] : component.root, objects: component.objects},
                level+1,
                options);
            let children = both.tree;
            all.push({
              '_id': _parent['_id'],
              type: prop,
              level: level,
              phase: phase.root,
              building: building.root,
              component: component.root
            });
            if(options.included) {
              included[_parent['_id']] = _parent;
              Object.assign(included, both.included);
            }
            for(var k=0; k < children.length; k++) {
              all.push(children[k]);
            }
          }
        }
      }
      
      return {tree: all, included: included};
    },
    treeChildren: function (phase, building, component, level, options) {
      level = level || 0;
      options = options || {};
      phase = {enabled: phase && phase.enabled, root: (phase && phase.root) ? phase.root : null, objects: phase.objects, descendants: phase.descendants};
      building = {enabled: building && building.enabled, root: (building && building.root) ? building.root : null, objects: building.objects, descendants: building.descendants};
      component = {enabled: component && component.enabled, root: (component && component.root) ? component.root : null, objects: component.objects, descendants: component.descendants};

      var all = [];
      var included = {};

      var types = {phase: phase, building: building, component: component};
      var ordered = ['component', 'building', 'phase'];

      for(var i=0, prop; prop = ordered[i], i < ordered.length; i++) {
        let type = types[prop];
        if(type.enabled) {
          let f;
          let isCollection = (typeof Collection != 'undefined' && type.objects instanceof Collection);
          if(isCollection) {
            f = (ob) => ob.get('parent') == type.root && (type != component || (common.hasAncestor(phase.descendants, ob.get('phase'), phase.root) && common.hasAncestor(building.descendants, ob.get('building'), building.root)));
          } else {
            f = (ob) => ob['parent'] == type.root && (type != component || (common.hasAncestor(phase.descendants, ob['phase'], phase.root) && common.hasAncestor(building.descendants, ob['building'], building.root)));

          }
          let parents = type.objects.filter(f);
          for(let j=0,_parent; _parent=parents[j], j < parents.length; j++) {
            all.push({
              '_id': isCollection ? _parent.get('_id') : _parent['_id'],
              type: prop,
              level: level,
              open: false,
              visible: true
            });
            if(options.included) {
              included[isCollection ? _parent.get('_id') : _parent['_id']] = _parent;
              Object.assign(included, both.included);
            }
          }
        }
      }
      
      return {tree: all, included: included};
    },
    buildTree: function(phase, building, component, level, options, maxlevel) {
      maxlevel = maxlevel || 1;
      var all = common.treeChildren(phase, building, component, level, options).tree;
      do {
        console.log(level, maxlevel);
        let done = true;
        for(var i=0; i < all.length; i++) {
          var _parent = all[i];
          if(_parent.level == level) {
            let id = _parent['_id'];
            let tree = common.treeChildren(
                {enabled: _parent.type == 'phase' ? phase.enabled : false,        root: _parent.type == 'phase' ? id : phase.root,         objects: phase.objects,    descendants: phase.descendants},
                {enabled: _parent.type != 'component' ? building.enabled : false, root: _parent.type == 'building' ? id : building.root,   objects: building.objects, descendants: building.descendants},
                {enabled: component.enabled,                                      root: _parent.type == 'component' ? id : component.root, objects: component.objects},
                level+1,
                options).tree;
            let args = [i+1, 0].concat(tree);
            Array.prototype.splice.apply(all, args);
            i+=tree.length;
            done = false;
          }
        }
        level++;
        if(done) {
          console.log('done')
          break;
        }
      } while (level < maxlevel);
      return all;
    }
  };
  return common;
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
