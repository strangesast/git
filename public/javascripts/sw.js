const CACHE_NAME = 'test-cache';

self.addEventListener('install', function(e) {
  console.log('installing...');
  e.waitUntil(caches.open(CACHE_NAME).then(function() {
    console.log('done!');
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function(e) {
  console.log('activating...');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(e) {
  console.log('fetch');
});

self.addEventListener('message', function(e) {
  console.log('message');
});
