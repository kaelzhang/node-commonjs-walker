'use strict';

var expect = require('chai').expect;
var walker = require('../');
var node_path = require('path');
var util = require('util');

var root = node_path.join(__dirname, 'fixtures', 'walker');

var cases = [
  {
    desc: 'only foreign deps',
    file: 'simplest.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      expect(entry.code.toString()).to.equal("require('abc');");
      expect(nodes['abc'].foreign).to.equal(true);
    }
  },
  {
    desc: 'one dep',
    file: 'one-dep/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = entry.require['./a'];
      expect(dep).to.equal( node_path.join(root, 'one-dep', 'a.js') );
    }
  },
  {
    desc: 'circular',
    file: 'circular/index.js',
    options: {
      allow_cyclic: false
    },
    expect: function (err, path, nodes, entry) {
      expect(err).not.to.equal(null);
      expect(err.code).to.equal('CYCLIC_DEPENDENCY');
    }
  },
  {
    desc: 'circular',
    options: {
      allow_cyclic: true
    },
    file: 'circular/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
    }
  },
  {
    desc: 'module not found',
    options: {
    },
    file: 'not-found/one.js',
    expect: function (err, path, nodes, entry) {
      expect(err.code).to.equal('MODULE_NOT_FOUND');
    }
  },
  {
    desc: 'module not found: fallback, still not found',
    options: {},
    file: 'not-found/two.js',
    expect: function (err, path, nodes, entry) {
      expect(err.code).to.equal('MODULE_NOT_FOUND');
    }
  },
  {
    desc: 'module not found: limited by exts',
    options: {
      extensions: ['.js', '.json']
    },
    file: 'not-found/three.js',
    expect: function (err, path, nodes, entry) {
      expect(err.code).to.equal('MODULE_NOT_FOUND');
    }
  },
  {
    desc: 'if not limited, could be found',
    options: {
    },
    file: 'not-found/three.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      expect(!!entry).to.equal(true);
    }
  },
  {
    desc: 'error require',
    file: 'error-require/a.js',
    options: {
      check_require_length: true
    },
    expect: function (err, path, nodes, entry) {
      expect(err).to.not.equal(null);
      expect(err.code).to.equal('WRONG_USAGE_REQUIRE');
    }
  },
  {
    desc: 'modules: no-fallback',
    file: 'fallback/no-fallback.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = './cases/no-fallback';
      var real = node_path.join( node_path.dirname(path), dep );
      expect(entry.require[dep]).to.equal(real);
    }
  },
  {
    desc: 'modules: no-fallback not found',
    file: 'fallback/no-fallback-not-found.js',
    expect: function (err, path, nodes, entry) {
      expect(err.code).to.equal('MODULE_NOT_FOUND');
    }
  },
  {
    desc: 'modules: fallback',
    file: 'fallback/fallback.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = './cases/fallback';
      var real = node_path.join( node_path.dirname(path), dep ) + '.js';
      expect(entry.require[dep]).to.equal(real);
    }
  },
  {
    desc: 'modules: exact, no fallback',
    file: 'fallback/fallback-exact.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = './cases/fallback.js';
      var real = node_path.join( node_path.dirname(path), dep );
      expect(entry.require[dep]).to.equal(real);
    }
  },
  {
    desc: 'modules: falback to json',
    file: 'fallback/fallback-json.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = './cases/fallback-json';
      var real = node_path.join( node_path.dirname(path), dep ) + '.json';
      expect(entry.require[dep]).to.equal(real);
    }
  },
  {
    desc: 'modules: falback to node',
    options: {
    },
    file: 'fallback/fallback-node.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = './cases/fallback-node';
      var real = node_path.join( node_path.dirname(path), dep ) + '.node';
      expect(entry.require[dep]).to.equal(real);
    }
  },
  {
    desc: 'modules: falback to node, without `".node"` extension',
    options: {
      extensions: ['.js', '.json']
    },
    file: 'fallback/fallback-node.js',
    expect: function (err, path, nodes, entry) {
      expect(err.code).to.equal('MODULE_NOT_FOUND');
    }
  },

  {
    desc: 'directories: dir without ending slash',
    options: {
    },
    file: 'fallback/dir.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = './cases/dir';
      var real = node_path.join( node_path.dirname(path), dep ) + node_path.sep + 'index.js';
      expect(entry.require[dep]).to.equal(real);
    }
  },
  {
    desc: 'directories: dir with ending slash',
    options: {
    },
    file: 'fallback/dir-slash.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var dep = './cases/dir/';
      var real = node_path.join( node_path.dirname(path), dep ) + 'index.js';
      expect(entry.require[dep]).to.equal(real);
    }
  },
  {
    desc: '#13: multiple requires',
    options: {
    },
    file: 'multi-require/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
    }
  },
  {
    desc: '#14: parsing a json file will not fail',
    file: 'json/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
    }
  },
  {
    desc: '#15: package.as',
    options: {
      'as': {
        'a': './a'
      }
    },
    file: 'as/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var a = node_path.join( node_path.dirname(path), 'a.js' );
      expect('a' in entry.require).to.equal(true);
      expect(entry.require['a']).to.equal(a);
    }
  },
  {
    desc: '#15: package.as, foreign',
    options: {
      'as': {
        'a': 'b'
      }
    },
    file: 'as/foreign.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      expect(entry.require['a']).to.equal('b');
    }
  },
  {
    desc: '#17: deep deps of package.as',
    options: {
      'as': {
        'abc': './deep/dep.js'
      },
      cwd: node_path.join(root, 'as')
    },
    file: 'as/deep/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      expect(entry.require['abc']).to.equal(node_path.join(node_path.dirname(path), './dep.js'));
    }
  },
  {
    desc: '#21: require.resolve',
    options: {
    },
    file: 'require-resolve/entry.js',
    expect: function (err, path, nodes, entry) {
      expect(entry.resolve['./a']).to.equal(node_path.join(node_path.dirname(path), './a'));
      expect(entry.resolve['./b']).to.equal(node_path.join(node_path.dirname(path), './b.js'));
      expect(entry.require['./c']).to.equal(node_path.join(node_path.dirname(path), './c.js'));
    }
  },
  {
    desc: '#21: require.resolve: false',
    options: {
      require_resolve: false
    },
    file: 'require-resolve/entry.js',
    expect: function (err, path, nodes, entry) {
      expect('./a' in entry.resolve).to.equal(false);
      expect('./b' in entry.resolve).to.equal(false);
      expect(entry.require['./c']).to.equal(node_path.join(node_path.dirname(path), './c.js'));
    }
  },
  {
    desc: '#21: require.async',
    options: {
    },
    file: 'require-async/entry.js',
    expect: function (err, path, nodes, entry) {
      expect(entry.async['./a']).to.equal(node_path.join(node_path.dirname(path), './a'));
      expect(entry.async['./b']).to.equal(node_path.join(node_path.dirname(path), './b.js'));
      expect(entry.require['./c']).to.equal(node_path.join(node_path.dirname(path), './c.js'));
    }
  },
  {
    desc: '#21: require.async: false',
    options: {
      require_async: false
    },
    file: 'require-async/entry.js',
    expect: function (err, path, nodes, entry) {
      expect('./a' in entry.async).to.equal(false);
      expect('./b' in entry.async).to.equal(false);
      expect(entry.require['./c']).to.equal(node_path.join(node_path.dirname(path), './c.js'));
    }
  }, {
    desc: '#21: require in comments',
    options: {
    },
    file: 'require-async/entry-comment.js',
    expect: function (err, path, nodes, entry) {
      expect(entry.require['./a']).to.equal(node_path.join(node_path.dirname(path), './a'));
      expect(entry.resolve['./b']).to.equal(node_path.join(node_path.dirname(path), './b.js'));
      expect(entry.async['./c.js']).to.equal(node_path.join(node_path.dirname(path), './c.js'));
    }
  }
];


describe("walker()", function(){
  cases.forEach(function (c) {
    var i = c.only
      ? it.only
      : it;

    function run (noOptions) {
      var desc = c.desc;
      var options = c.options || {};

      if (noOptions) {
        if (Object.keys(options).length !== 0) {
          return;
        }

        desc += ': no argument `options`';
      }

      i(desc, function(done){
        var file = node_path.join(root, c.file);
        
        var callback = function (err, nodes) {
          done();
          var entry;
          if (!err && nodes) {
            entry = nodes[file]
          }
          c.expect(err, file, nodes, entry);
        };

        if (noOptions) {
          walker(file, callback).walk();
        } else {
          walker(file, options, callback).walk();
        }
      });
    }

    run();
    run(true);
  });
});