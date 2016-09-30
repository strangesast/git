// base models
//Backbone.sync = function(method, model, options) {
//  console.log(method, model, options);
//};
var Model = Backbone.Model.extend({
  idAttribute: '_id'
});

var Collection = Backbone.Collection.extend({
  // initiate synchronization with similar collection
  // attach message channel sync to collection in worker, frame, etc
  syncTo: function(worker) {
    // should also override default sync function so it doesn't duplicate functionality
    var self = this;
    if(self.name == null) throw new Error('collection must have name for pairing');

    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        return reject(new Error('setup timeout reached'));
      }, 1000);

      var messageChannel = new MessageChannel();

      var thatPort = messageChannel.port2;
      var thisPort = messageChannel.port1;

      var onMessage = function(e) {
        if(typeof e.data !== 'object') throw new Error('invalid data type');
        var message = e.data;
        switch(message.type) {
          case 'setup':
            console.log('one');
            if(!message.data['status'] || message.data['status'] !== 'complete')
              throw new Error('unexpected response');
            thisPort.removeEventListener('message', onMessage);
            return resolve(self.syncFrom('serviceworker', thisPort));
            break;

          default:
            throw new Error('unrecognized message type');
        }
      };

      thisPort.addEventListener('message', onMessage);
      thisPort.start(); // required when using 'addEventListener' >:(

      // send initial request
      worker.postMessage({
        type: 'setup',
        data: {
          type: 'collection',
          path: self.url.startsWith('/') ? self.url.slice(1) : self.url,
          name: self.name
        }
      }, [thatPort]);
    });
  },
  syncFrom: function(clientId, port) {
    // passed port when setup command is received for this collection
    if(this.name == null) throw new Error('collection must have name for pairing');
    var self = this;

    var messageEventListener = function(e) {
      if(typeof e.data !== 'object') throw new Error('invalid data type');
      var message = e.data;
      var data = message.data;
      switch(message.type) {
        case 'sync':
          if(data.on !== self.name) throw new Error('collection mismatch');
          var method = data.type.toLowerCase();
          var selfurl = self.url.startsWith('/') ? self.url.slice(1) : self.url;
          var id = data.url.slice(selfurl.length+1);
          switch(method) {
            case 'delete':
              self.get(id).fetch();
              break;
            default:
              self.fetch();
          }
          break;
        case 'setup':
          break;
        default:
          throw new Error('unrecognized message type');
      }
      // response handler
    };

    port.addEventListener('message', messageEventListener);
    port.start();

    port.addEventListener('error', function(err) {
      console.log('error', err);
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

var PseudoCollection = Collection.extend({
  register: function(name, worker) {
    console.log(name, worker);
  }
});
