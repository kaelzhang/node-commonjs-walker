'use strict';

module.exports = walker;

var parser = require('./lib/parser');
var circular = require('./lib/circular');
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
    self.callback(null, self._getNode(entry), self.nodes);
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
  var self = this;

  parser.parse(path, {
    noStrictRequire: this.options.noStrictRequire

  }, callback);
};


Walker.prototype._ensureExt = function(path, ext) {
  var regex = new RegExp('\\.' + ext + '$', 'i');

  if (!regex.test(path)) {
    path += '.' + ext;
  }

  return path;
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
      dep = node_path.join(node_path.dirname(path), dep);
      dep = self._ensureExt(dep, 'js');
    }

    var sub_node = self._getNode(dep);

    if (sub_node) {

      // We only check the node if it meets the conditions below:
      // 1. already exists: all new nodes are innocent.
      // 2. but assigned as a dependency of anothor node

      // If one of the ancestor dependents of `node` is `current`, it forms a circle.
      var circular_trace = circular.trace(node, sub_node);
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


// Creates the node by id if not exists.
// No fault tolerance for the sake of private method
// @param {string} id 
// - `path` must be absolute path if is a relative module
// - package name for foreign module
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
  return dep.indexOf('./') === 0 || dep.indexOf('../') === 0;
};


Walker.prototype._getNode = function(path) {
  return this.nodes[path];
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

