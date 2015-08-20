'use strict';

var parser = exports;
var node_path = require('path');
var fs = require('fs');
var util = require('util');


// Parses a file and get its dependencies and code
parser.parse = function (path, options, callback) {
  parser.read(path, function (err, content) {
    if (err) {
      return callback(err);
    }

    parser._adaptLoader(path, content, function(err, mod){
      if(err){
        return callback(err);
      }

      callback(null, mod);
    });

    // if (parser._isJson(path)) {
    //   return callback(null, {
    //     code: content,
    //     path: path,
    //     dependencies: []
    //   });
    // }
  });
    
};

parser._adaptLoader = function(path, content){
  var LoaderContext = require('./loader-context');
  var loaders = this.loaders;
  var loader, context, result;
  for(var i = 0; i < loaders.length; i++){
    loader = loaders[i];
    if(!loader.test.test(path)){
      loaderContext = new LoaderContext(path, content, loader.loaderFn);
      loaderContext.run();
    }
  }
  return result;
}

// @returns {Boolean}
parser._isJson = function (path) {
  return /\.json$/i.test(path);
};


parser.read = function (path, callback) {
  fs.readFile(path, function (err, content) {
    if (err) {
      return callback({
        code: 'ERROR_READ_FILE',
        message: 'Error reading module "' + path + '": ' + err.stack,
        data: {
          path: path,
          error: err
        }
      });
    }

    callback(null, content);
  });
};


function locText (loc) {
  return 'Line ' + loc.line + ': Column ' + loc.column + ': ';
}


parser._throw = function (enable, message) {
  if (enable) {
    throw new Error(message);
  }
};

