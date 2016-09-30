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

self.addEventListener('install', function(e) {
  console.log('installing...');
  e.waitUntil(caches.open(CACHE_NAME).then(function() {
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
        clients.forEach((client) => {
          client.postMessage({type: 'ready'});

        });
      });
    });
  }));
});

var paths = {};

var re = /^[\w\.\:]*\/\/[\w\.\:]+\/(.*)/;

self.addEventListener('fetch', function(e) {
  var fullUrl = e.request.url;
  var pathUrl = re.exec(fullUrl)[1];
  var pathsArray = Object.keys(paths);
  var match;
  for(var i=0,path; path=pathsArray[i], i < pathsArray.length; i++) {
    if(!pathUrl.startsWith(path)) continue;
    match = path;
    break;
  }
  if(!match) {
    console.log('no match');
    return;
  }
  if(e.request.method.toLowerCase() === 'get') {
    return;
  }
  var collectionName = paths[match].collectionName;
  var initiator = e.clientId;
  var obj = paths[match];

  e.respondWith(fetch(e.request).then(function(response) {
    return self.clients.matchAll().then(function(clients) {
      var clientIds = clients.map((client)=>client.id);
      console.log(clientIds.length);

      var listeners = Object.keys(paths[match].clients);
      listeners.forEach(function(id, i, arr) {
        console.log(id == initiator);
        if(clientIds.indexOf(id) === -1) {
          delete obj.clients[id];

        } else if (id !== initiator) {
          var port = paths[match].clients[id];
          port.postMessage({
            type: 'sync',
            data: {
              on: collectionName,
              type: e.request.method,
              url: pathUrl
            }
          });
        }
      });
      return response;
    }).catch(function(err) {
      throw err;
    });
  }));
});

var registerPath = function(clientId, port, path, name) {
  return new Promise(function(resolve, reject) {
    paths[path] = paths[path] || {};
    paths[path].clients = paths[path].clients || {};
    if(clientId in paths[path].clients) throw new Error('client already listening on path');
    paths[path].clients[clientId] = port;
    paths[path].collectionName = name;
    resolve();
  }).then(function() {
    port.postMessage({
      type: 'setup',
      data: {
        'status': 'complete'
      }
    });
  }).catch(function(err) {
    port.postMessage({
      type: 'setup',
      data: {
        'status': 'error',
        message: err
      }
    });
  });
};

self.addEventListener('message', function(e) {
  if(typeof e.data !== 'object') throw new Error('invalid data type');
  var message = e.data;
  if(message.type == null) throw new Error('malformed message');
  var data = message.data;
  switch(message.type) {
    case 'setup':
      if(data.type !== 'collection') throw new Error('invalid message');
      if(!data.hasOwnProperty('name') || !data.hasOwnProperty('path'))
        throw new Error('name and path required');

      // port for later
      registerPath(e.source.id, e.ports[0], data.path, data.name);
      break;

    default:
      throw new Error('unrecognized message type');
  }
});
