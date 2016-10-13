var Job = Backbone.Model.extend({
  initialize: function(params, options) {
  }
});

var Tree = Backbone.Model.extend({
  initialize: function(params, options) {
    var str = ['phaseEnabled', 'buildingEnabled', 'componentEnabled', 'buildingDescendants', 'phaseDescendants', 'emptyFolders'].map((e)=>'change:' + e).join(' ');
    this.on(str, this.build);
    this.listenTo(this.get('job').phases, 'reset', this.recalculate);
    this.listenTo(this.get('job').buildings, 'reset', this.recalculate);
    this.listenTo(this.get('job').components, 'reset', this.recalculate);
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
    'click .toggle':'toggled'
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

var Search = Backbone.Model.extend({
  defaults: {
    query: ''
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
  render: function() {
    BaseView.prototype.render.call(this);
    if(this.views) this.views.forEach((v)=>v.remove());
    if(this.model.tree) {
      this.views = this.model.tree.map((b)=>{
        var ob = this.model.get('job')[b.type + 's'].get(b._id);
        return new TreeElementView({model: ob, branch: b});
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
