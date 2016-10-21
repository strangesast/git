var Tree = Backbone.Model.extend({
  initialize: function(params, options) {
    this.job = options.job;
    var str = ['rootPhase', 'rootBuilding', 'phaseEnabled', 'buildingEnabled', 'componentEnabled', 'buildingDescendants', 'phaseDescendants', 'emptyFolders'].map((e)=>'change:' + e).join(' ');
    this.on(str, this.build);

    this.listenTo(this.job.collections.phases, 'reset', this.recalculate);
    this.listenTo(this.job.collections.buildings, 'reset', this.recalculate);
    this.listenTo(this.job.collections.components, 'reset', this.recalculate);

    this.listenTo(this.job.collections.phases, 'change', this.recalculate);
    this.listenTo(this.job.collections.buildings, 'change', this.recalculate);
    this.listenTo(this.job.collections.components, 'change', this.recalculate);


    this.dragged = null;
  },
  recalculate: function() {
    var job = this.job;
    var data = ['phases', 'buildings', 'components'].map((m)=>job.collections[m].toJSON());
    this.build();
  },
  defaults: {
    rootPhase: null,
    rootBuilding: null,
    phaseEnabled: true,
    buildingEnabled: true,
    componentEnabled: true,
    buildingDescendants: false,
    phaseDescendants: false,
    emptyFolders: true
  },
  rootPhase: function() {
    return this.get('rootPhase') ? this.job.collections.phases.get(this.get('rootPhase')).get('name') : null;
  },
  rootBuilding: function() {
    return this.get('rootBuilding') ? this.job.collections.buildings.get(this.get('rootBuilding')).get('name') : null;
  },
  build: function() {
    var phases = this.job.collections.phases.toJSON();
    var buildings = this.job.collections.buildings.toJSON();
    var components = this.job.collections.components.toJSON();

    var phaseEnabled = this.get('phaseEnabled');
    var buildingEnabled = this.get('buildingEnabled');
    var componentEnabled = this.get('componentEnabled');

    var rootPhase = this.get('rootPhase');
    var rootBuilding = this.get('rootBuilding');
    var phaseDescendants = this.get('phaseDescendants');
    var buildingDescendants = this.get('buildingDescendants');

    var result = common.betterTree(
        {enabled: phaseEnabled,     root: rootPhase,    objects: phases,     descendants: !phaseEnabled || phaseDescendants ? common.getDescendants(phases) : false},
        {enabled: buildingEnabled,  root: rootBuilding, objects: buildings,  descendants: !buildingEnabled || buildingDescendants ? common.getDescendants(buildings) : false},
        {enabled: componentEnabled, root: null,         objects: components, descendants: false },
        0);
    this.tree = result.tree;
    this.included = result.included;
    this.trigger('build');
  }
});

var BaseView = Backbone.View.extend({
  render: function() {
    if(this.binding == null) {
      var templateEl = this.el.querySelector('template');
      var template = document.importNode(templateEl.content, true).firstChild;
      this.binding = rivets.bind(template, this.bindTo || {});
      var old = this.el;
      old.parentElement.replaceChild(template, old);
      this.setElement(template);
    }
    return this;
  }
});

