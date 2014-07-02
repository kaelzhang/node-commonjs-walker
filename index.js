'use strict';

module.exports = walker;

var parser = require('./lib/parser');
var circular = require('./lib/circular');
var node_path = require('path');
var async = require('async');
var fs = require('fs');
var util = require('util');

function walker (entry, options, callback) {
  options || (options = {});
  if(arguments.length == 2){
    options = {};
    callback = arguments[1];
  }
  return new Walker(entry, options, callback);
}


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
  makeDefault(options, 'parseForeignModule', true);

  makeDefault(options, 'extFallbacks', EXTS_NODE);

  if (!this._checkExts()) {
    throw new Error('Invalid value of options.extFallbacks');
  }

  this.callback = callback;
  this._walk();
}


Walker.prototype._checkExts = function() {
  var exts = this.options.extFallbacks;

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

  function cb (err, tree) {
    if (called) {
      return;
    }

    called = true;

    if (err) {
      return self.callback(err);
    }

    // Returns the node of the entry point
    self.callback(null, self._getNode(entry), self.nodes);
  }

  var err;
  var q = async.queue(function (task, done) {
    function sub_node (err) {
      if (err) {
        cb(err);
      }

      done();
    }

    var path = task.path;
    var ext = self._getExt(path);
    var node = self._getNode(path);
    node.ext = ext;

    if (ext === '.json') {
      return self._parseJsonFile(path, sub_node);
    }

    if (ext === '.node') {
      return self._parseNodeFile(path, sub_node);
    }

    // Each node must be created before `._parseFile()`
    self._parseFile(path, function (err, data) {
      if (err) {
        cb(err);
        return done();
      }

      self._dealDependencies(data, sub_node);
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


var REGEX_MATCH_EXT = /\.[a-z]+$/i;
Walker.prototype._getExt = function(file) {
  var match = file.match(REGEX_MATCH_EXT);
  if (!match) {
    return '';
  }

  return match[0].toLowerCase();
};


// Actually, we do nothing
Walker.prototype._parseNodeFile = function(path, callback) {
  this._parseJsonFile(path, callback);
};


Walker.prototype._parseJsonFile = function(path, callback) {
  var self = this;
  parser.read(path, function (err, content) {
    if (err) {
      return callback(err);
    }

    var node = self._getNode(path);
    node.code = content;
    node.dependencies = [];
    node.unresolvedDependencies = [];
    callback(null);
  });
};


Walker.prototype._parseFile = function(path, callback) {
  var self = this;

  parser.parse(path, {
    strictRequire: this.options.strictRequire

  }, callback);
};


Walker.prototype._dealDependencies = function(data, callback) {
  var dependencies = data.dependencies;
  var path = data.path;
  var node = this._getNode(path);

  node.unresolvedDependencies = dependencies;
  node.dependencies = [];
  node.code = data.code;

  var self = this;
  var options = this.options;
  async.each(dependencies, function (dep, done) {
    // Suppose:
    // origin -> 
    // './a'
    // './b.js'
    var origin = dep;

    if (dep.indexOf('/') === 0 && !options.allowAbsolutePath) {
      return done({
        code: 'NOT_ALLOW_ABSOLUTE_PATH',
        message: 'Requiring an absolute path is not allowed',
        data: {
          dependency: dep,
          path: path
        }
      });
    }

    // Absolutize
    // -> '/path/to/a'
    // -> '/path/to/b.js'
    if (self._isRelativePath(dep)) {
      dep = node_path.join(node_path.dirname(path), dep);
    }

    // -> '/path/to/a.js'
    // -> '/path/to/b.js'
    var resolved = self._resolveDependency(dep);
    if (!resolved) {
      return done({
        code: 'MODULE_NOT_FOUND',
        message: 'Cannot find module \'' + origin + '\'',
        data: {
          path: dep,
          origin: origin
        }
      });
    }

    var sub_node = self._getNode(resolved);
    if (sub_node) {
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
            path: resolved
          }
        });
      }

      self._addDependent(node, sub_node);

      // If sub node is already exists, skip parsing.
      return done(null);
    }

    sub_node = self._createNode(resolved);
    self._addDependent(node, sub_node);

    if (sub_node.isForeign) {
      // We do NOT parse foreign modules
      return done(null);
    }
    
    self.queue.push({
      path: resolved
    });

    done(null);

  }, callback);
};


Walker.prototype._resolveDependency = function(dep) {
  // Foreign module with a top id
  if (!this._isAbsolutePath(dep)) {
    return dep;
  }

  var resolved = null;
  try {
    resolved = require.resolve(dep);
  } catch(e) {}

  // If require.resolve throws, resolved will be `null`
  if (resolved) {
    resolved = this._cleanResolvedDependency(resolved);
  }
  
  return resolved;
};


// `require.resolve` will always fallback to 
// `.js`, then `.json`, and finally `.node`.
// But we not always do that, so we need to clean the resolved path.
Walker.prototype._cleanResolvedDependency = function(resolved) {
  var ext = this._getExt(resolved);
  // if no extension, the module must exist.
  if (!ext) {
    return resolved;
  }

  if (~this.options.extFallbacks.indexOf(ext)) {
    return resolved;
  }

  // if `options.extFallbacks` does not contain `ext`,
  // we consider it not found.
  return null;
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

