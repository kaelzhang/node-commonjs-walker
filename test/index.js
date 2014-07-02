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
      var dep = entry.dependencies['./a'];
      expect(dep).to.equal( node_path.join(root, 'one-dep', 'a.js') );
    }
  },
  {
    desc: 'circular',
    file: 'circular/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).not.to.equal(null);
      expect(err.code).to.equal('CYCLIC_DEPENDENCY');
    }
  },
  {
    desc: 'circular',
    options: {
      detectCyclic: false
    },
    file: 'circular/index.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
    }
  },
  {
    desc: 'module not found',
    options: {
      // extFallbacks: ['.js', '.json', '.node'],
      // allowAbsolutePath: false
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
      // extFallbacks: ['.js', '.json']
    },
    file: 'not-found/three.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      expect(!!entry).to.equal(true);
    }
  },
  // {
  //   desc: 'modules and directories',
  //   options: {

  //   },
  //   file: 'not'
  // },
  {
    desc: 'error require',
    options: {

    },
    file: 'error-require/a.js',
    expect: function (err, path, nodes, entry) {
      expect(err).to.not.equal(null);
      expect(err.code).to.equal('WRONG_USAGE_REQUIRE');
    }
  }
];


describe("walker()", function(){
  cases.forEach(function (c) {
    var i = c.only
      ? it.only
      : it;

    i(c.desc, function(done){
      var file = node_path.join(root, c.file);
      walker(file, c.options || {}, function (err, nodes) {
        done();
        var entry;
        if (!err && nodes) {
          entry = nodes[file]
        }
        c.expect(err, file, nodes, entry);
      });
    });
  });

  it('let `options` be optional', function(done){
      var file = node_path.join(root, cases[0].file);
      walker(file,function(err, tree){
        done();
        cases[0].expect(err,tree);
      });
  });
});