var express = require('express');
var router = express.Router();

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var Job = require('../models/job');
var Component = require('../models/component');
var Phase = require('../models/phase');
var Building = require('../models/building');

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
.post(function(req, res, next) {
  var id = req.params.id;
  var body = req.body;
  var Model = req.Model;
  var model = new Model(body);
  var request = model.save();

  // temporary
  if(req.get('Content-Type') === 'application/x-www-form-urlencoded') {
    return request.then((doc) => {
      res.redirect('/app/build/');
    }).catch(defaultReturn(next));
  }
  
  request.then(defaultReturn(res.json, res)).catch(defaultReturn(next));
})
.put(function(req, res, next) {
  var id = req.params.id;
  if(id == null) throw new Error('id required for this method');
  var Model = req.Model;
  var model = Model.findById(id);
  Model.findOneAndUpdate({_id:id}, req.body).then(defaultReturn(res.json, res)).catch(defaultReturn(next));
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

module.exports = router;
