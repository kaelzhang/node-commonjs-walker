'use strict';

var circular = exports;


// @param {Object} from The from node, the spring generations
// @param {Object} to The node to be tested, the ancestors
// @returns
// - null if no circle
// - `Array` if has a circle
circular.trace = function (from, to) {
  var trace = [from];

  if (from === to) {
    return null;
  }

  return circular.lookBack(from, to, trace);
};


circular.lookBack = function (from, to, trace) {
  trace.push(to);

  if (from === to) {
    return trace;
  }


  // if meets the end, just pop.
  if (!to.dependents || to.dependents.length === 0) {
    trace.pop();
    return null;
  }

  var found = to.dependents.some(function (new_to) {
    return circular.lookBack(from, new_to, trace);
  });

  if (!found) {
    // If not found, recursively pop()
    trace.pop();
    return null;
  }

  return trace;
};