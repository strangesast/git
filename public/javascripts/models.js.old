// base models
var Model = Backbone.Model.extend({
  idAttribute: '_id',
  initialize: function() {
    this.repo = this.collection.repo;
  },
  saveHash: function() {
    var repo = this.repo || this.collection.repo;
    var text = JSON.stringify(this.toJSON());

    return this.repo.saveAsP('blob', text).then(function(hash) {
      return hash;
    });
  },
  loadHash: function(hash, type) {
    return this.repo.loadAsP(type || 'text', hash || this.hash);
  }
});

var Collection = Backbone.Collection.extend({
  initialize: function(attrs, options) {
    if(options.repo) this.repo = options.repo;
    if(this.repo && this.repo.createTree === undefined) git.initializeRepo(this.repo);
  },
  saveHash: function() {
    // save any collection-level properties. may not be used
  },
  saveTree: function() {
    // create tree based on model contents
    if(this.name == null) throw new Error('need name!');
    if(this.repo == null) throw new Error('repo undefined!');

    return Promise.all(this.map((model) => {
      return model.saveHash().then(function(hash) {
        return [model.get('_id'), hash];
      });
    })).then(function(arr) {
      var tree = {};
      arr.forEach(function(pair) {
        tree[pair[0]] = { mode: git.modes.file, hash: pair[1] }
      });
      return this.repo.saveAsP('tree', tree);
    });
  },
  // initiate synchronization with similar collection
  // attach message channel sync to collection in worker, frame, etc
  syncTo: function(worker) {
    var self = this;
    if(self.name == null) throw new Error('collection must have name for pairing');

    return new Promise(function(resolve, reject) {
      var channel = new MessageChannel();

      var onFirstMessage = function(e) {
        if(typeof e.data !== 'object') throw new Error('invalid data type');
        var message = e.data;
        if(message.type === 'setup') {
          if(!message.data['status'] || message.data['status'] !== 'complete') {
            return reject(message.data);
          }
          channel.port1.removeEventListener('message', onFirstMessage);
          return resolve(self.syncFrom('serviceworker', channel.port1));

        } else {
          return reject(new Error('unrecognized message type'));

        }
      };
      channel.port1.addEventListener('message', onFirstMessage);
      channel.port1.start(); // required when using 'addEventListener' >:(

      // send initial request
      worker.postMessage({
        type: 'setup',
        data: {
          type: 'collection',
          path: self.url.startsWith('/') ? self.url.slice(1) : self.url,
          name: self.name
        }
      }, [channel.port2]);
      // timeout
      setTimeout(function() {
        return reject(new Error('setup timeout reached'));
      }, 1000);
    });
  },
  syncFrom: function(clientId, port) {
    // passed port when setup command is received for this collection
    if(this.name == null) throw new Error('collection must have name for pairing');
    var self = this;

    var push = function() {
      clearTimeout(this.syncop);
      this.syncop = setTimeout(function() {
        var message = {
          type: 'sync',
          data: {
            on: self.name,
            values: self.toJSON()
          }
        };
        console.log('push!', message)
        port.postMessage(message);
      }, 100);
    }

    // for these events, send new collection state to other clients
    self.on('add', push);
    self.on('remove', push);
    self.on('change', push);

    // receive other clients' updates
    var onMessage = function(e) {
      if(typeof e.data !== 'object') throw new Error('invalid data type');
      var message = e.data;
      var data = message.data;
      if(message.type === 'sync') {
        if(data.on !== self.name) throw new Error('collection mismatch');

        self.off('add', push);
        self.off('remove', push);
        self.off('change', push);

        self.fetchThen().then(function() {
          // otherwise trigger syncs
          self.on('add', push);
          self.on('remove', push);
          self.on('change', push);
        });

      } else {
        throw new Error('unrecognized message type');
      }
    };

    port.addEventListener('message', onMessage);
    port.start();

    port.addEventListener('error', function(err) {
      console.log('error', err);
    });
  },
  fetchThen: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.fetch({
        success: function() {
          var args = [].slice.call(arguments);
          resolve(args);
        },
        error: function() {
          var args = [].slice.call(arguments);
          resolve(args); // or reject()
        }
      });
    });
  }
});

// should roughly mirror /models/
var JobModel = Model.extend({
  defaults: {
    rootPhase: null
  },
  initialize: function(attrs, options) {
    this.repo = this.collection.repo;
    this.folders = this.collection.folders;
  },
  validate: function(attrs, options) {
    if(attrs.name == null || attrs.name == '') return 'name required';
    this.folders = options.folders;
  },
  saveTree: function() {
    if(this.repo == null) throw new Error('repo undefined!');

    return this.saveHash().then((selfhash) => {
      return Promise.all([
        this.folders.phases,
        this.folders.buildings,
        this.folders.components
      ].map((col) => {
        return col.saveTree().then(function(hash) {
          return [col.name, hash];
        });
      })).then((pairs) => {
        var tree = {};
        tree[this.get('_id')] = { mode: git.modes.file, hash: selfhash };
        pairs.forEach(function(pair) {
          tree[pair[0]] = { mode: git.modes.tree, hash: pair[1] };
        });
        return this.repo.saveAsP('tree', tree);
      });
    }).then((treehash) => {
      this.repo.treeWalkP(treehash).then(function(arr) {
        console.log(arr);
      });
    });
  }
});
var JobCollection = Collection.extend({
  name: 'jobs',
  url: '/api/jobs',
  model: JobModel,
  initialize: function(models, options) {
    if(options.folders) this.folders = options.folders;
    console.log(this.folders);
    return Collection.prototype.initialize.apply(this, arguments);
  }
});

var PhaseModel = Model.extend({
  initialize: function(attrs, options) {

  }
});
var PhaseCollection = Collection.extend({
  name: 'phases',
  url: '/api/phases',
  model: PhaseModel
});
var BuildingModel = Model.extend({
  initialize: function(attrs, options) {

  }
});
var BuildingCollection = Collection.extend({
  name: 'buildings',
  url: '/api/buildings',
  model: BuildingModel
});
var ComponentModel = Model.extend({
  initialize: function(attrs, options) {

  }
});
var ComponentCollection = Collection.extend({
  name: 'components',
  url: '/api/components',
  model: ComponentModel
});
