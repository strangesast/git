var util = require('util');
var express = require('express');
var path = require('path');
var passport = require('passport');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var multer = require('multer');

var Account = require('../models/account');
var upload = multer();
var router = express.Router();

var iface = require('../resources/interface');

router.get('/register', function(req, res, next) {
  if(req.user) return res.redirect('/app/user');
  return res.redirect('/app/user/login');
});

router.post('/register', upload.array(), function(req, res, next) {
  if(req.user) return res.redirect('/app/user');
  return Account.register(new Account({
    username: req.body.username,
    name: req.body.name
  }), req.body.password, function(err, account) {
    if (err) {
      switch (err.name) {
        case 'ValidationError':
        case 'MissingPasswordError':
        case 'UserExistsError':
          var message = err.message;
          if(err.errors) message += ' (' + Object.keys(err.errors).map((n)=>err.errors[n].message).join(', ') + ')';
          return res.redirect(util.format('/app/user/login?error=%s&message=%s', err.name, message));

        default:
          return res.json(err);
          //res.redirect('/app/user/login');
      }
    }
    return passport.authenticate('local')(req, res, function() {
      return res.redirect('/app/user');
    });
  });
});

router.get('/login', function(req, res, next) {
  if(req.user) return res.redirect('/app/user');
  var data = {};
  if('error' in req.query) {
    data.error = req.query;
  }
  res.render('pages/user/login', data);
});

router.post('/login', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) { return next(err); }
    if (!user) {
      if(!info) return res.redirect('/app/user/login');
      switch (info.name) {
        case 'IncorrectUsernameError':
          return res.redirect(util.format('/app/user/login?error=%s&message=%s', info.name, info.message));
        default:
          return res.redirect('/app/user/login');
      }
    }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.redirect('/users/' + user.username);
    });
  })(req, res, next);
});

router.get('/logout', function(req, res, next) {
  req.logout();
  return res.redirect('/app/');
});

router.get('/', function(req, res, next) {
  // if not logged in redirect to login
  if(!req.user) {
    return res.redirect(path.join(req.originalUrl, '/login'));
  }
  // display current user's information, list jobs, etc
  Job.find({owner: req.user._id}).then(function(jobs) {
    res.render('pages/user/index', {user: req.user, jobs: jobs});

  }).catch(function(err) {
    next(err);
  });
});

router.get('/:id', function(req, res, next) {
  // list user with id, redirect to /user if logged in as that user
  var id = req.params.id;
  if(ObjectId.isValid(id)) {
    // is it an id? redirect to username
    if(req.user && req.user._id === id) return res.redirect('/app/user');
    return Account.findById(id).then(function(doc) {
      if(doc == null) return next({status: 404, error: new Error('not found')});

      res.redirect('/app/user/' + encodeURIComponent(doc.username));

    }).catch(function(err) {
      next(err);

    });
  } else {
    // assume it's a username
    return Account.findOne({username: id}).then(function(user) {
      if(user == null) return next({status: 404, error: new Error('not found')});
      if(req.user && req.user.username === user.username) return res.redirect('/app/user');

      return Job.find({owner: user._id}).then(function(jobs) {
        res.render('pages/user/each', {user: user, jobs: jobs});
      });

    }).catch(function(err) {
      next(err);

    });
  }
});

router.get('/:id/jobs', function(req, res, next) {
  if(!ObjectId.isValid(req.params.id)) return next();
  iface.Account.findById(req.params.id).then(function(doc) {
    if(doc == null) return next({status: 404, error: new Error('not found')});
    res.redirect(path.join('/app/user/', doc.username, '/jobs'));
  }).catch(function(err) {
    next(err);
  });
});

router.get('/:username/jobs', function(req, res, next) {
  iface.Account.findOne({username: req.params.username}).then(function(user) {
    if(user == null) return next({status: 404, error: new Error('not found')});
    iface.Job.find({owner: user._id}).then(function(docs) {
      res.render('pages/user/jobs', {jobs: docs, user: user});
    });
  });
});

// temporary, remove all accounts
router.delete('/', function(req, res, next) {
  //if(!req.user) {
  //  res.status(401);
  //  return res.render('error', {error: new Error('not authenticated')});
  //}
  return Account.remove({}).then(function(result) {
    return res.json(result);
  }).catch(function(err) {
    return next(err);
  });
});

router.delete('/:id', function(req, res, next) {
  //if(!req.user) {
  //  res.status(401);
  //  return res.render('error', {error: new Error('not authenticated')});
  //}
  Account.findByIdAndRemove(req.params.id).then(function(result) {
    return res.json(result);
  }).catch(function(err) {
    return next(err);
  });
});


module.exports = router;
