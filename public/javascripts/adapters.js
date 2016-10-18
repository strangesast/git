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
rivets.formatters['!='] = {
  read: function(value, arg) {
    return value != arg;
  },
  publish: function(value, arg) {
    return arg;
  }
}

rivets.formatters['icon_class'] = {
  read: function(value) {
    switch (value) {
      case 'phase':
        return 'icon fa fa-bookmark-o';
      case 'building':
        return 'icon fa fa-building-o';
      case 'component':
        return 'icon fa fa-cubes';
    }
    return value;
  }
}

rivets.formatters.len = function(value) {
  return value.length;
}

rivets.formatters.getURL = function(value) {
  return (value && value.getURL != null) ?  value.getURL() : null;
};

rivets.formatters.isPart = function(value) {
  return ['component', 'part'].indexOf(value) !== -1 ? 'true' : false;
};

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
