# fuzz-me-maybe

[![Build Status](https://travis-ci.org/rarecoil/fuzz-me-maybe.svg?branch=master)](https://travis-ci.org/rarecoil/fuzz-me-maybe) [![Known Vulnerabilities](https://snyk.io/test/github/rarecoil/fuzz-me-maybe/badge.svg?targetFile=package.json)](https://snyk.io/test/github/rarecoil/fuzz-me-maybe?targetFile=package.json) [![Dependencies](https://david-dm.org/rarecoil/fuzz-me-maybe.svg)](https://david-dm.org/)

### An environment-variable-based fuzzing harness for Node applications

**fuzz-me-maybe** is a small harness that makes instrumentation of various network protocols easily. It is a small module that offers some command-line input directly into a [radamsa](https://gitlab.com/akihe/radamsa)+[sinkdweller](https://github.com/rarecoil/sinkdweller) fuzzing system.

Using fuzz-me-maybe, you can grab an off-the-shelf module (e.g. rhea, mqtt-packet) and instrument it with this wrapper script, which will allow you to interact with the fuzzer from environment variables. This allows you to make fuzzers out of any off-the-shelf node module by hooking/instrumenting it directly, versus needing to rewrite potentially complex upstream logic.


## Basic Usage

Basic usage (no custom parameters) is as follows. Take code such as:

````js
function outputToStream(stream, data) {
    stream.write(data);
}
````

and change it to:

````js
const FuzzMeMaybe = require('fuzz-me-maybe');
let fuzzer = new FuzzMeMaybe();

function outputToStream(stream, data) {
    stream.write(fuzzer.maybe(data));
}
````

## Default environment variable control

`fuzz-me-maybe` turns **off** the fuzzer by default. This is such that it will allow tests and other systems to run unless there are explicit flags turning on the fuzzer, and lets you leave fuzzing infrastructure in place. To enable your fuzzer, you will need to set `$ENVPREFIX_ENABLED=1` on your command line (by default, this environment prefix is `FUZZER_`, so you would set `FUZZER_ENABLED=1` to turn on the fuzzer.)

If you want to show your I/O (for example, to save testcases or a log of fuzz output), you can show it by setting `$ENVPREFIX_SHOW_IO=1` on your command line to print to stdout, and `$ENVPREFIX_SHOW_IO=1 $ENVPREFIX_SHOW_IO_STDERR=1`, where `$ENVPREFIX` is either `FUZZER` (the default) or what you set with the `registerEnvironmentPrefix` method.


## Custom environment flags

`fuzz-me-maybe` allows for boolean, counted, and string matching flags. To get more functionality, tag your fuzzer calls for enable/disable:

````js
const FuzzMeMaybe = require('fuzz-me-maybe');
let fuzzer = new FuzzMeMaybe();
fuzzer.registerEnvironmentPrefix('MYFUZZER_');
fuzzer.registerFlag('output_to_stream', 'boolean', true);

function outputToStream(stream, data) {
    stream.write(fuzzer.maybe(data, 'output_to_stream'));
}
````

Now, all calls with the tag `'output_to_stream'` can be turned off on the command line by setting `MYFUZZER_OUTPUT_TO_STREAM=0`. In this case, the `maybe` method will no longer fire.


#### Integer (count) skips

You may also build integer skips:

````js
const FuzzMeMaybe = require('fuzz-me-maybe');
let fuzzer = new FuzzMeMaybe();
fuzzer.registerEnvironmentPrefix('MYFUZZER_');
fuzzer.registerFlag('output_to_stream', 'skip_first', 10);

function outputToStream(stream, data) {
    stream.write(fuzzer.maybe(data, 'output_to_stream'));
}
````

This `skip_first` flag will now skip the first `10` calls of the `output_to_stream` flag. To change this, you can set the environment variable `MYFUZZER_OUTPUT_TO_STREAM_SKIP_FIRST=20`, and then the first 20 calls will be skipped instead.


#### String skips

Similar to integer skips, you can also register a flag to not allow for specific strings:

````js
const FuzzMeMaybe = require('fuzz-me-maybe');
let fuzzer = new FuzzMeMaybe();
fuzzer.registerEnvironmentPrefix('MYFUZZER_');
fuzzer.registerFlag('output_to_stream', 'skip_string', 'ACCESS_KEY');

function outputToStream(stream, data) {
    stream.write(fuzzer.maybe(data, 'output_to_stream'));
}
````

In this case, if `data` contains the string `ACCESS_KEY`, it will not fuzz `data`. This can be changed on the command line with the environment variable `MYFUZZER_OUTPUT_TO_STREAM_SKIP_STRING="POST"`, for example, to change the skipped string to `POST` instead.

## License

MIT License.