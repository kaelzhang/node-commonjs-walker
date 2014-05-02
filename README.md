# commonjs-walker [![NPM version](https://badge.fury.io/js/commonjs-walker.png)](http://badge.fury.io/js/commonjs-walker) [![Build Status](https://travis-ci.org/kaelzhang/node-commonjs-walker.png?branch=master)](https://travis-ci.org/kaelzhang/node-commonjs-walker)

Analyzes and walks down the dependencies from a commonjs entry and creates a walking tree.

```js
var walker = require('commonjs-walker');
```

**NOTICE** that it will not walk down `node_modules` and any foreign packages.

## walker(entry, [options,] callback)

```js
walker('/path/to/entry.js', options, function(err, tree, nodes){
	// ...
});
```

If the file structure of your project is:

```
/path/to
       |--- index.js
       |--- a.js
```

index.js:

```js
require('./a');
```

a.js:

```js
// there's nothing.
```

Code:

```js
walker('/path/to/index.js', function(err, tree, nodes){
	console.log(tree);
	console.log(nodes);
})
```

Then, the `tree` object will be something like:

```js
{
	id: '/path/to/index.js',
	dependents: [],
	isEntryPoint: true,
	unsolvedDependencies: ['./a'],
	dependencies: [
		{
			id: '/path/to/a.js',
			dependents: [
				tree // points to `index.js`
			],
			dependencies: [],
			unsolvedDependencies: [],
			code: <Buffer>
		}
	],
	code: <Buffer>
}
```

The `nodes` object is the `path->node` hashmap.

```js
{
	'/path/to/index.js': tree,
	'/path/to/a.js': tree.dependencies[0]
}
```


Walks down from a entry point, such as `package.main` of commonjs, and tries to create a `walker.Module` instance of the top level. 

- entry `Path` the absolute path of the entry point.
- tree `walker.Module` tree of `walker.Module`
- nodes `Object` the hashmap of `<path>: <walker.Module>`

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
id | `String` | the id of the module
isEntryPoint | `Boolean` | whether the current module is the entry point
dependents   | `Array.<walker.module>` | the dependent modules. If there's no dependents, it will be `[]`
version | `semver` | the version of the current module.
isForeign | `Boolean` | whether the current module is from a foreign package.

**Properties only if `isForeign` is false: **

Property | Type | Description
-------- | ---- | -----------
code | `Buffer` | the file content of the current module.
dependencies | `Array.<walker.Module>` | the dependencies of the current module. If the module has no dependencies, it will be `[]`
unsolvedDependencies | `Array.<String>` | the array contains the items `require()`d by the module.




## Class: walker.Error

- code `String` the enum type of the error
- message `String` error messages
- stack `String` the origin error.stack
- data `Object` the object of the major information of the error, this is useful for i18n.





