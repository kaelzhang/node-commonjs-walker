'use strict';

var circular = exports;


// @param {Object} current The relative node 
// @param {Object} target The node to be tested
// @returns
// - null if no circle
// - `Array` if has a circle
circular.trace = function (current, target) {
  var trace = [current];

  if (current === target) {
    return null;
  }

  return circular.lookBack(current, target, trace);
};


circular.lookBack = function (relative, target, trace) {
  trace.push(target);

  if (relative === target) {
    return trace;
  }


  // if meets the end, just pop.
  if (!target.dependents || target.dependents.length === 0) {
    trace.pop();
    return null;
  }

  var found = target.dependents.some(function (new_target) {
    return circular.lookBack(relative, new_target, trace);
  });

  if (!found) {
    // If not found, recursively pop()
    trace.pop();
    return null;
  }

  return trace;
};