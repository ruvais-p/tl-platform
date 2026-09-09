// Make array literals evaluate to plain JS arrays instead of math.js Matrix
// objects, so downstream code can use ordinary Array.isArray()/indexing.
math.config({ matrix: 'Array' });
