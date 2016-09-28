var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;

var schema = new Schema({
  name: {
    type: String,
    required: true
  }
});

module.exports = Component = mongoose.model('Component', schema);
