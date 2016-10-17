const SPACE_KEY = 32;
const DOWNARROW_KEY = 40;
const UPARROW_KEY = 38;
const ENTER_KEY = 13;
const ESC_KEY = 27;
const BACKSPACE_KEY = 8;

var nameToModel = function(name) {
  switch(name) {
    case 'phase':
      return Phase;
    case 'building':
      return Building;
    case 'component':
      return Component;
    default:
      throw new Error('invalid name "'+name+'"');
  }
}

var Job = Backbone.Model.extend({
  type: 'job',
  idAttribute: '_id',
  initialize: function(params, options) {
    this.collections = options.collections || {};
  }
});

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
    this.func = common.assembleTree(data);
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
    if(this.func == null) return this.recalculate();
    // currentRootPhase, currentRootBuilding, level, phaseEnabled, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants

    var result = this.func(
      this.get('rootPhase'),
      this.get('rootBuilding'),
      0,
      this.get('phaseEnabled'),
      this.get('buildingEnabled'),
      this.get('componentEnabled'),
      this.get('phaseDescendants'),
      this.get('buildingDescendants'),
      this.get('emptyFolders')
    );
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
    'cilck .remove': 'removeFilter'
  },
  keydown: function(e) {
    if(e.which == ESC_KEY) {
      this.blur();
    } else if (e.which == BACKSPACE_KEY) {
      if(this.search.get('query') == '' && this.search.get('filters').length) {
        this.search.set('filters', this.search.get('filters').slice(0, -1));
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
    console.log(e);
  },
  initialize: function(params, options) {
    for(var prop in params) {
      this[prop] = params[prop];
    }
    this.bindTo = {search: this.search, tree: this.tree, view: this};
    this.listenTo(this.search, 'change:query', () => this.binding ? this.binding.sync() : null); // hacked
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

var Search = Backbone.Model.extend({
  defaults: {
    query: '',
    filters: [],
    suggestedFilters: [],
    active: false,
    results: []
  },
  initialize: function(params, options) {
    this.on('change:query', this.input);
    this.on('change:suggestedFilters', this.suggestion);
    this.collections = options.collections;
  },
  input: function() {
    var query = this.get('query');
    var filters = this.get('filters');
    //var results = this.get('results');
    var results;
    var filterKinds = [];

    var b = false;
    var model, models;
    for(var i=0,filter; filter=filters[i], i<filters.length; i++) {
      if(filter.kind == 'type') {
        var col;
        switch(filter.type) {
          case 'job':
            col = col || this.collections.jobs;
          case 'phase':
            col = col || this.collections.phases;
          case 'building':
            col = col || this.collections.buildings;
          case 'component':
            col = col || this.collections.components;
            if(model = col.get(query)) {
              filters.splice(i, 1);
              filters.push({
                kind: 'property',
                property: filter.type,
                value: model.get('_id'),
                name: model.get('name')
              });
              query = '';
              b = true;

            } else {
              results = col.filter((j)=>j.get('name').toLowerCase().startsWith(query.toLowerCase()));
            }
            break;
        }
      } else if (filter.kind == 'property') {
        // looking for model with this 'filter.property'
        switch(filter.property) {
          case 'job':
            // phases, components, buildings
            results = ['phases', 'components', 'buildings'].map((t)=>this.collections[t].filter((m)=>m.get('job') == filter.value && m.get('name').toLowerCase().startsWith(query.toLowerCase()))).reduce((a,b)=>a.concat(b));
            break;
          case 'phase':
          case 'building':
            // components
            results = ['components'].map((t)=>this.collections[t].filter((m)=>m.get(filter.property) == filter.value && m.get('name').toLowerCase().startsWith(query.toLowerCase()))).reduce((a,b)=>a.concat(b));
            break;
          case 'parent':
            // phases, buildings
            results = ['phases', 'buildings'].map((t)=>this.collections[t].filter((m)=>m.get('parent') == filter.value && m.get('name').toLowerCase().startsWith(query.toLowerCase()))).reduce((a,b)=>a.concat(b));
            break;
        }
      }
    }
    if(!b) {
      var prefixes = ['job', 'phase', 'building', 'component'];
      for(var j=0,prefix; prefix=prefixes[j],j < prefixes.length; j++) {
        if(query.startsWith(prefix + ':')) {
          query = query.slice(prefix.length+1);
          if(filters.filter((f)=>f.kind=='type'&&f.type==prefix).length == 0) {
            filters.push({
              kind: 'type',
              type: prefix,
              name: prefix
            });
          }
          break;
        }
      }
    }

    results = results || ['components', 'phases', 'buildings'].map((t)=>this.collections[t].filter((m)=>t == 'component' ? m.get('description').toLowerCase().startsWith(query.toLowerCase()) : m.get('name').toLowerCase().startsWith(query.toLowerCase()))).reduce((a,b)=>a.concat(b));

    this.set({
      results: results || [],
      filters: _.clone(filters),
      query: query
    });
    this.trigger('change', this);
    this.trigger('change:filters', this);
  },
  getFilters: function() {
    return this.get('filters');
  },
  suggestion: function() {
  }
});

var SearchResults = BaseView.extend({
  el: '#search-results',
  initialize: function(params, options) {
    this.search = params.search;
    this.tree = params.treeView.model;
    this.treeView = params.treeView;
    this.listenTo(this.search, 'change:active', this.toggle);
    //this.listenTo(this.search, 'change:results', this.update);
    this.bindTo = {model: this.model, search: this.search};
  },
  events: {
    'dragstart': 'dragstart',
    'dragend': 'dragend',
    'click .filter' : 'addFilter'
  },
  addFilter: function(e) {
    var parEl = e.currentTarget.parentElement;
    var type = parEl.getAttribute('data-type');
    var id = parEl.getAttribute('data-id');
    this.search.set('query', type + ':' + id);
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
      model = this.search.collections[type + 's'].get(id); // should also search other jobs
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
  },
  update: function(e) {
    console.log(this.search.get('results'));
  }
});

var TreeView = BaseView.extend({
  el: '#tree',
  initialize: function(params, options) {
    for(var prop in params) {
      this[prop] = params[prop];
    }
    this.bindTo = {model: this.model};
    this.listenTo(this.model, 'build', this.render);
    this.model.build();
  },
  events: {
    'click .remove': 'removeRoot'
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
    'drop': 'dragdrop',
    'click .root': 'addRoot',
    'keydown': 'keydown'
  },
  keydown: function(e) {
    if(e.which == SPACE_KEY) {
      return e.preventDefault();
    }
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
    this.el.parentElement.classList.remove('dragging');
    clearTimeout(this.dragtimeout);
    TreeElementView.clear();

    var model = this.tree.dragged;
    if(model == null) return console.log('nothing "dragged"');
    var placement = this.validPlacement(model);

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
      if(!(this.model instanceof Building)) return false;
      return {building: isSibling ? this.model.get('parent') : this.model.get('_id')};

    } else if (model instanceof Phase) {
      if(!(this.model instanceof Phase)) return false; // only allow adding on similar models
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

var Element = Backbone.Model.extend({
  idAttribute: '_id'
});
var Phase = Element.extend({
  type: 'phase',
  getURL: function() {
    return '/app/edit/phases/' + this.get(this.idAttribute);
  }
});
var Building = Element.extend({
  type: 'building',
  getURL: function() {
    return '/app/edit/buildings/' + this.get(this.idAttribute);
  }
});
var Component = Element.extend({
  type: 'component',
  getURL: function() {
    return '/app/edit/component/' + this.get(this.idAttribute);
  },
  getBuilding: function() {
    if(this.get('job') == null) return null;
    var building = jobs.get(this.get('job')).collections.buildings.get(this.get('building'));
    return building ? building.get('name') : null;
  },
  getPhase: function() {
    if(this.get('job') == null) return null;
    var phase = jobs.get(this.get('job')).collections.phases.get(this.get('phase'));
    return phase ? phase.get('name') : null;
  }
});
var Collection = Backbone.Collection.extend({});
var Jobs = Collection.extend({
  url: '/api/jobs',
  model: Job
});
var Phases = Collection.extend({
  url: '/api/phases',
  model: Phase
});
var Buildings = Collection.extend({
  url: '/api/buildings',
  model: Building
});
var Components = Collection.extend({
  url: '/api/components',
  model: Component
});

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




var navbar = new Navbar({tree: treeModel, search: searchModel}); 
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
