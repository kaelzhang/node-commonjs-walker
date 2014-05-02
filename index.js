'use strict';

module.exports = walker;

var parser = require('./lib/parser');
var circular = require('./lib/circular');
var semver = require('semver');
var node_path = require('path');
var async = require('async');

function walker (entry, options, callback) {
  options || (options = {});

  return new Walker(entry, options, callback);
}


function Walker (entry, options, callback) {
  this.nodes = {};
  this.entry = node_path.resolve(entry);
  this.options = options;

  if (!options.pkg) {
    options.noCheckDepVersion = true;
    options.pkg = {};
  }

  if (!options.pkg.dependencies) {
    options.pkg.dependencies = {};
  }

  this.callback = callback;
  this._walk();
}


Walker.prototype._walk = function() {
  var self = this;
  var entry = this.entry;
  var called;

  function cb (err, tree) {
    if (called) {
      return;
    }

    if (err) {
      return self.callback(err);
    }

    // Returns the node of the entry point
    self.callback(null, self._getNode(entry));
  }

  var err;
  var q = async.queue(function (task, done) {
    // Each node must be created before `._parseFile()`
    self._parseFile(task.path, function (err, data) {
      if (err) {
        cb(err);
        return done();
      }

      self._dealDependencies(data, function (err) {
        if (err) {
          cb(err);
        }

        done();
      });
    });
  });

  q.drain = cb;

  // Creates entry node
  this._createNode(entry);
  // Adds initial task
  q.push({
    path: entry
  });

  this.queue = q;
};


Walker.prototype._parseFile = function(path, callback) {
  var options = this.options;
  var self = this;

  parser.parse(path, {
    noStrictRequire: options.noStrictRequire

  }, callback);
};


Walker.prototype._dealDependencies = function(data, callback) {
  var dependencies = data.dependencies;
  var path = data.path;
  var node = this._getNode(path);

  node.unsolvedDependencies = dependencies;
  node.dependencies = [];
  node.code = data.code;

  var self = this;
  var options = this.options;
  async.each(dependencies, function (dep, done) {
    // './foo'
    if (self._isRelativePath(dep)) {
      dep = node_path.join(path, dep);
    }

    var sub_node = self._getNode(dep);

    if (sub_node) {
      var circular_trace = self._checkCircular(node, sub_node);
      if (circular_trace && !options.noCheckCircular) {
        return done({
          code: 'ECIRCULAR',
          message: 'Circular dependency found: \n' + self._printCircular(circular_trace),
          data: {
            trace: circular_trace,
            path: dep
          }
        });
      }

      self._addDependent(node, sub_node);

      // If sub node is already exists, skip parsing.
      return done(null);
    }

    sub_node = self._createNode(dep);
    self._addDependent(node, sub_node);

    if (sub_node.isForeign) {
      var id = sub_node.id;
      var version = options.pkg.dependencies[id];
      var check_version = !options.noCheckDepVersion;

      if (!version && check_version) {
        return done({
          code: 'EPKGNINSTALL',
          message: 'Package "' + id + '" required by "' + path + '"  is not found in package object, please install first.',
          data: {
            id: id,
            path: path
          }
        });
      }

      var parsed_version = semver.valid(version) || semver.validRange(version);

      if (!parsed_version && check_version) {
        return done({
          code: 'EINVALIDV',
          message: 'The version or range "' + version + '" for package "' + id + '" is not valid.',
          data: {
            version: version,
            id: id
          }
        });
      }

      sub_node.version = parsed_version;

      // We do NOT parse foreign modules
      return done(null);
    }
    
    self.queue.push({
      path: dep
    });

    done(null);

  }, callback);
};


Walker.prototype._addDependent = function(dependent, dependency) {
  if (!~dependency.dependents.indexOf(dependent)) {
    dependency.dependents.push(dependent);
  }

  dependent.dependencies.push(dependency);
};


Walker.prototype._createNode = function(id) {
  var node = this.nodes[id];

  if (!node) {
    node = this.nodes[id] = {
      id: id,
      dependents: []
      // version will be set later
    };

    if (id === this.entry) {
      node.isEntryPoint = true;
    }

    if (!this._isAbsolutePath(id)) {
      node.isForeign = true;
    }
  }

  return node;
};


Walker.prototype._isAbsolutePath = function(path) {
  return node_path.resolve(path) === path.replace(/[\/\\]+$/, '');
};


Walker.prototype._isRelativePath = function(dep) {
  // 'abc' -> true
  // './abc' -> false
  // '../abc' -> false
  return dep.indexOf('./') === 0 && dep.indexOf('../') === 0;
};


Walker.prototype._getNode = function(path) {
  return this.nodes[path];
};

// We only check the node if it meets the conditions below:
// 1. already exists
// 2. but assigned as a dependency of anothor node

// If one of the ancestor dependents of `node` is `current`, it forms a circle.
Walker.prototype._checkCircular = function(current, node) {
  return circular.trace(current, node);
};


// 1. <path>
// 2. <path>
// 
Walker.prototype._printCircular = function(trace) {
  var list = trace.map(function (node, index) {
    return index + 1 + ': ' + node.path;
  });

  list.pop();

  var flow = trace.map(function (node, index) {
    ++ index;

    return index === 1 || index === trace.length
      ? '[1]'
      : index;

  });

  return list.join('\n') + '\n\n' + flow.join(' -> ');
};

