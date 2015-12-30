'use strict';

var expect = require('chai').expect;
var walker = require('../');
var node_path = require('path');
var util = require('util');

var jade_compiler = require('neuron-jade-compiler');
var root = node_path.join(__dirname, 'fixtures', 'compiler');

function filename (file) {
  return node_path.join(root, file);
}

var cases = [
  {
    desc: 'files to be compiled, that contains dependency',
    file: 'jade/index.js',
    compilers: {
      test: /\.jade$/,
      compiler: jade_compiler
    },
    expect: function (err, path, nodes, entry) {
      expect(err).to.equal(null);
      var jade = filename('jade/a.jade');
      expect(jade in nodes).to.equal(true);
    }
  }
];

describe("walker(): with compiler", function(){
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
        var file = filename(c.file)
        
        var callback = function (err, nodes) {
          done();
          var entry;
          if (!err && nodes) {
            entry = nodes[file];
          }
          c.expect(err, file, nodes, entry);
        };

        var w;
        if (noOptions) {
          var w = walker();
        } else {
          var w = walker(options);
        }

        if (c.compilers) {
          w.register(c.compilers);
        }

        w.walk(file).done(callback);
      });
    }

    run();
    run(true);
  });
});