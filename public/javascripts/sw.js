importScripts(
  '/components/underscore/underscore-min.js',
  '/components/backbone/backbone-min.js'
);

var collections = {};

var JobModel = Backbone.Model.extend({
  idAttribute: '_id'
});

var JobCollection = Backbone.Collection.extend({
  url: '/api/jobs',
  model: JobModel,
  name: 'jobs',
  initialize: function() {
    this.ports = {};
    this.on('all', this.catchall);
  },
  addPort: function(client, port) {
    var messageHandler = function(e) {
      console.log('message', e);
    };
    port.addEventListener('message', messageHandler);
    this.ports[client] = port;
  },
  catchall: (eventName) => {
    var args = [].slice.call(arguments, 1);
    self.clients.matchAll((clients) => {
      console.log(clients);
      this.ports.forEach(function(port) {
        port.postMessage({
          type: 'update',
          on: this.name,
          'event': {
            type: eventName,
            args: args
          }
        });
      });
    });
  }
});

var collectionMap = {
  'jobs': JobCollection
};

self.addEventListener('install', function(e) {
  console.log('installing...');
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(e) {
  console.log('activating...');

  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
  console.log('fetch');
});

self.addEventListener('message', function(e) {
  var data = e.data;
  try {
    switch(data.type) {
      case 'init':
        if(data.collection == null) throw new Error('collection required');
        if(collections[data.collection] instanceof Backbone.Collection) throw new Error('collection already initialized');
        if(!(data.collection in collectionMap)) throw new Error('unrecognized collection "'+data.collection+'"');

        var Collection = collectionMap[data.collection];
        var collection = new Collection();
        var port = e.ports[0];
        if(port == null) throw new Error('need to pass port');
        collection.addPort(e.clientId, port);
        collections[data.collection] = collection;

        port.postMessage({
          'status': 'success',
          result: '"'+data.collection+'" initialized',
          type: 'init'
        });
        break;
      default:
        throw new Error('unrecognized message type "'+data.type+'"');
    }
  } catch (err) {
    (e.ports[0] || e.source).postMessage({
      'status': 'error',
      error: err.message
    });
  }
});