var Navbar = BaseView.extend({
  el: '#navigation-bar',
  events: {
    'click .toggle.type':'toggled',
    'input .search input' : 'input',
    'keydown .search input' : 'keydown',
    'blur .search input' : 'blur',
    'click .remove': 'removeFilter'
  },
  keydown: function(e) {
    if(e.which == ESC_KEY) {
      this.blur();
    } else if (e.which == BACKSPACE_KEY) {
      if(this.search.get('query') == '' && this.search.get('filters').length) {
        this.search.set('filters', this.search.get('filters').slice(0, -1));
        this.search.trigger('change:filters', this.search);
      }
    }
  },
  input: function(e) {
    if(this.search.get('query')) {
      this.search.set('active', true);
    } else {
      this.search.set('active', false);
    }
  },
  blur: function(e) {
    this.search.set('active', false);
  },
  toggled: function(e) {
    if(!e.currentTarget.checked && ['phase', 'building', 'component'].map((str)=>this.tree.get(str+'Enabled')).filter((e)=>!!e).length < 2) {
      return e.preventDefault();
    }
  },
  removeFilter: function(e) {
    var name = e.currentTarget.parentElement.getAttribute('name');
    if(name == null) return;
    var filtersChanged = false;
    var filters = this.search.get('filters');
    for(var i=0,filter; filter=filters[i], i < filters.length; i++) {
      if(filter.name == name) {
        filtersChanged = true;
        filters.splice(i, 1);
        break;
      }
    }
    if(!filtersChanged) throw new Error('goofy');
    this.search.set('filters', filters);
    this.search.trigger('change', this.search);
    this.search.trigger('change:filters', this.search);
  },
  initialize: function(params, options) {
    for(var prop in params) {
      this[prop] = params[prop];
    }
    this.bindTo = {search: this.search, tree: this.tree, view: this, treeview: this.treeview};
    this.listenTo(this.search, 'change:query', () => this.binding ? this.binding.sync() : null); // hacked
    this.listenTo(this.search, 'change:filters', this.updateoffset);
  },
  updateoffset: function(e) {
    var inputEl = this.el.querySelector('input');
    var searchFiltersEl = this.el.querySelector('.search-filters');
    this.binding.sync(); // race
    if(this.search.get('filters').length) {
      inputEl.style['padding-left'] = searchFiltersEl.offsetWidth + 'px';
    } else {
      inputEl.style['padding-left'] = '';
    }
  }
});

var Description = BaseView.extend({
  el: '#description',
  initialize: function(params, options) {
    for(var prop in params) {
      this[prop] = params[prop];
    }
    this.bindTo = {job: this.job};
  }
});

var startSame = function(string1, string2, threshold) {
  threshold = Math.min(string1.length, string2.length, threshold || 3);
  if(threshold < 2) return false;
  for(var i=0; i<threshold; i++) {
    if(string1[i]!==string2[i]) return false;
  }
  return true;
}

var SearchResults = BaseView.extend({
  el: '#search-results',
  initialize: function(params, options) {
    this.search = params.search;
    this.tree = params.treeView.model;
    this.treeView = params.treeView;
    this.listenTo(this.model, 'change:active', this.toggle);
    this.bindTo = {model: this.model, view: this};
  },
  events: {
    'dragstart': 'dragstart',
    'dragend': 'dragend',
    'click .filter' : 'addFilter'
  },
  addFilter: function(e) {
    var parEl = e.currentTarget.parentElement.parentElement;
    var type = parEl.getAttribute('data-type');
    var id = parEl.getAttribute('data-id');
    this.model.set('query', type + ':' + id);
  },
  toggle: function(e) {
    if(e.changed.active == null) return;
    if(e.changed.active) {
      this.el.classList.add('active');
    } else {
      this.el.classList.remove('active');
    }
  },
  dragstart: function(e) {
    var target = e.target;
    target.classList.add('dragged');
    var type = target.getAttribute('data-type');
    if(['part', 'component', 'phase', 'building'].indexOf(type) == -1) return;
    var id = target.getAttribute('data-id');

    var model;
    if(id != null && ['component'].indexOf(type) !== -1) {
      model = this.model.collections[type + 's'].get(id); // should also search other jobs
    }

    if(id != null && !model) {
      return;
    }

    if(id == null) {
      var Model = nameToModel(type);
      model = new Model({name: 'New ' + type[0].toUpperCase() + type.slice(1)});
    }

    this.tree.dragged = model;
    this.treeView.el.classList.add('dragging');
  },
  dragend: function(e) {
    e.target.classList.remove('dragged');
    this.treeView.el.classList.remove('dragging');
    this.tree.dragged = null;
    TreeElementView.clear();
  }
});

