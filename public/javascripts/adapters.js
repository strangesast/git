// for addressing backbone model in rivets
rivets.adapters[':'] = {
  observe: function(obj, keypath, callback) {
    return obj.on('change:' + keypath, callback);
  },
  unobserve: function(obj, keypath, callback) {
    return obj.off('change:' + keypath, callback);
  },
  get: function(obj, keypath) {
    return obj.get(keypath);
  },
  set: function(obj, keypath, value) {
    return obj.set(keypath, value);
  }
}

// func
rivets.adapters['*'] = {
  // wont work
  observe: function(obj, keypath, callback) {
    return obj.on('change:' + keypath, callback);
  },
  // wont work
  unobserve: function(obj, keypath, callback) {
    return obj.off('change:' + keypath, callback);
  },
  get: function(obj, keypath) {
    return obj[keypath]();
  },
  set: function(obj, keypath, value) {
    return obj[keypath](value);
  }
}

// for determining active page
rivets.formatters['='] = {
  read: function(value, arg) {
    return value == arg;
  },
  publish: function(value, arg) {
    return arg;
  }
}

rivets.formatters['notnull'] = function(value, arg) {
  return value != null;
};

// irritating
rivets.formatters['numeric'] = {
  read: function(value) {
    return String(value);
  }, 
  publish: function(value) {
    return Number(value);
  }
};
