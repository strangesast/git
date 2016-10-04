var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var passportLocalMongoose = require('passport-local-mongoose');

var Account = new Schema({
  name: {
    required: true,
    type: String
  },
  username: { //used for namespace.  no spaces allowed
    unique: true,
    required: true,
    type: String,
    validate: {
      validator: function(str) {
        return str.indexOf(' ') === -1 ? /^[A-Za-z0-9\-]{3,}$/.test(str) : false;
      },
      message: 'Username cannot contain spaces or non-alphanumerics and must be at least 3 characters'
    }

  },
  password: String
}, {timestamps: true});

Account.plugin(passportLocalMongoose);

module.exports = mongoose.model('Account', Account);
