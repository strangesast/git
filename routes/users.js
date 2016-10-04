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

router.get('/', function(req, res, next) {
  // if not logged in redirect to login
  if(!req.user) {
    return res.redirect(path.join(req.originalUrl, '/login'));
  }
  // display current user's information, list jobs, etc
  return res.render('pages/user/index', {user: req.user});
});

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

router.get('/:id', function(req, res, next) {
  // list user with id, redirect to /user if logged in as that user
  var id = req.params.id;
  if(ObjectId.isValid(id)) {
    // is it an id? redirect to username
    if(req.user && req.user._id === id) return res.redirect('/app/user');
    return Account.findById(id).then(function(doc) {
      if(doc == null) {
        res.status(404);
        return res.render('error', {
          error: new Error('not found')
        });
      }
      return res.redirect('/app/user/' + encodeURIComponent(doc.username));

    }).catch(function(err) {
      return next(err);
    });
  } else {
    // assume it's a username
    return Account.findOne({username: id}).then(function(doc) {
      if(doc == null) {
        res.status(404);
        return res.render('error', {error: new Error('not found')});
      }
      if(req.user && req.user.username === doc.username) {
        return res.redirect('/app/user');
      }
      return res.render('pages/user/each', {user: doc});

    }).catch(function(err) {
      return next(err);

    });
  }
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
