var express = require('express');
var path = require('path');
var router = express.Router();
var fs = require('fs');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;


var users = require('./users');
var build = require('./build');

var iface = require('../resources/interface');

const PAGES_PATH = 'views/pages';
const VALID_PAGES = fs.readdirSync(PAGES_PATH).filter((file) => {
  return fs.statSync(path.join(PAGES_PATH, file)).isDirectory();
});

// for worker /app/ scope
const WORKER_FILENAME = 'sw.js';
router.get('/' + WORKER_FILENAME, function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public/javascripts/', WORKER_FILENAME));
});

// temporary
router.get('/', function(req, res, next) {
  //res.redirect(req.originalUrl + 'build/jobs');
  var types = [ 
    'phase',
    'building',
    'component'
  ];
  var recentPromise = Promise.all(types.map((m)=>iface.nameToModel(m).find({}).sort({ updatedAt: 1 }).limit(10).populate('job'))).then(function(arr) {
    return arr.map(function(models, i) {
      return models.map((el)=>{
        el.type = types[i];
        return el;
      });
    }).reduce((a, b)=>a.concat(b)).sort(function(a, b) {
      return a.updatedAt > b.updatedAt ? -1 : 1;
    }).slice(0, 10);
  });
  var userPromise = iface.Account.find({});
  Promise.all([iface.Job.find({}).populate('owner'), recentPromise, userPromise]).then(function(arr) {
    var docs = arr[0];
    var recent = arr[1];
    var users = arr[2];
    res.render('pages/index/index', {jobs: docs, recent: recent, users: users});
    
  }).catch(function(err) {
    next(err);
  });
});

router.use('/user', users); // offload login stuff

router.use('/build', build); // offload build stuff

router.get('/edit/:name/:id', function(req, res, next) {
  if(!ObjectId.isValid(req.params.id)) next();
  var Model = iface.nameToModel(req.params.name);
  var stream = Model.findById(req.params.id).populate('job')

  switch(Model.modelName) {
    case 'Component':
      stream = stream.populate('parts').populate('phase').populate('building');
      break;
    case 'Phase':
      strem = stream.populate('parent');
  }
  var partPromise = iface.sqlQuery('SELECT * FROM core_development.part_catalogs where purchaseable=1 && active=1 limit 1000').then(function(arr) {
    return arr;
  });

  var requiredObjects = function(name, doc) {
    var prom = Promise.resolve({});
    switch(name) {
      case 'Phase':
        prom = Promise.all([
          iface.Phase.find({job: doc.job})
        ]).then(function(arr) {
          return {
            'phases': arr[0]
          };
        });
      default:
    }
    return prom;
  };

  var allObjects = function() {
    var q = {};
    return Promise.all(['job', 'phase', 'building', 'component'].map(function(name) {
      var cap = name[0].toUpperCase() + name.slice(1);
      return iface[cap].find(q).then(function(result) {
        return [name + 's', result];
      });
    })).then(function(arr) {
      var ob = {};
      for(var i=0; i<arr.length; i++) {
        ob[arr[i][0]] = arr[i][1];
      }
      return ob;
    });
  }

  stream.then(function(doc) {
    if(doc == null) return next({status: 404, error: new Error('not found')});

    return Promise.all([partPromise, requiredObjects(Model.modelName, doc), allObjects()]).then(function(all) {
      var parts = all[0];
      var objects = all[1];
      var all = all[2];

      var ret = {};
      ret.doc = doc;
      ret.parts = parts;
      for(var prop in all) {
        ret[prop] = all[prop];
      }
      res.render(path.join('pages/edit/', Model.modelName.toLowerCase()), ret);
    });

  }).catch(function(err) {
    return next(err);
  });
});

//router.get('/:pageName$', function(req, res, next) {
//  if(VALID_PAGES.indexOf(req.params.pageName) === -1) return next();
//  res.redirect(req.originalUrl + '/');
//});

//router.get('/:pageName/*', function(req, res, next) {
//  console.log(req.param.pageName);
//  var pageName = req.params.pageName || 'index';
//  console.log(pageName);
//  if(VALID_PAGES.indexOf(pageName) === -1) return next();
//  if(!req.accepts('html')) {
//    return next();
//  }
//
//  iface.getData().then(function(data) {
//    return res.render('pages/'+pageName+'/page', {data : data});
//  });
//});
//
//router.get('/:pageName?/', function(req, res, next) {
//  var pageName = req.params.pageName || 'index';
//  if(VALID_PAGES.indexOf(pageName) === -1) return next();
//  if(!req.accepts('json')) {
//    return next();
//  }
//  res.setHeader('Content-Type', 'application/json');
//  return res.render('pages/'+pageName+'/template', function(err, html) {
//    if(err) return next(err);
//    return res.json({template: html});
//  });
//});

module.exports = router;
