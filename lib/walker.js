'use strict';

module.exports = Walker;

var parser = require('./parser');
var circular = require('./circular');
var tools = require('./tools');

var node_path = require('path');
var async = require('async');
var fs = require('fs');
var util = require('util');
var resolve = require('resolve');
var EE = require('events').EventEmitter;
var mix = require('mix2');
var make_array = require('make-array');


function Walker (options) {
  this.options = options;
  this.nodes = {};
  this.compilers = [];

  if (!this._check_extensions()) {
    throw new Error('Invalid value of `options.extensions`');
  }

  this._init_queue();
}

util.inherits(Walker, EE);


Walker.prototype._init_queue = function() {
  var self = this;

  this.queue = async.queue(function (task, done) {
    // `path` will always be an absolute path.
    var path = task.path;

    self._parse_file(path, function(err){
      if (!err) {
        return done();
      }

      self.processing = false;
      self.queue.kill();
      self.error = err;
      self.emit('done');
    });

  }, self.options.concurrency);

  this.queue.drain = function () {
    self.processing = false;
    self.emit('done');
  }
};


Walker.prototype.walk = function(entry) {
  if (this.doned) {
    throw new Error('walker: you should not call .walk() after .done()');
  }

  make_array(entry).forEach(function(entry){
    entry = node_path.resolve(entry);
    if (this._has_node(entry)) {
      return;
    }

    this._walk(entry);
  }.bind(this));

  return this;
};


Walker.prototype._walk = function(entry) {
  var node = this._create_node(entry);

  if (node.foreign) {
    return;
  }

  this.processing = true;
  this.queue.push({
    path: entry
  });
};


Walker.prototype.done = function(callback) {
  this.doned = true;

  function cb () {
    callback(this.error || null, this.nodes);
  }

  if (!this.processing) {
    return cb();
  };

  this.once('done', cb)
};


// [ref](http://nodejs.org/api/modules.html#modules_file_modules)
var EXTS_NODE = Walker.EXTS_NODE = ['.js', '.json', '.node'];
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


// @param {Object|Array.<Object>} new_compilers
// - compiler: `function(content, options, callback)`
// - options :
// - test :
Walker.prototype.register = function(new_compilers) {
  new_compilers = make_array(new_compilers);

  var compilers = this.compilers;
  new_compilers.forEach(function (c) {
    c.test = util.isRegExp(c.test)
      ? c.test
      : new RegExp(c.test);

    compilers.push(c);
  });

  return this;
};


Walker.prototype._parse_file = function(path, callback) {
  var self = this;

  this._get_compiled_content(path, function (err, compiled) {
    if (err) {
      return callback(err);
    }

    var node = self._get_node(path);
    node.require = {};
    node.resolve = {};
    node.async = {};
    node.code = compiled.content;

    if (!compiled.js) {
      return callback(null);
    }

    parser.parse(path, compiled.content, self.options, function (err, data) {
      if (err) {
        return callback(err);
      }

      async.each(['require', 'resolve', 'async'], function (type, done) {
        self._parse_dependencies_by_type(path, data[type], type, done);
      }, callback);
    });
  });
};


Walker.prototype._get_compiled_content = function(filename, callback) {
  var self = this;
  this._read(filename, function (err, content) {
    if (err) {
      return callback(err);
    }

    self._compile(filename, content, callback);
  });
};


Walker.prototype._read = function (path, callback) {
  fs.readFile(path, function (err, content) {
    if (err) {
      return callback({
        code: 'ERROR_READ_FILE',
        message: 'Error reading module "' + path + '": ' + err.stack,
        data: {
          path: path,
          error: err
        }
      });
    }

    callback(null, content.toString());
  });
};


// Applies all compilers to process the file content
Walker.prototype._compile = function(filename, content, callback) {
  var tasks = this.compilers.filter(function (c) {
    return c.test.test(filename);
  
  }).reduce(function (prev, c) {
    function task (compiled, done) {
      var options = mix({
        // adds `filename` to options of each compiler
        filename: filename

      }, c.options, false);
      c.compiler(compiled.content, options, done);
    };
    prev.push(task);
    return prev;

  }, [init]);

  // If no registered compilers, just return
  function init (done) {
    done(null, {
      content: content,
      js: tools.match_ext(filename, 'js')
    });
  }

  async.waterfall(tasks, callback);
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

  if (!this._has_node(real)) {
    // Only walk a module file if the node not exists.
    this._walk(real);
    return callback(null);
  }

  var sub_node = this._get_node(real);

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


Walker.prototype._has_node = function (path) {
  return path in this.nodes;
};


Walker.prototype._get_node = function(path) {
  return this.nodes[path];
};


// Creates the node by id if not exists.
// No fault tolerance for the sake of private method
// @param {string} id 
// - `path` must be absolute path if is a relative module
// - package name for foreign module
Walker.prototype._create_node = function(id) {
  return this.nodes[id] = {
    id: id,
    foreign: this._is_foreign(id)
  };
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
