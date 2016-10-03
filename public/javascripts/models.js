// base models
var Model = Backbone.Model.extend({
  idAttribute: '_id'
});

var Collection = Backbone.Collection.extend({
  // initiate synchronization with similar collection
  // attach message channel sync to collection in worker, frame, etc
  syncTo: function(worker) {
    var self = this;
    if(self.name == null) throw new Error('collection must have name for pairing');

    return new Promise(function(resolve, reject) {
      var channel = new MessageChannel();

      var onFirstMessage = function(e) {
        if(typeof e.data !== 'object') throw new Error('invalid data type');
        var message = e.data;
        if(message.type === 'setup') {
          if(!message.data['status'] || message.data['status'] !== 'complete') {
            return reject(message.data);
          }
          channel.port1.removeEventListener('message', onFirstMessage);
          return resolve(self.syncFrom('serviceworker', channel.port1));

        } else {
          return reject(new Error('unrecognized message type'));

        }
      };
      channel.port1.addEventListener('message', onFirstMessage);
      channel.port1.start(); // required when using 'addEventListener' >:(

      // send initial request
      worker.postMessage({
        type: 'setup',
        data: {
          type: 'collection',
          path: self.url.startsWith('/') ? self.url.slice(1) : self.url,
          name: self.name
        }
      }, [channel.port2]);
      // timeout
      setTimeout(function() {
        return reject(new Error('setup timeout reached'));
      }, 1000);
    });
  },
  syncFrom: function(clientId, port) {
    // passed port when setup command is received for this collection
    if(this.name == null) throw new Error('collection must have name for pairing');
    var self = this;

    var push = function() {
      clearTimeout(this.syncop);
      this.syncop = setTimeout(function() {
        console.log(self);
        var message = {
          type: 'sync',
          data: {
            on: self.name,
            values: self.toJSON()
          }
        };
        console.log('push!', message)
        port.postMessage(message);
      }, 100);
    }

    // for these events, send new collection state to other clients
    self.on('add', push);
    self.on('remove', push);
    self.on('change', push);

    // receive other clients' updates
    var onMessage = function(e) {
      if(typeof e.data !== 'object') throw new Error('invalid data type');
      var message = e.data;
      var data = message.data;
      if(message.type === 'sync') {
        if(data.on !== self.name) throw new Error('collection mismatch');

        self.off('add', push);
        self.off('remove', push);
        self.off('change', push);

        self.fetchThen().then(function() {
          self.on('add', push);
          self.on('remove', push);
          self.on('change', push);
        });

      } else {
        throw new Error('unrecognized message type');
      }
    };

    port.addEventListener('message', onMessage);
    port.start();

    port.addEventListener('error', function(err) {
      console.log('error', err);
    });
  },
  fetchThen: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.fetch({
        success: function() {
          var args = [].slice.call(arguments);
          resolve(args);
        },
        error: function() {
          var args = [].slice.call(arguments);
          resolve(args); // or reject()
        }
      });
    });
  }
});

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
