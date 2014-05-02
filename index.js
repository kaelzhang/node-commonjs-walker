'use strict';

var parser = require('./parser');
var semver = require('semver');
var node_path = require('path');
var async = require('async');

function walker (entry, options, callback) {
  options || (options = {});

  return new Walker(entry, options).go(callback);
}


function Walker (entry, options) {
  this.nodes = {};
  this.entry = node_path.resolve(entry);
  this.options = options;

  if (!options.pkg) {
    options.noCheckDepVersion = true;
  }
}


Walker.prototype.go = function(callback) {
  var self = this;

  var q = async.queue(function (task, done) {
    
  });
};


Walker.prototype._parse_file = function(path, callback) {
  var options = this.options;
  var self = this;

  parser.get_dependencies(path, {
    noStrictRequire: options.noStrictRequire

  }, function (err, dependencies) {
    if (err) {
      return callback(err);
    }

    
  });
};


Walker.prototype._is_relative = function(dep) {
  return dep.indexOf('./') === 0 || dep.indexOf('../') === 0;
};


Walker.prototype._get_node = function(path) {
  return this.nodes[path];
};

// We only check the node if it meets the conditions below:
// 1. already exists
// 2. but assigned as a dependency of anothor node

// If one of the ancestor dependents of `node` is `current`, it forms a circle.
Walker.prototype._check_circular = function(current, node) {
  var 
};


// @param {Array.}
Walker.prototype._look_back = function(trace) {
  // body...
};


Walker.prototype._print_circular = function() {
  // body...
};


walker._single = 