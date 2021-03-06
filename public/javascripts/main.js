var collections = {};
var view;
var blacklisted = ['update', 'sort', 'destroy', 'request', 'sync', 'error', 'invalid', 'route'];

var repo = {};

var establish = function(collection) {
  if(collection.name == null) throw new Error('collection needs a name');
  var worker = navigator.serviceWorker.controller;
  if(!worker) throw new Error('worker not yet registered/activated');
  return collection.syncTo(worker);
}

var buildTree = function() {
  Promise.all(Object.keys(collections).map((name)=> {
    return collections[name].saveTree().then(function(hash) {
      return [name, hash];
    });
  })).then(function(hashNamePairs) {
    console.log(hashNamePairs);
  });
};

var setup = function() {
  collections.phases = collections.phases || new PhaseCollection(null, {repo: repo});
  collections.buildings = collections.buildings || new BuildingCollection(null, {repo: repo});
  collections.components = collections.components || new ComponentCollection(null, {repo: repo});

  collections.jobs = collections.jobs || new JobCollection(null, {repo: repo, folders: collections});


  return Object.keys(collections).reduce(function(a, b) {
    return a.then(function() {
      return establish(collections[b]);
    });
  }, Promise.resolve()).then(function() {
    if(view != null) view.remove();
    var workspace = document.querySelector('.workspace')
    view = new JobView({ el: workspace }, { collections: collections });
    collections.jobs.reset(INITIAL_DATA.jobs);
    collections.phases.reset(INITIAL_DATA.phases);
    collections.buildings.reset(INITIAL_DATA.buildings);
    collections.components.reset(INITIAL_DATA.components);

  });
};

if('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', function(e1) {
    console.log('controller change');
    navigator.serviceWorker.controller.addEventListener('statechange', function(e2) {
      if(this.state == 'activated') {
        // new code loaded, need to reset
        console.log('new worker is ready');
        setup();
      }
    });
  });

  navigator.serviceWorker.register('/app/sw.js').then(function(registration) {

    if(registration.active) {
      console.log('worker is already installed');
      setup();
    }

    // active if already installed, activated

    navigator.serviceWorker.ready.then(function(registration) {

      navigator.serviceWorker.addEventListener('message', function(e) {
        var data = e.data;
        console.log('message from worker!', data);
        try {
          if(typeof data !== 'object') throw new Error('malformed message from worker');
        } catch (err) {
          return console.error(err, data);
        }

        switch (data.type) {
          case 'init':
            if(INITIAL_DATA != null) {
              (e.ports[0] || e.source || navigator.serviceWorker.controller).postMessage({
                type: 'init',
                data: INITIAL_DATA
              });
            }
            break;
          case 'ready':
            console.log('ready from worker');
            break;
          default:
            return console.error('unrecognized message type');
        }
        
      });
    });
  });
} else {
  
  var jobs = new JobCollection();
  var phases = new PhaseCollection();
  var buildings = new BuildingCollection();
  var components = new ComponentCollection();
  
  var jobView = new JobView({
    el: document.querySelector('.workspace')
  }, {
    collections: {
      jobs: jobs,
      phases: phases,
      buildings: buildings,
      components: components
    }
  });
  
  jobs.reset(INITIAL_DATA.jobs);
  phases.reset(INITIAL_DATA.phases);
  buildings.reset(INITIAL_DATA.buildings);
  components.reset(INITIAL_DATA.components);
}
