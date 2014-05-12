'use strict';

// ```js
// require(absolute_path)
// ```
// This methods which are implemented from 
// [file modules](http://nodejs.org/api/modules.html#modules_file_modules)
// to get the real path for the `absolute_path`

// /path/to
//       |-- b.js/
//       |      |-- index.json
//       |      |-- index.js.js 
//       |-- a.js.js

// require('./b.js') -> /path/to/b.js/index.json
// require('./a.js') -> /path/to/a.js.js
// require('./a')    -> MODULE_NOT_FOUND

// @param {function(real)} callback
// - real {path|null} if the module is not found, `real` will be null.

// NOTICE `mod` will throw no errors.
function mod (path, exts, callback) {
  mod._isDir(path, function (isDir) {
    if (isDir) {
      return mod.dir(path, exts, callback);
    }

    mod.file(path, exts, callback);
  });
}


// Suppose the path is a directory, try to get the real path
mod.dir = function (path, exts, callback) {
  mod._getPotentialMainEntries(path, exts, function (tries) {
    mod._tryFile(tries, callback);
  });
};


// Suppose the path is a file, try to get the real path
mod.file = function (path, exts, callback) {
  var tries = mods._fileFallbacks([path], exts);
  mod._tryFile(tries, callback);
};


mod._isDir = function(path, callback) {
  fs.stat(path, function (err, stat) {
    if (err) {
      return callback(false);
    }

    callback(stat.isDirectory());
  });
};


mod._isFile = function(path, callback) {
  fs.stat(path, function (err, stat) {
    if (err) {
      return callback(false);
    }

    callback(stat.isFile());
  });
};


// Gets the potential main entries of a dir
// @param {path} dir must be an absolute path
mod._getPotentialMainEntries = function(dir, exts, callback) {
  var package_json = node_path.join(dir, 'package.json');
  var self = this;

  function cb (tries) {
    callback(self._fileFallbacks(tries, exts));
    exts = null;
  }

  // `package.main` is default to `index` NOT `index.js`
  var index = node_path.join(dir, 'index');
  fse.readJson(package_json, function (err, json) {
    // if package.json not found, or not valid
    // use `index`
    if (err) {
      return cb([index]);
    }

    var main = json.main;
    // if 'main' not found in package.json, use `index`
    if (!main) {
      return cb([index]);
    }

    main = node_path.join(dir, main);
    // If the file of `package.main` no found,
    // then try `index`
    return cb([main, index]);
  });
};


// ['index', 'a.js'] -> 
// [
//   'index', 'index.js', 'index.json', 'index.node',
//   'a.js', 'a.js.js', 'a.js.json', 'a.js.node'
// ]
mod._fileFallbacks = function(files, exts) {
  return files.reduce(function (prev, current) {
    prev.push(current);
    var fallbacks = exts.map(function (ext) {
      return current + ext;
    });

    return prev.concat(fallbacks);

  }, []);
};


// Attempt to check there's at least of files in the list exists.
// If exists, returns the first existing file.
Walker.prototype._tryFile = function(files, callback) {

};

