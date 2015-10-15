'use strict';

module.exports = walker;

var make_array = require('make-array');
var util = require('util');
var EE = require('events').EventEmitter;

var Walker = require('./lib/walker');
walker.Walker = Walker;

function walker (options) {
  options || (options = {});
  
  makeDefault(options, 'allow_cyclic',              true);
  makeDefault(options, 'allow_non_literal_require', true);
  makeDefault(options, 'comment_require',           true);
  makeDefault(options, 'require_resolve',           true);
  makeDefault(options, 'require_async',             true);
  makeDefault(options, 'extensions',                Walker.EXTS_NODE);
  makeDefault(options, 'compilers',                 {});
  makeDefault(options, 'use_global_cache',          true);
  makeDefault(options, 'as',                        {});

  return new _Walker(options);
}


function makeDefault (object, key, value) {
  object[key] = key in object
    ? object[key]
    : value
}


function _Walker (options) {
  this.options = options;
  this.compilers = [];
}

util.inherits(_Walker, EE);

// @param {Object|Array.<Object>} new_compilers
// - compiler: `function(content, options, callback)`
// - options :
// - test :
_Walker.prototype.register = function(new_compilers) {
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


_Walker.prototype.walk = function(entry, callback) {
  var self = this;
  new Walker(this.options, this.compilers)
  .on('warn', function (message) {
    self.emit('warn', message);
  })
  .walk(entry, callback);

  return this;
};
