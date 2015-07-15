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
circular.trace = function (from, to, nodes) {
  var trace = [to];

  if (from === to) {
    return null;
  }

  return circular.lookBack(from, to, trace, nodes);
};


circular.lookBack = function (from, to, trace, nodes) {
  trace.push(from);

  if (from === to) {
    return trace;
  }

  var dependencies = from.dependencies;
  var deps_array = dependencies
    ? Object.keys(dependencies)
    : [];

  // if meets the end, just pop.
  if (deps_array.length === 0) {
    trace.pop();
    return null;
  }

  var found = deps_array.some(function (dep) {
    var dep_path = dependencies[dep];
    var new_from = nodes[dep_path];
    return circular.lookBack(new_from, to, trace, nodes);
  });

  if (!found) {
    // If not found, recursively pop()
    trace.pop();
    return null;
  }

  return trace;
};
