'use strict';

var parser = exports;
var esprima = require('esprima');
var node_path = require('path');
var fs = require('fs');
var util = require('util');


parser.parse = function (path, options, callback) {
  fs.readFile(path, function (err, content) {
    if (err) {
      return callback({
        code: 'EREADFILE',
        message: 'Error reading module "' + path + '": ' + err.stack,
        data: {
          path: path,
          error: err
        }
      });
    }

    parser._parseJs(content.toString(), function (err, ast) {
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
        parser._parseDependencies(ast, dependencies, options);
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

      // Removes duplicate items
      dependencies = dependencies.reduce(function (prev, current) {
        if (!~prev.indexOf(current)) {
          prev.push(current);
        }
        return prev;
      }, []);

      callback(null, {
        code: content, 
        path: path,
        dependencies: dependencies
      });
    });
  });
};


parser._parseJs = function (content, callback) {
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


parser._parseDependencies = function (node, host, options) {
  host || (host = []);

  // Only arrays or objects has child node, or is a sub AST.
  if (!node || Object(node) !== node) {
    return;
  }

  if (
    node.type === 'CallExpression'
    && node.callee.type === 'Identifier'
    && node.callee.name === 'require'
  ) {
    var args = node.arguments;
    var loc = node.callee.loc.start;
    var loc_text = locText(loc);

    var strict = options.strictRequire;

    if (args.length === 0) {
      parser._throw(strict, loc_text + 'Method `require` accepts only one parameter.');
      return;
    }

    if (args.length > 1) {
      parser._throw(strict, loc_text + 'Method `require` should not contains more than one parameters');
    }

    var arg1 = args[0];

    if (arg1.type !== 'Literal') {
      parser._throw(strict, locText(arg1.loc.start) + 'Method `require` only accepts a string literal.' );
      return;
    }

    host.push(arg1.value);
  }

  if (util.isArray(node)) {
    node.forEach(function (sub) {
      parser._parseDependencies(sub, host, options);
    });

  } else {
    var key;
    for (key in node) {
      parser._parseDependencies(node[key], host, options);
    }
  }
};


function locText (loc) {
  return 'Line ' + loc.line + ': Column ' + loc.column + ': ';
}


parser._throw = function (enable, message) {
  if (enable) {
    throw new Error(message);
  }
};