var TreeView = BaseView.extend({
  el: '#tree',
  initialize: function(params, options) {
    for(var prop in params) {
      this[prop] = params[prop];
    }
    this['short'] = false;
    this.bindTo = {model: this.model, view: this};
    this.listenTo(this.model, 'build', this.render);
    this.model.build();
  },
  events: {
    'click .remove': 'removeRoot',
    'dragenter': 'dragenter',
    'dragover':'dragover',
    'drop':'dragdrop'
  },
  dragenter: function(e) {
    e.preventDefault();
  },
  dragover: function(e) {
    e.preventDefault();
  },
  dragdrop: function(e) {
    if(this.model.tree.length != 0) return;
    if(this.model.dragged == null) return;
    var model = this.model.dragged;
    var collection = this.model.job.collections[model.type + 's'];

    model = collection.create(model.attributes);
  },
  removeRoot: function(e) {
    var name = e.currentTarget.getAttribute('name');
    if(name=='building' || name=='phase') {
      this.model.set('root'+name[0].toUpperCase()+name.slice(1), null);
    }
  },
  render: function() {
    BaseView.prototype.render.call(this);
    if(this.views) this.views.forEach((v)=>v.remove());
    if(this.model.tree) {
      this.views = this.model.tree.map((b)=>{
        var ob = this.model.job.collections[b.type + 's'].get(b._id);
        return new TreeElementView({model: ob, branch: b, tree: this.model});
      });
      this.views.forEach((v)=>{
        this.el.appendChild(v.render().el);
      });
    }
  }
});

