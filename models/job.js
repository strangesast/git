var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;
var Account = require('./account');

var shortNameRegex = /^[a-zA-Z0-9\-\_ ]{4,21}$/;

var schema = new Schema({
  name: {
    type: String,
    required: true
  },
  shortname: {
    type: String,
    validate: {
      validator: function(str) {
        return typeof str === 'string' && shortNameRegex.test(str);
      },
      message: 'short name must be a string of [4, 20] characters'
    },
    required: true,
    lowercase: true,
    unique: true // temporary.  just needs to be unique within userspace
  },
  owner: {
    type: ObjectId,
    ref: 'Account',
    required: true
  },
  description: String
}, {timestamps: true});

schema.pre('validate', function(next) {
  console.log(this.shortname == '' || this.shortname == null, this.name.slice(0, 20));
  if(this.name == null) return next(); // let validation handle this fail
  if(this.shortname == null || this.shortname == '') {
    this.shortname = this.name.slice(0, 20);
  }
  next();
});

module.exports = Job = mongoose.model('Job', schema);
