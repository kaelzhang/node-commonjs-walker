'use strict'

var code = require('print-code')

var REGEX_EXT = /\.([a-z0-9]+)$/i

// @returns {Boolean}
exports.match_ext = function (path, ext) {
  var match = path.match(REGEX_EXT)
  return match
    ? match[1] === ext
    // if there is no extension
    : true
}


function generate_loc_text (loc) {
  return 'Line ' + loc.line + (
    loc.column
      ? ': Column ' + + loc.column
      : ''

  ) + ': '
}

exports.throw = function (enable, message, loc) {
  // silly wrap
  -- loc.line

  if (enable) {
    var err = new Error(generate_loc_text(loc) + message)
    err.loc = loc
    throw err
  }
}


exports.print_code = function (content, loc) {
  var gen = code(content)
    .highlight(loc.line)
    .slice(Math.max(0, loc.line - 2), loc.line + 2)

  if (typeof loc.column === 'number') {
    gen.arrow_mark(loc.line, loc.column)
  }

  return gen.get()
}


// Silly wrap the file content to allow `return` statement
exports.silly_wrap = function (content) { 
  return '(function(){\n' // '\n' to prevent '(function(){//a})'
    + content 
    + '\n})()'
}


exports.fixes_line_code = function(message) {
  var line
  message = message.replace(/Line\s*(\d+)/i, function (m, g1) {
    line = parseInt(g1) - 1
    return 'Line ' + line
  })

  return {
    message: message,
    line: line
  }
}


exports.simple_clone = function (object) {
  var key
  var obj = {}
  for (key in object) {
    obj[key] = exports._shadow_clone(object[key])
  }

  return obj
}


exports._shadow_clone = function (object) {
  function F () {
  }

  F.prototype = object
  return new F
}