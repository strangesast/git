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

var re = /^[\w\.\:]*\/\/[\w\.\:]+\/(.*)/; // http origin

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
    console.log(pathUrl);
    console.log('no match');
    return;
  }

  var obj = paths[match];
  var initiator = e.clientId;

  var i;
  if(e.request.method.toLowerCase() == 'get') {
    if(obj.waitingFor && (i=obj.waitingFor.indexOf(e.clientId)) > -1) {
      obj.waitingFor.splice(i, 1);
      var r = obj.response.clone();
      if(obj.waitingFor.length === 0) 
        obj.response = null;
      e.respondWith(r);
    }
  }

});

var onMessage = function(e) {
  if(typeof e.data !== 'object') throw new Error('invalid data type');
  var message = e.data;
  var data = message.data;
  if(message.type == 'sync') {
    if(!('on' in data)) throw new Error('collection not specified');
    var obj = paths[collectionPaths[data.on]];
    if(e.target.clientId == null) throw new Error('clientid missing (wrong port)');
    var vals = data.values;

    // create response based on changes
    obj.response = new Response(JSON.stringify(vals));
    obj.waitingFor = [];

    self.clients.matchAll().then(function(clients) {
      var clientIds = clients.map((c)=>c.id);
      Object.keys(obj.clients).forEach((id, i) => {
        // check for client disconnect (no other event)
        if(clientIds.indexOf(id) === -1) {
          delete obj.clients[id];

        // only 'other' clients
        } else if(id !== e.target.clientId) {
          // tell client to pull changes
          obj.waitingFor.push(id);
          obj.clients[id].postMessage({
            type: 'sync',
            data: {
              on: data.on
            }
          });
        }
      });
    });
  } else {
    throw new Error('unexpected message type');
  }
};

// register client to collection, save port etc
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
    port.postMessage({
      type: 'setup',
      data: {
        'status': 'complete'
      }
    });
    port.clientId = clientId;
    port.addEventListener('message', onMessage);
    port.start();
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
