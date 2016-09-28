// base models
var Model = Backbone.Model.extend({
  idAttribute: '_id'
});
var Collection = Backbone.Collection.extend({});

// should roughly mirror /models/
var JobModel = Model.extend({
  defaults: {
    rootPhase: null
  },
  initialize: function(attrs, options) {

  },
  validate: function(attrs, options) {
    if(attrs.name == null || attrs.name == '') return 'name required';
  }
});
var JobCollection = Collection.extend({
  name: 'jobs',
  url: '/api/jobs',
  model: JobModel,
  initialize: function(models, options) {

  }
});

var PhaseModel = Model.extend({
  initialize: function(attrs, options) {

  }
});
var PhaseCollection = Collection.extend({
  name: 'phases',
  url: '/api/phases',
  model: PhaseModel,
  initialize: function(models, options) {

  }
});
var BuildingModel = Model.extend({
  initialize: function(attrs, options) {

  }
});
var BuildingCollection = Collection.extend({
  name: 'buildings',
  url: '/api/buildings',
  model: BuildingModel,
  initialize: function(models, options) {

  }
});

var ComponentModel = Model.extend({
  initialize: function(attrs, options) {

  }
});
var ComponentCollection = Collection.extend({
  name: 'components',
  url: '/api/components',
  model: ComponentModel,
  initialize: function(models, options) {

  }
});
