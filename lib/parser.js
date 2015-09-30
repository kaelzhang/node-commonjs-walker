'use strict';

var parser = exports;
var esprima = require('esprima');
var node_path = require('path');
var fs = require('fs');
var util = require('util');


// Parses a file and get its dependencies and code
// @param {String} content
// @param {String} path
// @param {Object} options
// @param {function()} callback
parser.parse = function (path, content, options, callback) {
  if (!parser._guess_is_js(path)) {
    return callback(null, {
      path: path,
      require: [],
      resolve: [],
      async: []
    });
  }

  parser._lex_js(content, function (err, ast) {
    if (err) {
      return callback({
        code: 'ERROR_PARSE_JS',
        message: 'Error parsing "' + path + '": ' + err.stack,
        data: {
          path: path,
          error: err
        }
      });
    }

    var dependencies = {
      normal: [],
      resolve: [],
      async: []
    };

    try {
      parser._parse_dependencies(ast, dependencies, options);
    } catch(e) {
      return callback({
        code: 'WRONG_USAGE_REQUIRE',
        message: 'Error parsing dependencies: ' + e.message,
        data: {
          path: path,
          error: e
        }
      });
    }

    if (options.comment_require) {
      parser._parse_comments(ast, dependencies, options);
    }

    callback(null, {
      // code: content,
      path: path,
      require: parser._make_unique(dependencies.normal),
      resolve: parser._make_unique(dependencies.resolve),
      async: parser._make_unique(dependencies.async)
    });
  });
};


parser._make_unique = function (array) {
  return array.reduce(function (prev, current) {
    if (!~prev.indexOf(current)) {
      prev.push(current);
    }
    return prev;
  }, []);
};


var REGEX_EXT = /\.([a-z0-9]+)$/i;

// @returns {Boolean}
parser._guess_is_js = function (path) {
  var match = path.match(REGEX_EXT);
  return match
    ? match[1] === 'js'
    // if there is no extension
    : true;
};


// Parses the content of a javascript to AST
parser._lex_js = function (content, callback) {
  var ast;
  try {
    ast = esprima.parse(content, {
      loc: true,
      comment: true
    });
  } catch(e) {
    return callback(e);
  }

  callback(null, ast);
};


// Parses AST and returns the dependencies
parser._parse_dependencies = function (node, dependencies, options) {
  // Only arrays or objects has child node, or is a sub AST.
  if (!node || Object(node) !== node) {
    return;
  }

  parser._check_dependency_node(node, function (node) {
    return node.type === 'CallExpression'
      && node.callee.type === 'Identifier'
      && node.callee.name === 'require';
  }, dependencies.normal, options, true)

  || options.require_resolve && parser._check_dependency_node(node, function (node) {
    return node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.object.name === 'require'
      && node.callee.property.name === 'resolve';
  }, dependencies.resolve, options, true)

  || options.require_async && parser._check_dependency_node(node, function (node) {
    return node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.object.name === 'require'
      && node.callee.property.name === 'async';
  }, dependencies.async, options, false);

  if (util.isArray(node)) {
    node.forEach(function (sub) {
      parser._parse_dependencies(sub, dependencies, options);
    });

  } else {
    var key;
    for (key in node) {
      parser._parse_dependencies(node[key], dependencies, options);
    }
  }
};


parser._check_dependency_node = function (node, condition, deps_array, options, check_if_length_exceeded) {
  if (!condition(node)) {
    return;
  }

  var args = node.arguments;
  var loc = node.callee.loc.start;
  var loc_text = generate_loc_text(loc);
  var check_length = options.check_require_length;

  if (args.length === 0) {
    parser._throw(check_length, loc_text + 'Method `require` accepts one and only one parameter.');
  }

  if (check_if_length_exceeded && args.length > 1) {
    parser._throw(check_length, loc_text + 'Method `require` should not contains more than one parameters');
  }

  var arg1 = args[0];
  if (!arg1) {
    return;
  }
  
  if (arg1.type !== 'Literal') {
    parser._throw(!options.allow_non_literal_require, generate_loc_text(arg1.loc.start) + 'Method `require` only accepts a string literal.' );
  } else {
    deps_array.push(arg1.value);
  }
};


var REGEX_LEFT_PARENTHESIS_STRING = '\\s*\\(\\s*([\'"])([A-Za-z0-9_\\/\\-\\.]+)\\1\\s*';
var REGEX_PARENTHESIS_STRING      = REGEX_LEFT_PARENTHESIS_STRING + '\\)';

var REGEX_REQUIRE         = 
  new RegExp('@require'           + REGEX_PARENTHESIS_STRING, 'g');

var REGEX_REQUIRE_RESOLVE = 
  new RegExp('@require\\.resolve' + REGEX_PARENTHESIS_STRING, 'g');

var REGEX_REQUIRE_ASYNC = 
  new RegExp('@require\\.async'   + REGEX_LEFT_PARENTHESIS_STRING, 'g');

// Parses `@require`, `@require.resolve`, `@require.async` in comments
parser._parse_comments = function (ast, dependencies, options) {
  var comments = ast.comments;
  if (!comments) {
    return;
  }

  comments.forEach(function (comment) {
    parser._parse_by_regex(comment.value, REGEX_REQUIRE, dependencies.normal);

    if (options.require_resolve) {
      parser._parse_by_regex(comment.value, REGEX_REQUIRE_RESOLVE, dependencies.resolve);
    }

    if (options.require_async) {
      parser._parse_by_regex(comment.value, REGEX_REQUIRE_ASYNC, dependencies.async);
    }
  });
};


// @param {string} content
// @param {RegExp} regex
// @param {*Array} matches
parser._parse_by_regex = function (content, regex, matches) {
  var match;
  while(match = regex.exec(content)){
    matches.push(match[2]);
  }
};


function generate_loc_text (loc) {
  return 'Line ' + loc.line + ': Column ' + loc.column + ': ';
}


parser._throw = function (enable, message) {
  if (enable) {
    throw new Error(message);
  }
};
