var Router = Backbone.Router.extend({
  initialize: function(params, options) {
    Backbone.history.start({pushState: true});
    var path = Backbone.history.getFragment();

    console.log('init', path);
  },
  routes: {
    'app/': 'index'
  },
  index: function() {
    console.log('index');
  }
});

var router = new Router();

var initFakeCollection = function(ob) {
  var channel = new MessageChannel();
  ob._port = channel.port1;
  ob._port.onmessage = function(e) {
    var data = e.data;
    console.log('message', data);
    if(data.type == 'init') {
    }
  };
  return channel.port2;
};

var jobs = _.clone(Backbone.Events);
jobs.setup = function(worker) {
  var channel = new MessageChannel();
  var port = channel.port1;
  this._port = port;
  return new Promise(function(resolve, reject) {
    var messageHandler = function(e) {
      worker.removeEventListener('message', messageHandler);
      var data = e.data;
      console.log(data);
      if(data.type == 'init') {
        return resolve();
      } else if (data['status'] == 'error') {
        return reject(data.error);
      } else {
        throw new Error('unexpected message "'+data.type+'"');
      }
    };
    port.addEventListener('message', messageHandler);
    port.start();
    worker.postMessage({
      type: 'init',
      collection: 'jobs'
    }, [channel.port2]);
  });
};

if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/app/sw.js').then(function(registration) {

    navigator.serviceWorker.addEventListener('controllerchange', function(e1) {
      console.log('controller change');
      navigator.serviceWorker.controller.addEventListener('statechange', function(e2) {
        if(this.state == 'activated') {
          // new code loaded, need to reset
          console.log('worker is installed');
        }
      });
    });


    if(registration.active) {
      console.log('worker is already installed');
    }

    // active if already installed, activated

    navigator.serviceWorker.ready.then(function(registration) {
      console.log('ready');

      navigator.serviceWorker.addEventListener('message', function(e) {
        var data = e.data;
        console.log('message from worker!', data);
      });

      jobs.setup(navigator.serviceWorker.controller).then(function() {
        console.log(jobs);
      });

    });
  });
} else {
  // tbd
}
