var express = require('express');
var util = require('util');
var path = require('path');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var mysql = require('mysql');

var router = express.Router();
mongoose.Promise = global.Promise;

var iface = require('../resources/interface');

var Job = require('../models/job');
var Phase = require('../models/phase');
var Building = require('../models/building');
var Component = require('../models/component');
var PartRef = require('../models/partref');

var nameToModel = function(name) {
  var Model;
  switch(name) {
    case 'jobs':
    case 'job':
      Model = Job;
      break;
    case 'phases':
    case 'phase':
      Model = Phase;
      break;
    case 'buildings':
    case 'building':
      Model = Building;
      break;
    case 'components':
    case 'component':
      Model = Component;
      break;
    default:
      throw new Error('unknown name "'+name+'"');
  }
  return Model;
}

var defaultReturn = function(fn, ctx) {
  return function(result) {
    return fn.call(ctx, result);
  };
};

var connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'russell',
  database: 'core_development'
});

connection.connect(function(err) {
  if(err) throw err;
  console.log('Connected to mysql db');
});

var props = ['version_id', 'number', 'description', 'summary', 'type', 'price', 'list_price'];

router.get('/catalog/:version_id?', function(req, res, next) {
  var qstring;
  var qarr = [];
  var single = false;
  if(req.params.version_id) {
    qstring = 'SELECT ' + props.join(', ') + ' FROM core_development.part_catalogs where version_id = ?';
    qarr = [req.params.version_id];
    single = true;
  } else {
    qstring = 'SELECT ' + props.join(', ') + ' FROM core_development.part_catalogs where purchaseable=1 && active=1' + (req.query.q ? ' && description like ? ' : ' ') + 'limit 10';
    qarr = [req.query.q];
  }
  connection.query(qstring, qarr, function(err, rows, fields) {
    if(err) next(err);
    res.json(!single ? rows : rows.length ? rows[0] : null);
  });
});

router.get('/', function(req, res, next) {
  var rs = mongoose.connection.readyState;
  return res.json({
    message:
      rs == 0 ? 'disconnected' :
      rs == 1 ? 'connected' :
      rs == 2 ? 'connecting' :
      rs == 3 ? 'disconnecting' : 
      'unknown',
    code: rs
  });
});

router.route('/:name/:id?')
.all(function(req, res, next) {
  var name = req.params.name;
  var Model = nameToModel(name);
  req.Model = Model;
  next();
})
.get(function(req, res, next) {
  var id = req.params.id;
  var request;
  if(id != null) {
    request = req.Model.findById(id);
  } else {
    request = req.Model.find({});
  }
  return request.then(defaultReturn(res.json, res)).catch(defaultReturn(next));
})
.all(function(req, res, next) {
  if(!req.user) {
    return next({status: 401, message: 'unauthorized'});
  }
  return next();
})
.post(function(req, res, next) {
  var id = req.params.id;
  var body = req.body;
  var Model = req.Model;
  if('owner' in Model.schema.paths) { // temporary
    body.owner = req.user ? req.user._id : '57f3df8841f7dc76f4a2af4b';
  }
  if(id != null || ('_id' in body)) { // temporary
    body['_id'] = id;
    return Model.findByIdAndUpdate(body['_id'], {'$set': body}).then(function(result) {
      if(req.get('Content-Type') === 'application/x-www-form-urlencoded') { // temporary
        if(Model.modelName == 'Job') {
          return res.redirect(path.join('/app/build/', id));
        }
      }
      res.json(result);
    });
  }
  var model = new Model(body);
  model.save().then(function(doc) {
    if(req.get('Content-Type') === 'application/x-www-form-urlencoded') { // temporary
      return res.redirect('/app/build/');
    }
    return res.json(doc);

  }).catch(function(err) {
    switch (err.name) {
      case 'ValidationError':
      default:
        if(err.errors) 
        var message = err.message;
        if(err.errors) message += ' (' + Object.keys(err.errors).map((n)=>err.errors[n].message).join(', ') + ')';
        return next({status: 400, message: message, error: err});
    }
  });
})
.put(function(req, res, next) {
  var id = req.params.id;
  if(id == null) throw new Error('id required for this method');
  var Model = req.Model;
  var model = Model.findById(id);
  Model.findOneAndUpdate({_id:id}, req.body).then(function(result) {
    res.json(result);
  }).catch(defaultReturn(next));
})
.delete(function(req, res, next) {
  var id = req.params.id;
  var Model = req.Model;
  var request;
  if(id == null) {
    request = Model.remove({});
  } else {
    request = Model.findByIdAndRemove(id);
  }

  return request.then(defaultReturn(res.json, res)).catch(defaultReturn(next));
});

router.get('/components/:id/parts', function(req, res, next) {
  var id = req.params.id;
  if(!ObjectId.isValid(id)) return next();
  Component.findById(id).populate('parts').then(function(component) {
    res.json(component.parts);
  });
});

router.post('/components/:id/parts', function(req, res, next) {
  var id = req.params.id;
  var body = req.body;
  if(!ObjectId.isValid(id)) return next();
  Component.findById(id).then(function(component) {
    if(component == null) return next({status: 404, error: new Error('not found')});

    var partref = new PartRef(body);
    return partref.save().then(function(doc) {
      return Component.findByIdAndUpdate(component._id, {$push: {'parts': doc._id}}).then(function(result) {
        if(req.get('Content-Type') === 'application/x-www-form-urlencoded') { // temporary
          return res.redirect(path.join('/app/build/', String(component.job), '#' + component._id + '-parts'));
        }
        res.json(result);
      });
    });
  }).catch(function(err) {
    next(err);
  });
});

router.delete('/components/:id/parts', function(req, res, next) {
  var id = req.params.id;
  var body = req.body;
  if(!ObjectId.isValid(id)) return next();
  Component.findById(id).then(function(component) {
    if(component == null) return next({status: 404, error: new Error('not found')});
    return PartRef.remove({'_id' : { '$in': component.parts }}).then(function(result) {
      res.json(result);

    });
  }).catch(function(err) {
    next(err);
  });
});


router.route('/:name1/:id1/:name2')
.all(function(req, res, next) {
  if(req.params.name1 !== 'jobs') return next('route'); // eventually, not yet support this
  var Model1 = nameToModel(req.params.name1);
  var id1 = req.params.id1;
  Model1.findById(id1).then(function(doc) {
    if(doc == null) return next({status: 404, error: new Error('not found')});
    req.parentDoc = doc;
    if(req.params.name2 == 'tree') {
      return iface.buildTree(doc._id).then(function(tree) {
        return res.json(tree);
      });
    } else {
      var Model2 = nameToModel(req.params.name2);
      req.Model = Model2;
      next();
    }
  }).catch(function(err) {
    next(err);
  });
})
.get(function(req, res, next) {
  var par = req.parentDoc;
  var Model = req.Model;

  Model.find({job: par._id}).then(function(docs) {
    res.json(docs);
  });
})
.post(function(req, res, next) {
  var body = req.body;
  var par = req.parentDoc;
  var Model = req.Model;

  body.job = par._id;

  var model = new Model(body);
  model.save().then(function(doc) {
    if(req.get('Content-Type') === 'application/x-www-form-urlencoded') { // temporary
      return res.redirect(path.join('/app/build/', String(par._id), '#' + model._id));
    }
    res.json(doc);

  }).catch(function(err) {
    next(err);
  });
});

module.exports = router;