var TreeElementView = BaseView.extend({
  initialize: function(attrs, options) {
    for(var prop in attrs) {
      this[prop] = attrs[prop];
    }
    this.listenTo(this.model, 'destroy', this.remove);
    this.bindTo = {model: this.model, branch: this.branch };
    this.setElement(this.template());
    this.dragtimeout = null;
  },
  events: {
    'dragstart': 'dragstart',
    'dragend': 'dragend',
    'dragenter .mask': 'dragenter',
    'dragleave .mask': 'dragleave',
    'dragover .mask': 'dragover',
    'drop .mask': 'dragdrop',
    'click .edit': 'editname',
    'click .root': 'addRoot',
    'keydown': 'keydown'
  },
  keydown: function(e) {
    if(e.target != this.el) return;
    if(e.which == SPACE_KEY) {
      return e.preventDefault();
    }
  },
  editname: function(e) {
    var nameEl = this.el.querySelector('.name');
    var inputEl = document.createElement('input');
    //inputEl.classList.add('name');
    inputEl.value = this.model.get('name');
    nameEl.parentElement.replaceChild(inputEl, nameEl);
    inputEl.select();
    var self = this;
    var func = function() {
      self.model.set('name', inputEl.value);
      inputEl.parentElement.replaceChild(nameEl, inputEl);
      //document.removeEventListener('click', func, false);
    };
    inputEl.addEventListener('blur', func, false);
  },
  addRoot: function(e) {
    if(this.model instanceof Phase) {
      this.tree.set('rootPhase', this.model.get('_id'));
    } else if (this.model instanceof Building) {
      this.tree.set('rootBuilding', this.model.get('_id'));
    }
  },
  undragstyle: function(e) {
    (this.el.parentElement && this.el.parentElement.querySelector('.fake')) ? this.el.parentElement.querySelector('.fake').classList.add('hidden') : null;
    this.el.classList.remove('hover');
    this.dragtimeout = null;
  },
  dragstart: function(e) {
    if(e.target != this.el) return;
    this.tree.dragged = this.model;
    this.el.classList.add('dragged');
    this.el.parentElement.classList.add('dragging');
  },
  dragend: function(e) {
    if(e.target != this.el) return;
    this.tree.dragged = null;
    this.el.classList.remove('dragged');
    this.el.parentElement.classList.remove('dragging');
    TreeElementView.clear();
    if(TreeElementView.el && TreeElementView.el.parentElement) TreeElementView.el.parentElement.removeChild(TreeElementView.el);
  },
  dragstyle: function(e, el) {
    if(el) {
      if(el.parentElement == null) {
        this.el.parentElement.appendChild(el);
      }
      el.classList.remove('hidden');
      var str = 'translateY(' + String(Number(this.el.offsetTop)+60) + 'px )';
      el.style.transform = str;
    }
    this.el.classList.add('hover');
  },
  dragenter: function(e) {
    //if(e.target != this.el) return;
    var placement;
    var sibling = e.currentTarget.getAttribute('name') === 'left';
    clearTimeout(this.dragtimeout);
    if(this.tree.dragged != null && (placement = this.validPlacement(this.tree.dragged, sibling))) {
      var el = TreeElementView.fake({branch: {level: this.branch.level + (sibling ? 0 : 1), type: this.tree.dragged.type}, model: this.tree.dragged});
      this.dragstyle(e, el);
      this.dragtimeout = setTimeout(this.undragstyle.bind(this), 1000);
      e.preventDefault();
    }
  },
  dragdrop: function(e) {
    clearTimeout(this.dragtimeout);
    this.el.parentElement.classList.remove('dragging');
    TreeElementView.clear();
    console.log('drop');

    var model = this.tree.dragged;
    var sibling = e.currentTarget.getAttribute('name') === 'left';
    var placement = this.validPlacement(model, sibling);

    var job = this.tree.job;

    var collection = job.collections[model.type + 's'];

    if(!collection.contains(model)) {
      model = model.clone();
    }

    if(model instanceof Component) {
      model.set({
        job: job.get('_id'),
        phase: placement.phase || model.get('phase'),
        building: placement.building || model.get('building')
      });

    } else if (model instanceof Building) {
      model.set({
        job: job.get('_id'),
        'parent': placement.building
      });

    } else if (model instanceof Phase) {
      model.set({
        job: job.get('_id'),
        'parent': placement.phase
      });

    } else {
      throw new Error('unsupported');
    }


    if(!collection.contains(model)) {
      collection.create(model.attributes);
    }
    e.originalEvent.preventDefault();

    this.tree.dragged = null;
    this.undragstyle();
  },
  dragleave: function(e) {
    clearTimeout(this.dragtimeout);
    this.dragtimeout = setTimeout(this.undragstyle.bind(this, e), 100);
  },
  dragover: function(e) {
    var placement;
    var sibling = e.currentTarget.getAttribute('name') === 'left';
    if(this.tree.dragged != null && (placement = this.validPlacement(this.tree.dragged, sibling))) {
      this.el.parentElement.querySelector('.fake') ? this.el.parentElement.querySelector('.fake').classList.remove('hidden') : null;
      if(this.dragtimeout != null) {
        clearTimeout(this.dragtimeout);
        this.dragtimeout = setTimeout(this.undragstyle.bind(this), 1000);
      }
      e.preventDefault();
    }
  },
  validPlacement: function(model, isSibling) {
    if(isSibling == null) throw new Error('need to specify sibling');
    // sibling or child
    if(this.model == model) return false;
    if(model instanceof Component) {
      if(this.model instanceof Component) return false;
      if(this.model instanceof Building || this.model instanceof Phase) {
        var i;
        var branch = this.branch;
        var phaseBranch;
        var buildingBranch;
        var maxlevel = this.branch.level + (!isSibling ? 1 : 0);
        do {
          i = this.tree.tree.indexOf(branch);
          if((this.model instanceof Phase || buildingBranch != null) && branch.level < maxlevel) {
            if(branch.type == 'phase') {
              phaseBranch = branch;
              break;
            } else {
              maxlevel = Math.min(branch.level, maxlevel);
            }
          } else if(buildingBranch == null && branch.level < maxlevel) {
            buildingBranch = branch;
            maxlevel = branch.level;
          }
          branch = this.tree.tree[i-1];
        } while (i > -1 && branch);
        if(
          !(phaseBranch == null && buildingBranch == null) &&
          (phaseBranch == null || phaseBranch._id == model.get('phase')) &&
          (buildingBranch == null || buildingBranch._id == model.get('building'))
        ) return false;
        return {phase: phaseBranch ? phaseBranch._id : this.tree.get('rootPhase'), building: buildingBranch ? buildingBranch._id : this.tree.get('rootBuilding')};
      }
    } else if (model instanceof Building) { // only allow adding on similar models
      if(this.model instanceof Building) {
        var parents = [];
        var cur = this.model;

        if(!isSibling) {
          parents.push(cur.get('_id'));
        }
        while(cur != null) {
          cur = this.model.collection.get(cur.get('parent'));
          if(cur != null) parents.push(cur.get('_id'));
        }
        if(parents.indexOf(model.get('_id')) !== -1) return false;
        // here
        return {building: isSibling ? this.model.get('parent') : this.model.get('_id')};
      } else if (this.model instanceof Phase) {
        if(this.model.get('parent') != null) return false;
        // root building (no parent)
        return {phase: null};

      } else {
        return false;
      }

    } else if (model instanceof Phase) {
      if(!(this.model instanceof Phase)) return false; // only allow adding on similar models
      var parents = [];
      var cur = this.model;

      if(!isSibling) {
        parents.push(cur.get('_id'));
      }
      while(cur != null) {
        cur = this.model.collection.get(cur.get('parent'));
        if(cur != null) parents.push(cur.get('_id'));
      }
      if(parents.indexOf(model.get('_id')) !== -1) return false;

      return {phase: isSibling ? this.model.get('parent') : this.model.get('_id')};
    }
  },
  template: function() {
    var el = document.importNode(document.getElementById('tree-element-template').content, true).firstChild;
    return el;
  },
  render: function() {
    this.binding = this.binding || rivets.bind(this.el, this.bindTo);
    return this;
  }
});
TreeElementView.el = null;
TreeElementView.binding = null;
TreeElementView.clear = function() {
  if(TreeElementView.el == null) return;
  if(TreeElementView.binding) TreeElementView.binding.unbind();
  if(TreeElementView.el.parentElement) TreeElementView.el.parentElement.removeChild(TreeElementView.el);
  TreeElementView.el = null;
}
TreeElementView.fake = function(props) {
  if(TreeElementView.el == null) {
    TreeElementView.el = TreeElementView.prototype.template.call(null);
    TreeElementView.el.classList.add('fake');
    // model, branch
  } else {
    TreeElementView.binding.unbind();
  }
  TreeElementView.binding = rivets.bind(TreeElementView.el, props);
  return TreeElementView.el;
};

