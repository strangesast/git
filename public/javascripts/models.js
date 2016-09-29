// base models
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
          name: self.name
        }
      }, [thatPort]);
    });
  },
  syncFrom: function(clientId, thisPort) {
    // passed port when setup command is received for this collection
    if(this.name == null) throw new Error('collection must have name for pairing');
    var self = this;
    this.listeners = this.listeners || {}; // currently listening ports. (at least) one for each page

    var sendMessage = function(port, data) {
      port.postMessage({
        type: 'sync',
        by: clientId,
        data: JSON.parse(JSON.stringify(data))
      });
    };

    if(!this.syncinit) {
      // local to remote sync
      var addEvent = function(model, collection, options) {
        if(!(collection instanceof Collection)) throw new Error('not a collection');
        self.toListeners(function(port) {
          sendMessage(port, {
            on: self.name,
            'event': 'add',
            collection: collection.toJSON(),
            options: options // contains 'index' in collection which may be required on delete
          });
        });
      };
      var removeEvent = function(model, collection, options) {
        if(!(collection instanceof Collection)) throw new Error('not a collection');
        self.toListeners(function(port) {
          sendMessage(port, {
            on: self.name,
            'event': 'remove',
            collection: collection.toJSON(),
            options: options // contains 'index' in collection which may be required on delete
          });
        });
      };
      var changeEvent = function(model, options) {
        if(!(model instanceof Model)) throw new Error('not a model');
        self.toListeners(function(port) {
          sendMessage(port, {
            on: self.name,
            'event': 'change',
            collection: model.collection.toJSON(),
            options: options // contains 'index' in collection which may be required on delete
          });
        });
      };
      var resetEvent = function(collection, options) {
        if(!(collection instanceof Collection)) throw new Error('not a collection');
        self.toListeners(function(port) {
          sendMessage(port, {
            on: self.name,
            'event': 'reset',
            collection: collection.toJSON(),
            options: options // contains 'index' in collection which may be required on delete
          });
        });
      };

      self.on('add', addEvent);
      self.on('remove', removeEvent);
      self.on('change', changeEvent);
      self.on('reset', resetEvent);
      self.syncinit = true;
    }

    // remote to local sync
    var messageEventListener = function(id, port) {
      return function(e) {
        if(typeof e.data !== 'object') throw new Error('invalid data type');
        var message = e.data;
        var data = message.data;
        switch(message.type) {
          case 'sync':
            if(data.on !== self.name) throw new Error('collection mismatch');
            var eventName = data.type;
            if(e.target == port) {
              console.log('toast!');
              return;
            }
            self.reset(data.collection);
            break;
          case 'setup':
            break;
          default:
            throw new Error('unrecognized message type');
        }
        // response handler
      };
    };

    // cleanup
    (function(id, port) {
      var func = messageEventListener(id, port);
      port.addEventListener('message', func);
      port.start();
      self.addListener(id, port)
      port.addEventListener('close', () => {
        console.log('closing...');
        self.removeListener(id, port);
        //self.off('add', addEvent);
        //self.off('remove', removeEvent);
        //self.off('change', changeEvent);
        port.removeEventListener('message', func);
      });
      port.addEventListener('error', function(err) {
        console.log('error', err);
      });
    })(clientId, thisPort);
    
    // send init response
    thisPort.postMessage({
      type: 'setup',
      data: {
        'status': 'complete'
      }
    });
  },
  // client id, message port
  addListener: function(id, port) {
    this.listeners = this.listeners || {};
    if(!this.listeners.hasOwnProperty(id)) {
      this.listeners[id] = [];
    }
    if(this.listeners[id].indexOf(port) !== -1)
      throw new Error('already listening on that port/client');

    this.listeners[id].push(port);
  },
  removeListener: function(id, port) {
    if(!this.listeners.hasOwnProperty(id))
      throw new Error('client with that id does not exist');

    var index;
    if((index=this.listeners[id].indexOf(port)) === -1)
      throw new Error('not listening on that port');
    this.listeners[id].splice(index, 1);
  },
  toListeners: function(fn) {
    this.listeners = this.listeners || {};
    Object.keys(this.listeners).map((clientid) => {
      this.listeners[clientid].forEach(fn);
    });
  },
  // irritating
  updateListeners: function(clients) {
    // remove listeners not in 'clients' array
    for(var id in clients) {
      if(!this.listeners.hasOwnProperty(id)) {
        this.listeners.forEach((port) => {
          port.close();
        });
        delete this.listeners[id];
      }
    }
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
