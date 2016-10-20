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
  initialize: function() {
    this.on('change:parts', this.updateParts);
  },
  updateParts: function() {
    if(!this.parts) return;
    console.log(this.parts);
  },
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
var Part = Backbone.Model.extend({
  idAttribute:'version_id',
  type: 'part',
  defaults: {
    name: 'Part',
    qty: 0,
    price: 0.00,
    description: '',
    part: ''
  }
});

var PartRef = Backbone.Model.extend({
  defaults: {
    name: 'New Part',
    qty: 1,
    price: 0.00,
    description: '',
    part: ''
  }
});

var Job = Backbone.Model.extend({
  type: 'job',
  idAttribute: '_id',
  initialize: function(params, options) {
    this.collections = options.collections || {};
  }
});

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
    var filtersChanged = false;
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
              filtersChanged = true;
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
              results = col.filter((j)=>j.get('name').toLowerCase().indexOf(query.toLowerCase()) != -1);
            }
            break;
          case 'part':
            col = this.collections.parts;
            if(col) {
              let queryParts = query.split(' ');
              results = col.chain().filter((j)=>j.get('description') && queryParts.every((p)=>j.get('description').toLowerCase().indexOf(p) != -1)).first(20).value();
            }
            break;

        }
      } else if (filter.kind == 'property') {
        // looking for model with this 'filter.property'
        switch(filter.property) {
          case 'job':
            // phases, components, buildings
            results = ['phases', 'components', 'buildings'].map((t)=>this.collections[t].filter((m)=>m.get('job') == filter.value && m.get('name').toLowerCase().indexOf(query.toLowerCase()) != -1)).reduce((a,b)=>a.concat(b));
            break;
          case 'phase':
          case 'building':
            // components
            results = ['components'].map((t)=>this.collections[t].filter((m)=>m.get(filter.property) == filter.value && m.get('name').toLowerCase().indexOf(query.toLowerCase()) != -1)).reduce((a,b)=>a.concat(b));
            break;
          case 'parent':
            // phases, buildings
            results = ['phases', 'buildings'].map((t)=>this.collections[t].filter((m)=>m.get('parent') == filter.value && m.get('name').toLowerCase().indexOf(query.toLowerCase() != -1))).reduce((a,b)=>a.concat(b));
            break;
        }
      }
    }
    if(!b) {
      var prefixes = ['job', 'phase', 'building', 'component', 'part'];
      for(var j=0,prefix; prefix=prefixes[j],j < prefixes.length; j++) {
        if(query.startsWith(prefix + ':') && this.collections[prefix + 's'] != null) {
          query = query.slice(prefix.length+1);
          if(filters.filter((f)=>f.kind=='type'&&f.type==prefix).length == 0) {
            filtersChanged = true;
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

    // needs fixing
    results = results || ['components', 'phases', 'buildings'].map((t)=>this.collections[t].filter((m)=>t == 'component' ? m.get('description').toLowerCase().startsWith(query.toLowerCase()) : m.get('name').toLowerCase().startsWith(query.toLowerCase()))).reduce((a,b)=>a.concat(b));

    this.set({
      results: results || [],
      filters: _.clone(filters),
      query: query
    });
    //this.trigger('change', this);
    if(filtersChanged) {
      this.trigger('change:filters', this);
    }
  },
  getFilters: function() {
    return this.get('filters');
  },
  suggestion: function() {
  }
});



var nameToModel = function(name) {
  switch(name) {
    case 'phase':
      return Phase;
    case 'building':
      return Building;
    case 'component':
      return Component;
    case 'part':
      return Part;
    default:
      throw new Error('invalid name "'+name+'"');
  }
}

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
var Parts = Collection.extend({
  url: '/api/parts',
  model: Part
});
var PartRefs = Backbone.Collection.extend({
  url: function() {
    return '/api/components/' + this.component.get('_id') + '/parts';
  },
  model: PartRef,
  initialize: function(models, options) {
    if(options == null || options.component == null || !(options.component instanceof Component)) throw new Error('invalid');
    this.component = options.component;
    this.on('add', this.partAdd);
    this.on('remove', this.partRemove);
    this.on('change', this.partChange);
    this.on('reset', this.partReset);
  },
  partChange: function(model, options) {
    var cparts = this.component.get('parts');
    var partIds = cparts.map((p)=>p.part);
    var index;
    if((index=partIds.indexOf(model.get('part'))) == -1) throw new Error('goofy');
    var json = model.toJSON();
    if(!_.isEqual(cparts[index], json)) {
      cparts[index] = json;
      this.component.set('parts', cparts);
    }
  },
  partAdd: function(model, collection, options) {
    var cparts = this.component.get('parts') || [];
    if(cparts.map((p)=>p.part).indexOf(model.get('part')) == -1) { // only allows a single instance of part with version_id
      this.component.set('parts', cparts.concat(model.toJSON()));
    }
  },
  partRemove: function(model, collection, options) {
    var id = model.get('part');
    var cparts = this.component.get('parts');
    if(cparts.map((p)=>p.part).indexOf(id) != -1) {
      this.component.set('parts', cparts.filter((p)=>p.part!=id)); // may be better to use splice.  in this case only one part of a particular ver_id may be used
    }
  },
  partReset: function(collection, options) {
    var ids = collection.map((m)=>m.get('version_id'));
    if(!_.isEqual(ids, this.component.get('parts'))) {
      this.component.set('parts', ids);
    }
  }
});
