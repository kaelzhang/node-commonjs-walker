'use strict';

var expect = require('chai').expect;
var parser = require('../lib/parser');
var node_path = require('path');
var util = require('util');
var fs = require('fs');

var cases = [
  {
    desc: 'could get dependencies',
    file: 'correct.js',
    options: {
      check_require_length: true
    },
    deps: ['../abc', 'abc', './abc']
  }, 
  {
    desc: 'no arguments, strict',
    file: 'no-arg.js',
    options: {
      check_require_length: true
    },
    error: true
  }, 
  {
    desc: 'no arguments, no strict',
    file: 'no-arg.js',
    options: {
    },
    deps: ['abc']
  }, 
  {
    desc: 'more than one arguments, strict',
    file: 'more-than-one-arg.js',
    options: {
      check_require_length: true
    },
    error: true

  }, 
  {
    desc: 'more than one arguments, no strict',
    file: 'more-than-one-arg.js',
    options: {
    },
    deps: ['../abc', './abc']
  },
  {
    desc: 'parsing a json file will fail',
    file: 'json.json',
    error: true
  },
  {
    only: true,
    desc: '#26: allow return statement',
    file: 'return.js',
    options: {},
    deps: ['..']
  }
];

describe("parser.parse()", function(){
  cases.forEach(function (c) {
    var _it = c.only
      ? it.only
      : it

    _it(c.desc, function(done) {
      var file = node_path.join(__dirname, 'fixtures', 'parser', c.file);
      parser.parse(file, fs.readFileSync(file).toString(), c.options || {}, function (err, result) {
        done();
        expect(!err).to.equal(!c.error); 
        if (util.isArray(c.deps)) {
          expect(result.require.sort()).to.deep.equal(c.deps.sort());
        }
      });
    });
  });
});