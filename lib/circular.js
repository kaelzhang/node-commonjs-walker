'use strict';

var circular = exports;

// Scenario:
// One day, `to` depends on `from`,
// So we suppose that there is a trace goes back the dependency chain 
// from `from` up to `to`:
// ```
// 
// ```


// @param {Object} from The from node, the spring generations
// @param {Object} to The node to be tested, the ancestors
// @returns
// - null if no circle
// - `Array` if has a circle
circular.trace = function (from, to) {
  var trace = [to];

  if (from === to) {
    return null;
  }

  return circular.lookBack(from, to, trace);
};


circular.lookBack = function (from, to, trace) {
  trace.push(from);

  if (from === to) {
    return trace;
  }


  // if meets the end, just pop.
  if (!from.dependencies || from.dependencies.length === 0) {
    trace.pop();
    return null;
  }

  var found = from.dependencies.some(function (new_from) {
    return circular.lookBack(new_from, to, trace);
  });

  if (!found) {
    // If not found, recursively pop()
    trace.pop();
    return null;
  }

  return trace;
};