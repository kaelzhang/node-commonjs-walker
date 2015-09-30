'use strict';

var REGEX_EXT = /\.([a-z0-9]+)$/i;

// @returns {Boolean}
exports.match_ext = function (path, ext) {
  var match = path.match(REGEX_EXT);
  return match
    ? match[1] === ext
    // if there is no extension
    : true;
};


exports.throw = function (enable, message) {
  if (enable) {
    throw new Error(message);
  }
};


exports.simple_clone = function (object) {
  var key;
  var obj = {};
  for (key in object) {
    obj[key] = exports._shadow_clone(object[key]);
  }

  return obj;
};


exports._shadow_clone = function (object) {
  function F () {
  }

  F.prototype = object;
  return new F;
};