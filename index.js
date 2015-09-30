'use strict';

module.exports = walker;

var make_array = require('make-array');
var util = require('util');
var Walker = require('./lib/walker');
walker.Walker = Walker;

function walker (options) {
  options || (options = {});
  if(arguments.length == 2){
    options = {};
    callback = arguments[1];
  }

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


// @param {string|RegExp} pattern
// @param {Object|Array.<Object>} new_compilers
// - compiler: `function(content, options, callback)`
// - options :
// - pattern :
_Walker.prototype.register = function(new_compilers) {
  new_compilers = make_array(new_compilers);

  var compilers = this.compilers;
  new_compilers.forEach(function (c) {
    c.pattern = util.isRegExp(c.pattern)
      ? c.pattern
      : new RegExp(c.pattern);

    compilers.push(c);
  });

  return this;
};


_Walker.prototype.walk = function(entry, callback) {
  new Walker(this.options, this.compilers).walk(entry, callback);
  return this;
};
