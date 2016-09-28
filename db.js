var mongoose = require('mongoose');
var config = require('./config');

mongoose.connect(config.MONGO_URL)

var db = mongoose.connection;

db.on('error', function(err) {
  console.error('mongo error:', err);
});

db.once('open', function() {
  console.log('mongo connection to ', config.MONGO_URL);
});

module.exports = db;
