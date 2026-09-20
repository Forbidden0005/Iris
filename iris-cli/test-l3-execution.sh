#!/bin/bash

# Test that standalone mode executes L3 workers instead of dispatching to iris-main

cd "$(dirname "$0")"

echo "Testing L3 execution in standalone mode..."
echo ""

# Make sure we're in standalone mode
export IRIS_INTERFACE_MODE=standalone

# Run a simple coding task that should execute at L3
node bin/iris.js chat "create a hello.js file that exports a greet function" 2>&1 | tee /tmp/iris-l3-test.log

# Check the output for signs of L3 execution
if grep -q "L3 Execute" /tmp/iris-l3-test.log || grep -q "unified-pipeline" /tmp/iris-l3-test.log; then
  echo ""
  echo "✅ SUCCESS: L3 execution detected"
  exit 0
elif grep -q "iris-main" /tmp/iris-l3-test.log; then
  echo ""
  echo "❌ FAIL: Still routing to iris-main instead of L3"
  exit 1
else
  echo ""
  echo "⚠️  UNCLEAR: Check /tmp/iris-l3-test.log for details"
  exit 2
fi
