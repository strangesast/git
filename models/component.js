var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;
var PartRef = require('./partref');

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
  parts: [{
    type: ObjectId,
    ref: 'PartRef'
  }],
  description: String

}, {timestamps: true});

schema.pre('validate', function(next) {
  if(!this['parent']) this['parent'] = null; // post likes empty string

  next();
});

schema.virtual('part').set(function(part) {
  var model = new PartRef({part: part});
  model.save();
  this.parts.push(model._id);
  console.log(this);
});

module.exports = Component = mongoose.model('Component', schema);
