'use strict';

var expect = require('chai').expect;
var utils = require('../walker');
var node_path = require('path');
var util = require('util');

var cases = [
  {
    desc: 'could get dependencies',
    file: 'correct.js',
    deps: ['../abc', 'abc', './abc']

  }, {
    desc: 'no arguments, strict',
    file: 'no-arg.js',
    error: true

  }, {
    desc: 'no arguments, no strict',
    file: 'no-arg.js',
    options: {
      noStrictRequire: true
    },
    deps: ['abc']
  
  }, {
    desc: 'more than one arguments, strict',
    file: 'more-than-one-arg.js',
    error: true

  }, {
    desc: 'more than one arguments, no strict',
    file: 'more-than-one-arg.js',
    options: {
      noStrictRequire: true
    },
    deps: ['../abc', './abc']
  }
];

describe("_walker.get_dependencies()", function(){
  cases.forEach(function (c) {
    it(c.desc, function(done){
      var file = node_path.join(__dirname, 'fixtures', 'single', c.file);
      utils.get_dependencies(file, c.options || {}, function (err, dependencies) {
        done();
        expect(!err).to.equal(!c.error); 
        if (util.isArray(c.deps)) {
          expect(dependencies.sort()).to.deep.equal(c.deps.sort());

        } else {
          expect(dependencies).to.equal(c.deps);
        }
      });
    });
  });
});