var jobs = new Jobs();
var phases = new Phases();
var buildings = new Buildings();
var components = new Components();

jobs.reset(PREFETCH.jobs);
job = jobs.get(PREFETCH.job['_id']);

phases.url = '/api/jobs/' + job.get('_id') + '/phases'
buildings.url = '/api/jobs/' + job.get('_id') + '/buildings'
components.url = '/api/jobs/' + job.get('_id') + '/components'

job.collections.phases = phases;
job.collections.buildings = buildings;
job.collections.components = components;

var treeModel = new Tree(null, {job: job});

var treeView = new TreeView({model: treeModel});

var searchModel = new Search(null, {collections: {phases: phases, buildings: buildings, components: components, jobs: jobs}});
var searchView = new SearchResults({model: searchModel, search: searchModel, treeView: treeView});
searchView.render();

var navbar = new Navbar({tree: treeModel, search: searchModel, treeview: treeView}); 
navbar.render();
var description = new Description({job: job}); 
description.render();

var cleanup = function(ob) {
  if(Array.isArray(ob)) {
    ob.forEach(cleanup);
    return;
  }
  if(ob.parent) {
    ob.parent = ob.parent._id;
  }
  if(typeof ob.phase === 'object') {
    ob.phase = ob.phase != null ? ob.phase._id : null;
  }
  if(typeof ob.building === 'object') {
    ob.building = ob.building != null ? ob.building._id : null;
  }
}

buildings.savetimeout = null;
buildings.on('change', function(model, options) {
  clearTimeout(buildings.savetimeout);
  buildings.savetimeout = setTimeout(() =>{
    model.save();
  }, 1000);
});
components.savetimeout = null;
components.on('change', function(model, options) {
  clearTimeout(components.savetimeout);
  components.savetimeout = setTimeout(() =>{
    model.save();
  }, 1000);
});
phases.savetimeout = null;
phases.on('change', function(model, options) {
  clearTimeout(phases.savetimeout);
  phases.savetimeout = setTimeout(() =>{
    model.save();
  }, 1000);
});



var init = function() {
  cleanup(PREFETCH.phases);
  cleanup(PREFETCH.buildings);
  cleanup(PREFETCH.components);
  if(PREFETCH && PREFETCH.phases) {
    phases.reset(PREFETCH.phases);
  } else {
    phases.fetch();
  }
  if(PREFETCH && PREFETCH.buildings) {
    buildings.reset(PREFETCH.buildings);
  } else {
    buildings.fetch();
  }
  if(PREFETCH && PREFETCH.components) {
    components.reset(PREFETCH.components);
  } else {
    components.fetch();
  }
};
document.addEventListener('DOMContentLoaded', function(e) {
  init();
});
