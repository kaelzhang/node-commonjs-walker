# commonjs-walker [![NPM version](https://badge.fury.io/js/commonjs-walker.png)](http://badge.fury.io/js/commonjs-walker) [![Build Status](https://travis-ci.org/kaelzhang/node-commonjs-walker.png?branch=master)](https://travis-ci.org/kaelzhang/node-commonjs-walker)

Analyzes and walks down the dependencies from a commonjs entry and creates a walking tree.

```js
var walker = require('commonjs-walker');
```

**NOTICE** that it will not walk down `node_modules` and any foreign packages.

## Supports:

- `require()` a directory.
- if a module is not find, commonjs-walker will attempt to load the required filename with the added extension of `.js`, `.json`, and then `.node`, according to [File Modules](http://nodejs.org/api/modules.html#modules_file_modules)

## walker(entry, [options,] callback)

```js
walker('/path/to/entry.js', options, function(err, nodes){
	// ...
});
```

If the file structure of your project is (actually it is a very extreme scenario):

```
/path/to
       |-- index.js
       |-- a
       |   |-- index.json      	
```

index.js:

```js
require('./a');
require('b');
```

a/index.json

```json
{}
```

Code:

```js
walker('/path/to/index.js', function(err, tree, nodes){
	console.log(tree);
	console.log(nodes);
})
```

Then, the `nodes` object will be something like:

```js
{
	'/path/to/index.js': {
    dependents: [],
    entry: true,
    dependencies: {
      './a': '/path/to/a/index.json',
      'b': 'b'
    },
    code: <Buffer>
  },
  '/path/to/a/index.json': {
    dependents: [
      '/path/to/index.js'
    ],
    dependencies: {},
    code: <Buffer>
  },
  'b': {
    foreign: true,
    dependents: [
      '/path/to/index.js'
    ]
  }
}
```


Walks down from a entry point, such as `package.main` of commonjs, and tries to create a `walker.Module` instance of the top level. 

- entry `Path` the absolute path of the entry point.
- nodes `Object` the hashmap of `<path>: <walker.Module>`

#### options

All options are optional. By default, `walker` works in a very strict mode.

Option | Type | Default | Description
------ | ---- | ------- | ------------
detectCyclic | `Boolean` | true | whether should check cyclic dependencies
strictRequire | `Boolean` | true | whether should check the usage of method `require()`
allowAbsolutePath | `Boolean` | true | whether should allow to require an absolute path.
extFallbacks | `Array` | `['.js', '.json', '.node']` | see `options.extFallbacks` section

#### options.extFallbacks

type `Array`

When we `require()` a `path`, if `path` is not found, nodejs will attempt to load the required filename with the added extension of `.js`, `.json`, and then `.node`. [ref](http://nodejs.org/api/modules.html#modules_file_modules)

But for browser-side environment, most usually, we do not support extension `.node` which is why `options.extFallbacks`.

Especially, only tree values are allowed below:

- `['.js']`
- `['.js', '.json']`,
- `['.js', '.json', '.node']`

## Struct: walker.Module

Actually, there is no `walker.Module` exists. We only use it to declare and describe the structure of the module.

#### For All types

Property | Type | Description
-------- | ---- | -----------
id | `String` | the id of the module
ext | `String` | the extension of the file
isEntryPoint | `Boolean` | whether the current module is the entry point
dependents   | `Array.<walker.module>` | the dependent modules. If there's no dependents, it will be `[]`
isForeign | `Boolean` | whether the current module is from a foreign package.

#### If `isForeign` is `false`

Property | Type | Description
-------- | ---- | -----------
code | `Buffer` | the file content of the current module.
dependencies | `Array.<walker.Module>` | the dependencies of the current module. If the module has no dependencies, it will be `[]`
unresolvedDependencies | `Array.<String>` | the array contains the items `require()`d by the module.


## Class: walker.Error

- code `String` the enum type of the error
- message `String` error messages
- stack `String` the origin error.stack
- data `Object` the object of the major information of the error, this is useful for i18n.


## Error codes

##### NOT_ALLOW_ABSOLUTE_PATH

##### MODULE_NOT_FOUND

##### CYCLIC_DEPENDENCY


