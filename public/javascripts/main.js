if('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', function(e1) {
    console.log('controller change');
    navigator.serviceWorker.controller.addEventListener('statechange', function(e2) {
      if(this.state == 'activated') {
        console.log('worker is ready');
      }
    });
  });

  navigator.serviceWorker.register('/app/sw.js').then(function(registration) {

    console.log(registration.active ? 'active' : registration.installing ? 'installing' : 'inactive');

    navigator.serviceWorker.ready.then(function(registration) {

      navigator.serviceWorker.addEventListener('message', function(e) {
        console.log('message from worker!');
        console.log(e.data);
      });

      console.log('sending message');
      registration.active.postMessage({
        message: 'toast!'
      });
    });
  });
}

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
