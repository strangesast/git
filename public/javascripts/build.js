const SPACE_KEY = 32;
const DOWNARROW_KEY = 40;
const UPARROW_KEY = 38;
const ENTER_KEY = 13;
const ESC_KEY = 27;
const BACKSPACE_KEY = 8;

var Job = Backbone.Model.extend({
  initialize: function(params, options) {
  }
});

var Tree = Backbone.Model.extend({
  initialize: function(params, options) {
    var str = ['rootPhase', 'rootBuilding', 'phaseEnabled', 'buildingEnabled', 'componentEnabled', 'buildingDescendants', 'phaseDescendants', 'emptyFolders'].map((e)=>'change:' + e).join(' ');
    this.on(str, this.build);
    this.listenTo(this.get('job').phases, 'reset', this.recalculate);
    this.listenTo(this.get('job').buildings, 'reset', this.recalculate);
    this.listenTo(this.get('job').components, 'reset', this.recalculate);
    this.dragged = null;
  },
  recalculate: function() {
    var job = this.get('job');
    var data = ['phases', 'buildings', 'components'].map((m)=>job[m].toJSON());
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
    return this.get('rootPhase') ? this.get('job').phases.get(this.get('rootPhase')).get('name') : null;
  },
  rootBuilding: function() {
    return this.get('rootBuilding') ? this.get('job').buildings.get(this.get('rootBuilding')).get('name') : null;
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
    'blur .search input' : 'blur'
  },
  keydown: function(e) {
    if(e.which == ESC_KEY) {
      this.blur();
    } else if (e.which == BACKSPACE_KEY) {
      if(this.search.get('query') == '' && this.search.get('filters').length) {
        this.search.set('filters', this.search.get('filters').slice(1));
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
    active: false
  },
  initialize: function() {
    this.on('change:query', this.input);
    this.on('change:suggestedFilters', this.suggestion);
  },
  input: function() {
    var filters = this.get('filters') || [];
    var suggestedFilters = [];
    var query = this.get('query');
    var names = ['job', 'phase', 'building', 'component'];
    for(var i=0,name; name=names[i], i<names.length; i++) {
      if(startSame(query, name)) {
        if(query.startsWith(name + ':') && filters.indexOf(name) == -1) {
          filters.push(name);
          query = '';
          break;
        } else {
          suggestedFilters.push(name + ':');
          continue;
        }
      }
    }
    this.set({'suggestedFilters': suggestedFilters, 'query': query, filters: filters.slice()});
    this.set('filters', filters);
  },
  suggestion: function() {
    console.log(this.get('filters'));
    console.log(this.get('suggestedFilters'));
  }
});

var SearchResults = BaseView.extend({
  el: '#search-results',
  initialize: function(params, options) {
    this.search = params.search;
    this.listenTo(this.search, 'change:active', this.toggle);
    this.bindTo = {model: this.model, search: this.search};
  },
  events: {
    'dragstart': 'dragstart',
    'dragend': 'dragend'
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
    e.target.classList.add('dragged');
  },
  dragend: function(e) {
    e.target.classList.remove('dragged');
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
        var ob = this.model.get('job')[b.type + 's'].get(b._id);
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
    'dragenter': 'dragenter',
    'dragleave': 'dragleave',
    'dragover': 'dragover',
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
    this.el.classList.remove('hover');
    this.dragtimeout = null;
  },
  dragstart: function(e) {
    if(e.target != this.el) return;
    this.tree.dragged = this.model;
    this.el.classList.add('dragged');
  },
  dragend: function(e) {
    if(e.target != this.el) return;
    this.tree.dragged = null;
    this.el.classList.remove('dragged');
  },
  dragstyle: function(e) {
    this.el.classList.add('hover');
  },
  dragenter: function(e) {
    if(e.target != this.el) return;
    var placement;
    if(this.tree.dragged != null && (placement = this.validPlacement(this.tree.dragged))) {
      console.log(placement);
      this.dragstyle(e);
      clearTimeout(this.dragtimeout);
      this.dragtimeout = setTimeout(this.undragstyle.bind(this), 1000);
      //var el = TreeElementView.fake({branch: this.branch, model: model});
    }
  },
  dragleave: function(e) {
    if(e.target != this.el) return;
    clearTimeout(this.dragtimeout);
    this.undragstyle(e);
  },
  dragover: function(e) {
    if(e.target != this.el) return;
    if(this.dragtimeout != null) {
      clearTimeout(this.dragtimeout);
      this.dragtimeout = setTimeout(this.undragstyle.bind(this), 1000);
    }
  },
  validPlacement: function(model) {
    if(this.model == model) return false;
    if(model instanceof Component) {
      if(this.model instanceof Component) return false;
      if(this.model instanceof Building || this.model instanceof Phase) {
        var i;
        var branch = this.branch;
        var phaseBranch;
        var buildingBranch;
        var maxlevel = this.branch.level + 1;
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
        if(!(phaseBranch == null && buildingBranch == null) && (phaseBranch == null || phaseBranch._id == model.get('phase')) && (buildingBranch == null || buildingBranch._id == model.get('building'))) return false;
        return {phase: phaseBranch ? phaseBranch._id : this.tree.get('rootPhase'), building: buildingBranch ? buildingBranch._id : this.tree.get('rootBuilding')};
      }
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
TreeElementView.fake = function(props) {
  var el = TreeElementView.template();
  // model, branch
  var binding = rivets.bind(el, props);
  var unbind = function() {
    binding.unbind();
  };
  return {el: el, unbind: unbind};
};

var Element = Backbone.Model.extend({
  idAttribute: '_id'
});
var Phase = Element.extend({
  getURL: function() {
    return '/app/edit/phases/' + this.get(this.idAttribute);
  }
});
var Building = Element.extend({
  getURL: function() {
    return '/app/edit/buildings/' + this.get(this.idAttribute);
  }
});
var Component = Element.extend({
  getURL: function() {
    return '/app/edit/component/' + this.get(this.idAttribute);
  }
});
var Collection = Backbone.Collection.extend({
  parse: function() {
    console.log(arguments);
    return Backbone.Collection.prototype.parse.apply(this, arguments);
  }
});
var Phases = Collection.extend({
  model: Phase
});
var Buildings = Collection.extend({
  model: Building
});
var Components = Collection.extend({
  model: Component
});

var phases = new Phases();
var buildings = new Buildings();
var components = new Components();

var job = new Job(PREFETCH.job);
job.phases = phases;
job.buildings = buildings;
job.components = components;

var searchModel = new Search();
var searchView = new SearchResults({model: searchModel, search: searchModel});
searchView.render();

var treeModel = new Tree({job: job});

var treeView = new TreeView({model: treeModel});


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
    ob.phase = ob.phase._id;
  }
  if(typeof ob.building === 'object') {
    ob.building = ob.building._id;
  }
}

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
