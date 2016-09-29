importScripts(
  '/components/underscore/underscore-min.js',
  '/components/backbone/backbone-min.js',
  '/javascripts/models.js'
);

Backbone.sync = function(method, model, options) {
  console.log('sync!');
};
const CACHE_NAME = 'test-cache';

var init = false;

var collections = {};

self.addEventListener('install', function(e) {
  console.log('installing...');
  e.waitUntil(caches.open(CACHE_NAME).then(function() {
    collections.jobs = new JobCollection();
    collections.phases = new PhaseCollection();
    collections.buildings = new BuildingCollection();
    collections.components = new ComponentCollection();
    console.log('done!');
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function(e) {
  console.log('activating...');

  e.waitUntil(self.clients.claim().then(function() {
    return self.clients.matchAll().then(function(clients) {
      if(init) return Promise.resolve();
      // respond to first client that responds with init (should only be one), or after timeout just fetch;
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          return resolve({type: 'timeout'});
        }, 1000);
        clients.forEach(function(client) {
          var channel = new MessageChannel();
          if(!init) {
            client.postMessage({type: 'init'}, [channel.port2]);
          }
          channel.port1.onmessage = function(e2) {
            if(e2.data.type === 'init') {
              return resolve(e2.data);
            }
          };
        });
      }).then(function(result) {
        console.log(result.type);
        if(!result || result.type == null) throw new Error('unexpected result');
        if(result.type == 'timeout') {
          return Promise.all(Object.keys(collections).map((name)=>collections[name].fetch()));

        } else if (result.type == 'init') {
          if(result.data == null) throw new Error('unexpected result');
          return Promise.all(Object.keys(result.data).filter((name) => {
            return collections[name] != null;

          }).map((name) => {
            return collections[name].reset(result.data[name]);

          }));
        }
        init = true;
        return;
      }).then(function() {
        clients.forEach((client) => {
          client.postMessage({type: 'ready'});

        });
      });
    });
  }));
});

self.addEventListener('fetch', function(e) {
  console.log('fetch');
});

self.addEventListener('message', function(e) {
  if(typeof e.data !== 'object') throw new Error('invalid data type');
  var message = e.data;
  if(message.type == null) throw new Error('malformed message');
  var data = message.data;
  switch(message.type) {
    case 'setup':
      if(data.type !== 'collection') throw new Error('invalid message');
      if(!collections.hasOwnProperty(data.name))
        throw new Error('invalid or nonexistant collection name "'+data.name+'"');
      var col = collections[data.name];
      col.syncFrom(e.source.id, e.ports[0]); 
      break;

    default:
      throw new Error('unrecognized message type');
  }
});
