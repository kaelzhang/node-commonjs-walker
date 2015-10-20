'use strict';

module.exports = walker;

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
  makeDefault(options, 'concurrency',               100);
  makeDefault(options, 'as',                        {});

  return new Walker(options);
}


function makeDefault (object, key, value) {
  object[key] = key in object
    ? object[key]
    : value
}
