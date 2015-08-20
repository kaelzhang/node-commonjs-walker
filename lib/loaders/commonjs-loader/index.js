var esprima = require('esprima');
var path = require('path');
var util = require('util');

// Parses the content of a javascript to AST
function _lexJs(content, callback) {
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

function locText (loc) {
  return 'Line ' + loc.line + ': Column ' + loc.column + ': ';
}

// Parses AST and returns the dependencies
function _parseDependencies(node, host) {
  var self = this;
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

    var strict = true;

    if (args.length === 0 && strict) {
      this.emitError(loc_text + 'Method `require` accepts one and only one parameter.');
      return;
    }

    if (args.length > 1 && strict) {
      this.emitError(loc_text + 'Method `require` should not contains more than one parameters');
    }

    var arg1 = args[0];

    if (arg1.type !== 'Literal' && strict) {
      this.emitError(locText(arg1.loc.start) + 'Method `require` only accepts a string literal.' );
      return;
    }

    host.push(arg1.value);
  }

  if (util.isArray(node)) {
    node.forEach(function (sub) {
      _parseDependencies.bind(self)(sub, host);
    });

  } else {
    var key;
    for (key in node) {
      _parseDependencies.bind(self)(node[key], host);
    }
  }
};


module.exports = function(source){
    var self = this;
    self.async();
    _lexJs.bind(self)(source.toString(), function (err, ast) {
      if (err) {
        return self.callback({
          code: 'ERROR_PARSE_JS',
          message: 'Error parsing "' + path + '": ' + err.stack,
          data: {
            path: path,
            error: err
          }
        });
      }


      var dependencies = [];
      try {
        _parseDependencies.bind(self)(ast, dependencies);
      } catch(e) {
        throw e;
        return self.callback({
          code: 'WRONG_USAGE_REQUIRE',
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

      dependencies.forEach(function(dep){
        self.addDependency(dep);
      });

      self.callback(null, source);
    });
}