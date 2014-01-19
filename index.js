'use strict';

var es = require('event-stream');
var gutil = require('gulp-util');
var tpl = require('lodash.template');
var fs = require('fs');
var PluginError = gutil.PluginError;

var PLUGIN_NAME = 'gulp-wrap';

function compile(contents, template, data, options) {
  data = data !== undefined ? data : {};
  data.contents = contents;
  return tpl(template, data, options);
}

module.exports = function (opts, data, options) {
  // The data value is read once when the plugin is initialized.
  // If it is an object the same data is used for all files.
  // If data is a string save the datatype 
  // and the string value. The mapped function must read the
  // data saved on each file in each round.
  var datatype = typeof data,
      datavalue = data;

  if (!opts) {
    throw new PluginError(PLUGIN_NAME, PLUGIN_NAME + ': Missing template parameter');
  }

  var template;

  if (typeof opts === 'object') {
    template = fs.readFileSync(opts.src, 'utf-8');
  } else {
    template = opts;
  }

  /**
   * Wrap the stream content with the given template and data
   *
   * @param {object} file The file
   * @param {function} callback The final callback to continue on the pipe
   */
  function wrap(file, callback) {
    // If data is a string the given name is treated as a property
    // on the file object. The data object is created and the 
    // file property is copied to the data object.
    if (datatype === "string") {
      var _prop = datavalue;
      data = {};
      data[_prop] = file[_prop];
    }

    if (gutil.isStream(file.contents)) {
      var through = es.through();
      var wait = es.wait(function (err, contents) {
        if (err) {
          throw new PluginError(PLUGIN_NAME, PLUGIN_NAME + ': a wait error occured');
        }
        through.write(compile(contents, template, data, options));
        through.end();
      });
      file.contents.pipe(wait);
      file.contents = through;
    }

    if (gutil.isBuffer(file.contents)) {
      file.contents = new Buffer(compile(file.contents.toString('utf-8'), template, data, options));
    }

    callback(null, file);
  }

  return es.map(wrap);
};