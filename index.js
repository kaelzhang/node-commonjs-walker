'use strict';

module.exports = walker;

var parser = require('./lib/parser');
var circular = require('./lib/circular');
var _ = require('underscore');
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

  makeDefault(options, 'allowCyclic', true);
  makeDefault(options, 'strictRequire', true);
  makeDefault(options, 'allowAbsolutePath', true);
  makeDefault(options, 'extensions', EXTS_NODE);

  if (!this._checkExts()) {
    throw new Error('Invalid value of `options.extensions`');
  }

  try{
    this.loaders = this.initLoaders(options.loaders);
  }catch(e){
    return callback(e);
  }
  this.callback = callback;
}

util.inherits(Walker, EE);

Walker.prototype.splitQuery = function(req) {
  var i = req.indexOf("?");
  if(i < 0) return [req, ""];
  return [req.substr(0, i), req.substr(i)];
};

Walker.prototype.initLoaders = function(loaders){
  var cwd = this.options.cwd;
  var loader_version = this.options.loader_version;
  var self = this;
  loaders = loaders.concat([{
    test: /\.js$/,
    loader: 'commonjs-loader'
  }, {
    test: /\.json$/,
    loader: 'json-loader'
  }]);

  return loaders.map(function(loaderConfig){
    var loaderFnArr = [];
    var loadersArr = [];
    loaderConfig.loader = loaderConfig.loader.split('!');
    for (var j = 0; j < loaderConfig.loader.length; j++) {
      var l = self.splitQuery(loaderConfig.loader[j]);
      loadersArr.push({
        request: loaderConfig.loader[j],
        path: l[0],
        query: l[1],
        module: null
      });
      var loaderName = l[0];
      var builtInPath = node_path.join(__dirname, 'lib', 'loaders', loaderName);
      var localPath = node_path.join(cwd, 'node_modules', loaderName);
      var loaderPath = loader_version[loaderName] || loaderName;
      var loaderFn;

      var paths = [builtInPath, localPath, loaderPath];
      var err;
      for(var i = 0; i < paths.length; i++){
        try{
          loaderFn = require(paths[i]);
          err = null;
          if(loaderFn){
            loaderFnArr.push(loaderFn);
            break;
          }
        }catch(e){
          if(e.code == 'MODULE_NOT_FOUND'){
            continue;
          }else{
            err = e;
            break;
          }
        }
      }

      if(err){
        throw err;
      }
    }

    return _.extend({
      loaderFn: loaderFnArr,
      loaders: loadersArr
    }, loaderConfig);
  })
};

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


Walker.prototype.walk = function() {
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

Walker.prototype.parse = function(path, options, callback) {
  var LoaderContext = require('./lib/loader-context');
  var loaders = this.loaders;
  var self = this;
  for(var i = 0; i < loaders.length; i++){
    (function(j){
      var loader, loaderCtx, result, readOption = {};
      loader = loaders[j];
      if(loader.test.test(path)){
        loaderCtx = new LoaderContext();
        self.read(path, readOption, function(err, content){
          loaderCtx.run({
            resource: path,
            resourcePath: self.splitQuery(path)[0],
            resourceQuery: path ? self.splitQuery(path)[1] || null : undefined,
            source: content,
            loaderFn: loader.loaderFn,
            context: node_path.dirname(path),
            loaders: loader.loaders
          }, function(err, result){
            if(err){return callback(err);}
            callback(null, {
              code: result,
              path: path,
              dependencies: loaderCtx.getDependencies()
            });
          });
        });
      }
    })(i);
  }
};

Walker.prototype.read = function(path, options, callback){
  options = options || {};
  var raw = options.raw;
  fs.readFile(path, {
    encoding: raw ? null : 'utf8'
  }, function (err, content) {
    callback(err, content);
  });
};
// Actually, we do nothing
// Walker.prototype._parseNodeFile = function(path, callback) {
//   this._parseJsonFile(path, callback);
// };


// // @param {Path} path Absolute path
// Walker.prototype._parseJsonFile = function(path, callback) {
//   var self = this;
//   parser.read(path, function (err, content) {
//     if (err) {
//       return callback(err);
//     }

//     var node = self._getNode(path);
//     node.code = content;
//     node.dependencies = {};
//     callback(null);
//   });
// };


Walker.prototype._parseFileDependencies = function(path, callback) {
  var node = this._getNode(path);
  var options = this.options;
  var self = this;
  self.parse(path, {
    strictRequire: this.options.strictRequire

  // @param {Object} data
  // - code
  // - path
  // - dependencies
  }, function (err, data) {
    if (err) {
      return callback(err);
    }
    node.code = data.code;
    node.dependencies = {};

    var dependencies = data.dependencies;

    async.each(dependencies, function (dep, done) {
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

        if (!options.allowAbsolutePath) {
          return done();
        } else {
          self.emit('warn', message);
        }
      }

      if (!self._isRelativePath(dep)) {
        // we only map top level id for now
        dep = self._solveAliasedDependency(options['as'][dep], path) || dep;
      }

      // package name, not a path
      if (!self._isRelativePath(dep)) {
        return self._dealDependency(origin, dep, node, done);
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

        self._dealDependency(origin, real, node, done);
      });
    }, callback);
  });
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
Walker.prototype._solveAliasedDependency = function(dep, env_path) {
  var cwd = this.options.cwd;

  if (!dep || !cwd || !this._isRelativePath(dep)) {
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


Walker.prototype._dealDependency = function(dep, real, node, callback) {
  node.dependencies[dep] = real;
  var sub_node = this._getNode(real);
  if (!sub_node) {
    sub_node = this._createNode(real);
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
      message: 'Cyclic dependency found: \n' + this._printCyclic(circular_trace),
      data: {
        trace: circular_trace,
        path: real
      }
    };

    if (!this.options.allowCyclic) {
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
Walker.prototype._createNode = function(id) {
  var node = this.nodes[id];

  if (!node) {
    node = this.nodes[id] = {
      id: id,
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


Walker.prototype._isRelativePath = function(path) {
  // Actually, this method is called after the parser.js,
  // and all paths are parsed from require(foo),
  // so `foo` will never be affected by windows,
  // so we should not use `'.' + node_path.sep` to test these paths
  return path.indexOf('./') === 0 || path.indexOf('../') === 0;
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

