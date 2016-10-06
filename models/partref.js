var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;

var schema = new Schema({
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

}, {timestamps: true});

module.exports = PartRef = mongoose.model('PartRef', schema);
