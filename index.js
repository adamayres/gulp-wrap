'use strict';

var es = require('event-stream');
var gutil = require('gulp-util');
var tpl = require('lodash.template');
var fs = require('fs');
var PluginError = gutil.PluginError;

var PLUGIN_NAME = 'gulp-wrap';

function compile(contents, template, data, options){
  data = data !== undefined ? data : {};
  data.contents = contents;
  return tpl(template, data, options);
}

module.exports = function(opts, data, options){
  if (!opts) {
    throw new PluginError(PLUGIN_NAME, PLUGIN_NAME + ': Missing template parameter');
  }

  var template;

  if (typeof(opts) === 'object') {
    template = fs.readFileSync(opts.src, 'utf-8');
  } else {
    template = opts;
  }

  function wrap(file, callback){
    if (gutil.isStream(file.contents)) {
      var through = es.through();
      var wait = es.wait(function(err, contents){
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