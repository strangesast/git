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
  phase: {
    type: ObjectId,
    ref: 'Phase'
  },
  building: {
    type: ObjectId,
    ref: 'Building'
  },
  'parent': {
    type: ObjectId,
    ref: 'Component'
  },
  description: String

}, {timestamps: true});

schema.pre('validate', function(next) {
  if(!this['parent']) this['parent'] = null; // post likes empty string

  next();
});

module.exports = Component = mongoose.model('Component', schema);
