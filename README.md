# commonjs-walker [![NPM version](https://badge.fury.io/js/commonjs-walker.png)](http://badge.fury.io/js/commonjs-walker) [![Build Status](https://travis-ci.org/kaelzhang/node-commonjs-walker.png?branch=master)](https://travis-ci.org/kaelzhang/node-commonjs-walker)

Analyzes and walks down the dependencies from a commonjs entry and creates a walking tree.

```js
var walker = require('commonjs-walker');
```

**NOTICE** that it will not walk down `node_modules` and any foreign packages.

## walker(entry, [options,] callback)

```js
walker('/path/to/entry.js', options, function(err, tree){
	// ...
});
```

Walks down from a entry point, such as `package.main` of commonjs, and tries to create a `walker.Module` instance of the top level. 

- entry `Path` the absolute path of the entry point.
- tree `walker.Module` tree of `walker.Module`

#### options

All options are optional. By default, `walker` works in a very strict mode.

Option | Type | Default | Description
------ | ---- | ------- | ------------
pkg    | `Object` | undefined | the object of package.json
noCheckDepVersion | `Boolean` | false | whether should check the version of foreign packages. If `options.pkg` is not specified, walker will not check versions.
noCheckCircular | `Boolean` | false | whether should check circular dependencies
noStrictRequire | `Boolean` | false | whether should check the usage of method `require()`

#### Example


## Struct: walker.Module

Actually, there is no `walker.Module` exists. We only use it to declare and describe the structure of the module.

Property | Type | Description
-------- | ---- | -----------
isEntryPoint | `Boolean` | whether the current module is the entry point
dependents   | `Array.<walker.module>` | the dependent modules
dependencies | `Array.<walker.Module>` | the dependencies of the current module. If the module has no dependencies, it will be `[]`
unsolvedDependencies | `Array.<String>` | the array contains the items `require()`d by the module.
version | `semver` | the version of the current module.
code | `String` | the file content of the current module.
path | `path` | the path of the module
isForeign | `Boolean` | whether the current module is from a foreign package.



## Class: walker.Error

- code `String` the enum type of the error
- message `String` error messages
- stack `String` the origin error.stack
- data `Object` the object of the major information of the error, this is useful for i18n.





