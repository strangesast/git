var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;

var partRef = new Schema({
  name: {
    type: String,
    default: 'New Part',
    required: true
  },
  qty: {
    type: Number,
    default: 1
  },
  price: {
    type: Number, // sell
    default: 0.00
  },
  description: String,
  part: String // version id of core part

});


var schema = new Schema({
  name: {
    type: String,
    required: true
  },
  job: {
    type: ObjectId,
    required: true,
    ref: 'Job'
  },
  phase: {
    type: ObjectId,
    default: null,
    ref: 'Phase'
  },
  building: {
    type: ObjectId,
    default: null,
    ref: 'Building'
  },
  'parent': {
    type: ObjectId,
    default: null,
    ref: 'Component'
  },
  parts: [partRef],
  description: String

}, {timestamps: true});

schema.pre('validate', function(next) {
  if(!this['parent']) this['parent'] = null; // post likes empty string

  next();
});

//schema.virtual('part').set(function(part) {
//  var model = new PartRef({part: part});
//  model.save();
//  this.parts.push(model._id);
//  console.log(this);
//});

module.exports = Component = mongoose.model('Component', schema);
