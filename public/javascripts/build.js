var Job = Backbone.Model.extend({
  initialize: function(params, options) {
  }
});

var Tree = Backbone.Model.extend({
  initialize: function(params, options) {
    var str = ['phaseEnabled', 'buildingEnabled', 'componentEnabled', 'buildingDescendants', 'phaseDescendants', 'emptyFolders'].map((e)=>'change:' + e).join(' ');
    this.on(str, this.build);
  },
  recalculate: function() {
    var job = this.get('job');
    var data = ['phases', 'buildings', 'components'].map((m)=>job[m].toJSON());
    console.log(data);
    this.func = common.assembleTree(data);
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
    if(this.func == null) this.recalculate();
    // currentRootPhase, currentRootBuilding, level, phaseEnabled, buildingEnabled, componentEnabled, phaseDescendants, buildingDescendants
    var result = this.func(this.get('rootPhase'), this.get('rootBuilding'), 0, this.get('phaseEnabled'), this.get('buildingEnabled'), this.get('componentEnabled'), this.get('phaseDescendants'), this.get('buildingDescendants'), this.get('emptyFolders'));
    console.log(result);
    this.tree = result.tree;
    console.log(result.tree);
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
  }
});

var Navbar = BaseView.extend({
  el: '#navigation-bar',
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
  }
});

var Phases = Backbone.Collection.extend({});
var Buildings = Backbone.Collection.extend({});
var Components = Backbone.Collection.extend({});

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
treeView.render();


var navbar = new Navbar({tree: treeModel, search: searchModel}); 
navbar.render();
var description = new Description({job: job}); 
description.render();

var init = function() {
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
