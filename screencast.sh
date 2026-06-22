#!/bin/bash

adb exec-out screenrecord --output-format=h264 --time-limit 0 --bugreport - | ffplay -framerate 30 -f h264 -

