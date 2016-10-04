var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;

var schema = new Schema({
  name: {
    type: String,
    required: true
  },
  job: {
    type: ObjectId,
    ref: 'Job'
  },
  'parent': {
    type: ObjectId,
    ref: 'Phase'
  },
  description: String

}, {timestamps: true});

schema.pre('validate', function(next) {
  if(!this['parent']) this['parent'] = null; // post likes empty string

  next();
});

module.exports = Phase = mongoose.model('Phase', schema);
