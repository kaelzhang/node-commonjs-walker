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
    expect: function (err, tree) {
      expect(err).to.equal(null);
      expect(tree.code.toString()).to.equal("require('abc');");
      expect(tree.dependencies[0].isForeign).to.equal(true);
    }
  },
  {
    desc: 'one dep',
    file: 'one-dep/index.js',
    expect: function (err, tree) { console.log(err)
      expect(err).to.equal(null);

      var dep = tree.dependencies[0];
      expect(dep.id).to.equal( node_path.join(root, 'one-dep', 'a.js') );
    }
  }
];


describe("walker()", function(){
  cases.forEach(function (c) {
    it(c.desc, function(done){
      var file = node_path.join(root, c.file);
      walker(file, c.options || {}, function (err, tree) {
        done();
        c.expect(err, tree);
      });
    });
  });
});

