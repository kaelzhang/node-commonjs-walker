'use strict';

var expect = require('chai').expect;
var circular = require('../lib/circular');


describe("circular.trace()", function(){
  it("should not fuck himself", function(){
    var a = {};
    var result = circular.trace(a, a);
    expect(result).to.equal(null);
  });

  it("no match", function(){
    var a = {};
    var b = {}

    var result = circular.trace(a, b);
    expect(result).to.equal(null);
  });

  it("a longer link, but no match", function(){
    var a = {};
    var b = {
      dependents: [
        {
          dependents: [
            {}
          ]
        },

        {}
      ]
    };

    var result = circular.trace(a, b);
    expect(result).to.equal(null);
  });

  it("matches", function(){
    var a = {
      name: 'a'
    };
    var b = {
      name: 'b',
      dependencies: [
        {
          name: 'c',
          dependencies: [
            {
              name: 'd'
            },

            a
          ]
        },

        {
          name: 'e'
        }
      ]
    };

    var result = circular.trace(b, a).map(function (item) {
      return item.name;
    });
    expect(result).to.deep.equal(['a', 'b', 'c', 'a']);
  });
});