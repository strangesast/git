var parseForm = function(form) {
  var formdata = new FormData(form);
  var obj = {};
  for(var pair of formdata.entries()) {
    obj[pair[0]] = pair[1];
  }
  return obj;
};

var JobView = Backbone.View.extend({
  initialize: function(attrs, options) {
    options = options || {};
    this.collections = options.collections || {};
    _.map(this.collections, (col) => {
      this.listenTo(col, 'reset', this.colreset);
      this.listenTo(col, 'add', this.coladd);
      this.listenTo(col, 'remove', this.colremove);
    }, this);
  },
  colreset: function(collection) {
    var el = this.$('.' + collection.name + '-list');
    var template = this.$('#' + collection.name + '-template')[0];
    el.empty();
    collection.each((model) => {
      var modelEl = document.importNode(template.content, true).firstChild
      modelEl.setAttribute('id', collection.name + '-' + model.cid);
      model.binding = rivets.bind(modelEl, {model: model});
      el.append(modelEl);
    });
  },
  coladd: function(model) {
    var el = this.$('.' + model.collection.name + '-list');
    var template = this.$('#' + model.collection.name + '-template')[0];
    var modelEl = document.importNode(template.content, true).firstChild
    modelEl.setAttribute('id', model.collection.name + '-' + model.cid);
    model.binding = rivets.bind(modelEl, {model: model});
    el.append(modelEl);
  },
  colremove: function(model) {
    var modelEl = this.$('#' + model.collection.name + '-' + model.cid);
    modelEl.remove();
    model.binding.unbind();
  },
  events: {
    'click button[type=submit]': 'submit',
    'click button.remove': 'triggerremove'
  },
  triggerremove: function(e) {
    var id = e.currentTarget.parentElement.getAttribute('id');
    var props = id.split('-');
    var model = this.collections[props[0]].get({cid: props[1]});
    model.destroy();
  },
  submit: function(e) {
    var form = e.currentTarget.form;
    var name = form.getAttribute('name');
    var col;
    switch(name) {
      case 'job':
        col = this.collections.jobs;
        break;
      case 'phase':
        col = this.collections.phases;
        break;
      case 'building':
        col = this.collections.buildings;
        break;
      case 'component':
        col = this.collections.components;
        break;
      default:
        throw new Error('invalid object name');
    }
    var obj = parseForm(form);
    var m = col.create(obj);
    form.name.value = '';
    e.preventDefault();
  },
  render: function() {
    this.binding = this.binding || rivets.bind(this.el, {model: this.model});
    return this;
  }
});
