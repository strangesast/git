importScripts(
  '/components/underscore/underscore-min.js',
  '/components/backbone/backbone-min.js',
  '/javascripts/models.js'
);

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
var collectionPaths = {}; // collections to paths

var re = /^[\w\.\:]*\/\/[\w\.\:]+\/(.*)/;

self.addEventListener('fetch', function(e) {
  var fullUrl = e.request.url;
  var pathUrl = re.exec(fullUrl)[1];
  var pathsArray = Object.keys(paths)
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
    var port = obj.clients[initiator];

    if(port) {
      port.postMessage({
        type: 'pull',
        data: {
          on: collectionName,
          type: e.request.method,
          url: pathUrl
        }
      });
    }

    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        return resolve(response);
      }, 100);
    });

  }));
});

var onMessage = function(initiator) {
  return function(e) {
    if(typeof e.data !== 'object') throw new Error('invalid data type');
    var message = e.data;
    var data = message.data;
    if(!data.hasOwnProperty('on')) throw new Error('collection name must be specified');
    var collectionName = data.on;

    // temporarily cache data.values
    var values = data.values;
    console.log(values);

    var obj = paths[collectionPaths[collectionName]];

    return self.clients.matchAll().then(function(clients) {
      var listeners = Object.keys(obj.clients);
      var clientIds = clients.map((client)=>client.id);

      listeners.forEach(function(id, i, arr) {
        if(clientIds.indexOf(id) === -1) {
          delete obj.clients[id];

        } else if (id !== initiator) {
          var port = obj.clients[id];
          port.postMessage({
            type: 'sync',
            data: {
              on: collectionName
            }
          });
        }
      });
    });
  };
};

var registerPath = function(clientId, port, path, name) {
  return new Promise(function(resolve, reject) {
    paths[path] = paths[path] || {};
    paths[path].clients = paths[path].clients || {};
    if(clientId in paths[path].clients) throw new Error('client already listening on path');
    paths[path].clients[clientId] = port;
    paths[path].collectionName = name;
    collectionPaths[name] = path;
    resolve();
  }).then(function() {
    port.onmessage = onMessage(clientId);
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
        message: JSON.parse(JSON.stringify(err))
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
