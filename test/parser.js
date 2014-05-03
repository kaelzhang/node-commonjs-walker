'use strict';

var expect = require('chai').expect;
var parser = require('../lib/parser');
var node_path = require('path');
var util = require('util');

var cases = [
  {
    desc: 'could get dependencies',
    file: 'correct.js',
    options: {
      strictRequire: true
    },
    deps: ['../abc', 'abc', './abc']

  }, {
    desc: 'no arguments, strict',
    file: 'no-arg.js',
    options: {
      strictRequire: true
    },
    error: true

  }, {
    desc: 'no arguments, no strict',
    file: 'no-arg.js',
    options: {
      strictRequire: false
    },
    deps: ['abc']
  
  }, {
    desc: 'more than one arguments, strict',
    file: 'more-than-one-arg.js',
    options: {
      strictRequire: true
    },
    error: true

  }, {
    desc: 'more than one arguments, no strict',
    file: 'more-than-one-arg.js',
    options: {
      strictRequire: false
    },
    deps: ['../abc', './abc']
  }
];

describe("parser.parse()", function(){
  cases.forEach(function (c) {
    it(c.desc, function(done){
      var file = node_path.join(__dirname, 'fixtures', 'parser', c.file);
      parser.parse(file, c.options || {}, function (err, result) {
        done();
        expect(!err).to.equal(!c.error); 
        if (util.isArray(c.deps)) {
          expect(result.dependencies.sort()).to.deep.equal(c.deps.sort());
        }
      });
    });
  });
});