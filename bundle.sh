#!/bin/sh
bundle_output="../symphonybundle.js"
if [ "$#" -ge 1 ]; then
	bundle_output=$1
fi
echo "outputting to $bundle_output"
browserify symphony.js > $bundle_output
