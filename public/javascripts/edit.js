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
    this.bindTo = {search: this.search, view: this};
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

var SearchResults = BaseView.extend({
  el: '#search-results',
  initialize: function(params, options) {
    this.listenTo(this.model, 'change:active', this.toggle);
    this.bindTo = {model: this.model, view: this};
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
  },
  dragend: function(e) {
    e.target.classList.remove('dragged');
  }
});

var View = Backbone.View.extend({
  el: '#element',
  events: {
    'click .save' : 'save'
  },
  save: function(e) {
    this.model.save();
  },
  render: function() {
    if(this.binding == null) {
      var templateEl = this.el.querySelector('template');
      var template = document.importNode(templateEl.content, true).firstChild;
      this.binding = rivets.bind(template, {model: this.model});
      var old = this.el;
      old.parentElement.replaceChild(template, old);
      this.setElement(template);
    }
  }
});

var PartTable = Backbone.View.extend({
  el: '#part-table',
  render: function() {
    this.binding = rivets.bind(this.el, {model: this.model});
  }
});

var jobs = new Jobs();
var collections = {};
var phases = new Phases();
var buildings = new Buildings();
var components = new Components();
var parts = new Parts();

if(typeof PREFETCH !== 'undefined') {
  
  phases.reset(PREFETCH.phases);
  buildings.reset(PREFETCH.buildings);
  components.reset(PREFETCH.components);
  parts.reset(PREFETCH.parts);
  jobs.reset(PREFETCH.jobs);

  collections.phases = phases;
  collections.buildings = buildings;
  collections.components = components;
  collections.parts = parts;
  collections.jobs = jobs;


  if(PREFETCH.component) {
    var component = components.get(PREFETCH.component['_id']);
    component.parts = new Parts();
    var view = new View({model: component});
    view.render();

    var searchModel = new Search(null, {collections: collections});
    var navbar = new Navbar({search: searchModel}); 
    navbar.render();

    var searchView = new SearchResults({model: searchModel});
    searchView.render();

  }

} else {
  throw new Error('no data');
}
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
