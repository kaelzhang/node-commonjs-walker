# commonjs-walker [![NPM version](https://badge.fury.io/js/commonjs-walker.png)](http://badge.fury.io/js/commonjs-walker) [![Build Status](https://travis-ci.org/kaelzhang/node-commonjs-walker.png?branch=master)](https://travis-ci.org/kaelzhang/node-commonjs-walker)

Analyzes and walks down the dependencies from a commonjs entry and creates a walking tree.

```js
var walker = require('commonjs-walker');
```

**NOTICE** that it will not walk down `node_modules` and any foreign packages.

## walker(entry, options, callback)

```js
walker('/path/to/main.js', options, function(err, module){
	// ...
});
```

Walks down from a entry point, such as `package.main` of commonjs, and tries to create a `walker.Module` instance of the top level. 

- entry `Path` the absolute path of the entry point.
- options `Object={}`
	- pkg `Object=` the object of package.json. by default, `walker` 
	- noCheckDeps `Boolean=false`
	- noCheckCircular `Boolean=false`
- err `Error` the `walker.Error` object
- module `walker.Module`


## Class: walker.Module

### .parent()

Returns `walker.Module` the parent module node. If is the module of the entry point, this method will returns `null`

### .isEntryPoint()

Returns `Boolean` whether the current module is the entry point

### .dependencies()

Returns `Array.<walker.Module>` the shadow copy of the dependencies of the current module

### .version()

Returns `semver` the version of the current module

### .isForeign()

Returns `Boolean` whether the current module is from a foreign package.


## Class: walker.Error

- code `String` the enum type of the error
- message `String` error messages
- stack `String` the origin error.stack
- data `Object` the object of the major information of the error, this is useful for i18n.





