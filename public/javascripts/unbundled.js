// callback to promise
var promisify = function(fn) {
  return function() {
    var args = [].slice.call(arguments);
    return new Promise(function(resolve, reject) {
      fn.apply(null, args.concat(function(err, result) {
        if(err) return reject(err);
        resolve(result);
      }));
    });
  };
};

// stream of reads (with callbacks) to array
var streamify = function(fn) {
  return function() {
    var args = [].slice.call(arguments);
    return promisify(fn).apply(null, args).then(function(stream) {
      return new Promise(function(resolve, reject) {
        function reader(s, arr) {
          s.read(function(err, result) {
            if(err) return reject(err);
            return result == null ? resolve(arr) : reader(s, arr.concat(result));
          });
        };
        reader(stream, []);
      });
    });
  };
};

var modes = require('js-git/lib/modes');

var initializeRepo = function(repo) {
  require('js-git/mixins/mem-db')(repo);
  
  // This adds a high-level API for creating multiple git objects by path.
  // - createTree(entries) => hash
  require('js-git/mixins/create-tree')(repo);
  
  //// This provides extra methods for dealing with packfile streams.
  //// It depends on
  //// - unpack(packStream, opts) => hashes
  //// - pack(hashes, opts) => packStream
  //require('js-git/mixins/pack-ops')(repo);
  
  // This adds in walker algorithms for quickly walking history or a tree.
  // - logWalk(ref|hash) => stream<commit>
  // - treeWalk(hash) => stream<object>
  require('js-git/mixins/walkers')(repo);
  
  //// This combines parallel requests for the same resource for effeciency under load.
  //require('js-git/mixins/read-combiner')(repo);
  
  // This makes the object interface less strict.  See it's docs for details
  require('js-git/mixins/formats')(repo);

  repo.createTreeP = promisify(repo.createTree.bind(repo));
  repo.saveAsP = promisify(repo.saveAs.bind(repo));
  repo.loadAsP = promisify(repo.loadAs.bind(repo));
  repo.updateRefP = promisify(repo.updateRef.bind(repo));
  repo.readRefP = promisify(repo.readRef.bind(repo));

  repo.treeWalkP = streamify(repo.treeWalk.bind(repo));
  repo.logWalkP = streamify(repo.logWalk.bind(repo));

  return repo;
};

module.exports = git = {
  initializeRepo: initializeRepo,
  modes: modes
}
