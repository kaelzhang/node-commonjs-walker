'use strict';

module.exports = walker;

var parser = require('./lib/parser');
var circular = require('./lib/circular');
var node_path = require('path');
var async = require('async');
var fs = require('fs');
var util = require('util');
var resolve = require('resolve');
var EE = require('events').EventEmitter;

function walker (entry, options, callback) {
  options || (options = {});
  if(arguments.length == 2){
    options = {};
    callback = arguments[1];
  }
  options['as'] || (options['as'] = {});
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

  makeDefault(options, 'allow_cyclic', true);
  makeDefault(options, 'allow_non_literal_require', true);
  makeDefault(options, 'comment_require', true);
  makeDefault(options, 'require_resolve', true);
  makeDefault(options, 'require_async', true);
  makeDefault(options, 'extensions', EXTS_NODE);

  if (!this._check_extensions()) {
    throw new Error('Invalid value of `options.extensions`');
  }

  this.callback = callback;
  this._walk();
}

util.inherits(Walker, EE);

// Checks if the `options.extensions` is valid
Walker.prototype._check_extensions = function() {
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
    // Each node must be created before `._parse_file_dependencies()`
    self._parse_file_dependencies(path, function (err) {
      if (err) {
        return cb(err);
      }
      done();
    });
  });

  // Creates entry node
  // `node` should be created before the task is running.
  this._create_node(entry);
  q.drain = cb;
  // Adds initial task
  q.push({
    path: entry
  });
  this.queue = q;
};


Walker.prototype._parse_file_dependencies = function(path, callback) {
  var node = this._get_node(path);
  var options = this.options;
  var self = this;
  parser.parse(path, this.options, function (err, data) {
    if (err) {
      return callback(err);
    }
    
    node.require = {};
    node.resolve = {};
    node.async = {};

    async.each(['require', 'resolve', 'async'], function (type, done) {
      self._parse_dependencies_by_type(path, data[type], type, done);
    }, callback);
  });
};


Walker.prototype._parse_dependencies_by_type = function(path, paths, type, callback) {
  var self = this;
  var options = this.options;
  var node = this._get_node(path);
  async.each(paths, function (dep, done) {
    var origin = dep;

    if (dep.indexOf('/') === 0) {
      var message = {
        code: 'NOT_ALLOW_ABSOLUTE_PATH',
        message: 'Requiring an absolute path "' + dep + '" is not allowed in "' + path + '"',
        data: {
          dependency: dep,
          path: path
        }
      };

      if (!options.allow_absolute_path) {
        return done();
      } else {
        self.emit('warn', message);
      }
    }

    if (!self._is_relative_path(dep)) {
      // we only map top level id for now
      dep = self._solve_aliased_dependency(options['as'][dep], path) || dep;
    }

    // package name, not a path
    if (!self._is_relative_path(dep)) {
      return self._deal_dependency(origin, dep, node, type, done);
    }

    resolve(dep, {
      basedir: node_path.dirname(path),
      extensions: options.extensions
    }, function (err, real) {
      if (err) {
        return done({
          code: 'MODULE_NOT_FOUND',
          message: err.message,
          stack: err.stack,
          data: {
            path: dep
          }
        });
      }

      self._deal_dependency(origin, real, node, type, done);
    });
  }, callback);
};


// #17
// If we define an `as` field in cortex.json
// {
//   "as": {
//     "abc": './abc.js' // ./abc.js is relative to the root directory 
//   }
// }
// @param {String} dep path of dependency
// @param {String} env_path the path of the current file
Walker.prototype._solve_aliased_dependency = function(dep, env_path) {
  var cwd = this.options.cwd;

  if (!dep || !cwd || !this._is_relative_path(dep)) {
    return dep;
  }

  dep = node_path.join(cwd, dep);
  dep = node_path.relative(node_path.dirname(env_path), dep)
    // After join and relative, dep will contains `node_path.sep` which varies from operating system,
    // so normalize it
    .replace(/\\/g, '/');

  if (!~dep.indexOf('..')) {
    // 'abc.js' -> './abc.js'
    dep = './' + dep;
  }

  return dep;
};


Walker.prototype._deal_dependency = function(dep, real, node, type, callback) {
  node[type][dep] = real;
  var sub_node = this._get_node(real);
  if (!sub_node) {
    sub_node = this._create_node(real);
    if (!sub_node.foreign) {
      // only if the node is newly created.
      this.queue.push({
        path: real
      });
    }
    return callback(null);
  }

  // We only check the node if it meets the conditions below:
  // 1. already exists: all new nodes are innocent.
  // 2. but assigned as a dependency of anothor node
  // If one of the ancestor dependents of `node` is `current`, it forms a circle.
  var circular_trace;
  // node -> sub_node
  if (circular_trace = circular.trace(sub_node, node, this.nodes)) {
    var message = {
      code: 'CYCLIC_DEPENDENCY',
      message: 'Cyclic dependency found: \n' + this._print_cyclic(circular_trace),
      data: {
        trace: circular_trace,
        path: real
      }
    };

    if (!this.options.allow_cyclic) {
      return callback(message);
    } else {
      this.emit('warn', message);
    }
  }
  callback(null);
};


// Creates the node by id if not exists.
// No fault tolerance for the sake of private method
// @param {string} id 
// - `path` must be absolute path if is a relative module
// - package name for foreign module
Walker.prototype._create_node = function(id) {
  var node = this.nodes[id];

  if (!node) {
    node = this.nodes[id] = {
      id: id,
      entry: id === this.entry,
      foreign: this._is_foreign(id)
    };
  }
  return node;
};


Walker.prototype._is_foreign = function(path) {
  return !this._is_absolute_path(path);
};


Walker.prototype._is_absolute_path = function(path) {
  return node_path.resolve(path) === path.replace(/[\/\\]+$/, '');
};


Walker.prototype._is_relative_path = function(path) {
  // Actually, this method is called after the parser.js,
  // and all paths are parsed from require(foo),
  // so `foo` will never be affected by windows,
  // so we should not use `'.' + node_path.sep` to test these paths
  return path.indexOf('./') === 0 || path.indexOf('../') === 0;
};


Walker.prototype._get_node = function(path) {
  return this.nodes[path];
};


// 1. <path>
// 2. <path>
// 
Walker.prototype._print_cyclic = function(trace) {
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
