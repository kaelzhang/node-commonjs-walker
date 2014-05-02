'use strict';

var walker = exports;
var esprima = require('esprima');
var node_path = require('path');
var fs = require('fs');
var util = require('util');


walker.get_dependencies = function (path, options, callback) {
  fs.readFile(path, function (err, content) {
    if (err) {
      return callback(walker._error({
        code: 'EREADFILE',
        message: 'Error reading "' + path + '": ' + err.stack,
        data: {
          path: path,
          error: err
        }
      }, err));
    }

    walker._parse_js(content, function (err, ast) {
      if (err) {
        return callback({
          code: 'EPARSEJS',
          message: 'Error parsing "' + path + '": ' + e.stack,
          data: {
            path: path,
            error: err
          }
        });
      }

      var dependencies = [];

      try {
        walker._parse_dependencies(ast, dependencies, options);
      } catch(e) {
        return callback({
          code: 'EREQUIRE',
          message: 'Error parsing dependencies: ' + e.message,
          data: {
            path: path,
            error: e
          }
        });
      }

      callback(null, dependencies);
    });
  });
};


walker._parse_js = function (content, callback) {
  var ast;
  try {
    ast = esprima.parse(content, {
      loc: true
    });
  } catch(e) {
    return callback(e);
  }

  callback(null, ast);
};


walker._parse_dependencies = function (node, host, options) {
  host || (host = []);

  // Only arrays or objects has child node, or is a sub AST.
  if (!node || !util.isObject(node)) {
    return;
  }

  if (
    node.type === 'CallExpression'
    && node.callee.type === 'Identifier'
    && node.callee.name === 'require'
  ) {
    var args = node.callee.arguments;
    var loc = node.callee.loc.start;
    var loc_text = pos_text(loc);

    var strict = !options.noStrictRequire;

    if (args.length === 0) {
      walker._throw(strict, loc_text + 'Method `require` accepts only one parameter.');
      return;
    }

    if (args.length > 1) {
      walker._throw(strictoptions.noStrictRequire, loc_text + 'Method `require` should not contains more than one parameters');
    }

    var arg1 = args[0];

    if (arg1.type !== 'Literal') {
      walker._throw(strict, pos_text(arg1.loc.start) + 'Method `require` only accepts a string literal.' );
      return;
    }

    host.push(arg1.value);
  }

  if (util.isArray(node)) {
    node.forEach(function (sub) {
      walker._parse_dependencies(sub, host, options);
    });

  } else {
    var key;
    for (key in node) {
      walker._parse_dependencies(node[key], host, options);
    }
  }
};


function pos_text (loc) {
  return 'Line ' + loc.line + ': Column ' + loc.column ':';
}


walker._throw = function (enable, message) {
  if (enable) {
    throw new Error(message);
  }
};

