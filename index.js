'use strict';

module.exports = walker;

var parser = require('./lib/parser');
var circular = require('./lib/circular');
var node_path = require('path');
var async = require('async');
var fs = require('fs');
var util = require('util');
var resolve = require('resolve');

function walker (entry, options, callback) {
  options || (options = {});
  if(arguments.length == 2){
    options = {};
    callback = arguments[1];
  }
  return new Walker(entry, options, callback);
}

walker.OPTIONS = {
  BROWSER: {
    detectCyclic: true,
    strictRequire: true,
    allowAbsolutePath: false,
    extensions: ['.js', '.json']
  }
};


function makeDefault (object, key, value) {
  object[key] = key in object
    ? object[key]
    : value
}


// [ref](http://nodejs.org/api/modules.html#modules_file_modules)
var EXTS_NODE = ['.js', '.json', '.node'];

function Walker (entry, options, callback) {
  this.nodes = {};
  this.entry = node_path.resolve(entry);
  this.options = options;

  makeDefault(options, 'detectCyclic', true);
  makeDefault(options, 'strictRequire', true);
  makeDefault(options, 'allowAbsolutePath', true);
  makeDefault(options, 'extensions', EXTS_NODE);

  if (!this._checkExts()) {
    throw new Error('Invalid value of `options.extensions`');
  }

  this.callback = callback;
  this._walk();
}


// Checks if the `options.extensions` is valid
Walker.prototype._checkExts = function() {
  var exts = this.options.extensions;

  if (!util.isArray(exts)) {
    return false;
  }

  return exts.every(function (ext, i) {
    return ext === EXTS_NODE[i];
  });
};


Walker.prototype._walk = function() {
  var self = this;
  var entry = this.entry;

  var called;
  function cb (err) {
    if (called) {
      return;
    }
    called = true;

    if (err) {
      return self.callback(err);
    }
    // Returns the node of the entry point
    self.callback(null, self.nodes);
  }

  var err;
  var q = async.queue(function (task, done) {
    // `path` will always be an absolute path.
    var path = task.path;
    // Each node must be created before `._parseFileDependencies()`
    self._parseFileDependencies(path, function (err) {
      if (err) {
        return cb(err);
      }
      done();
    });
  });

  // Creates entry node
  // `node` should be created before the task is running.
  this._createNode(entry);
  q.drain = cb;
  // Adds initial task
  q.push({
    path: entry
  });
  this.queue = q;
};


// Actually, we do nothing
Walker.prototype._parseNodeFile = function(path, callback) {
  this._parseJsonFile(path, callback);
};


// @param {Path} path Absolute path
Walker.prototype._parseJsonFile = function(path, callback) {
  var self = this;
  parser.read(path, function (err, content) {
    if (err) {
      return callback(err);
    }

    var node = self._getNode(path);
    node.code = content;
    node.dependencies = {};
    callback(null);
  });
};


Walker.prototype._parseFileDependencies = function(path, callback) {
  var node = this._getNode(path);
  var path = task.path;
  var options = this.options;
  var self = this;
  parser.parse(path, {
    strictRequire: this.options.strictRequire

  // @param {Object} data
  // - code
  // - path
  // - dependencies
  }, function (err, data) {
    node.code = data.code;
    node.dependencies = {};

    var dependencies = data.dependencies;
    async.each(dependencies, function (dep, done) {
      if (dep.indexOf('/') === 0 && !options.allowAbsolutePath) {
        return done({
          code: 'NOT_ALLOW_ABSOLUTE_PATH',
          message: 'Requiring an absolute path "' + dep + '" is not allowed in "' + path + '"',
          data: {
            dependency: dep,
            path: path
          }
        });
      }

      if (!self._isForeign(dep)) {
        return self._dealDependency(dep, dep, node, done);
      }

      resolve(dep, {
        extensions: options.extensions
      }, function (err, real) {
        if (err) {
          return done(err);
        }

        self._dealDependency(dep, real, node, callback);
      });
    }, callback);
  });
};



Walker.prototype._dealDependency = function(dep, real, node, callback) {
  node.dependencies[dep] = real;
  var sub_node = self._getNode(real);
  if (!sub_node) {
    sub_node = self._createNode(real);
    if (!sub_node.foreign) {
      // only if the node is newly created.
      self.queue.push({
        path: real
      });
    }
    self._addDependent(node, sub_node);
    return done(null);
  }

  // We only check the node if it meets the conditions below:
  // 1. already exists: all new nodes are innocent.
  // 2. but assigned as a dependency of anothor node
  // If one of the ancestor dependents of `node` is `current`, it forms a circle.
  var circular_trace;
  if (
    options.detectCyclic 

    // node -> sub_node
    && (circular_trace = circular.trace(sub_node, node))
  ) {
    return done({
      code: 'CYCLIC_DEPENDENCY',
      message: 'Cyclic dependency found: \n' + self._printCyclic(circular_trace),
      data: {
        trace: circular_trace,
        path: real
      }
    });
  }

  self._addDependent(node, sub_node);
  done(null);
};


Walker.prototype._addDependent = function(dependent, dependency) {
  // adds dependent
  if (!~sub_node.dependents.indexOf(node)) {
    sub_node.dependents.push(node);
  }
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
      dependents: [],
      entry: id === this.entry,
      foreign: this._isForeign(id)
    };
  }
  return node;
};


Walker.prototype._isForeign = function(path) {
  return !this._isAbsolutePath(path);
};


Walker.prototype._isAbsolutePath = function(path) {
  return node_path.resolve(path) === path.replace(/[\/\\]+$/, '');
};


Walker.prototype._getNode = function(path) {
  return this.nodes[path];
};


// 1. <path>
// 2. <path>
// 
Walker.prototype._printCyclic = function(trace) {
  var list = trace.map(function (node, index) {
    return index + 1 + ': ' + node.id;
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

