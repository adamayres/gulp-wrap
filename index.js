'use strict';

var es = require('event-stream');
var gutil = require('gulp-util');
var tpl = require('lodash.template');
var fs = require('fs');
var extend = require('node.extend');
var PluginError = gutil.PluginError;

var PLUGIN_NAME = 'gulp-wrap';

function compile(file, contents, template, data, options){
  options = options || {};

  data = data || {};
  data.contents = contents;

  // attempt to parse the file contents for JSON or YAML files
  if (options.parse !== false) {
    try {
      if (file.path.match(/json$/))
        data.contents = JSON.parse(contents)
      else if (file.path.match(/ya?ml$/))
        data.contents = require('js-yaml').safeLoad(contents)
    } catch (err) {
      throw new PluginError(PLUGIN_NAME, PLUGIN_NAME + ': error parsing ' + file.path)
    }
  }

  /*
   * Add `file` field to source obj used when interpolating
   * the template. Ensure the user supplied data object is not
   * augmented to prevent file prop leakage across multiple
   * streams. Properties specified in the user supplied data
   * object should take precedence over properties supplied
   * by the file.
   */
  data = extend(true, { file: file }, data);
  /*
   * Allow template to be a function, pass it the data object.
   */
  if (typeof template === 'function') {
    template = template(data);
  }
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
        through.write(compile(file, contents, template, data, options));
        through.end();
      });

      file.contents.pipe(wait);
      file.contents = through;
    }

    if (gutil.isBuffer(file.contents)) {
      file.contents = new Buffer(compile(file, file.contents.toString('utf-8'), template, data, options));
    }

    callback(null, file);
  }

  return es.map(wrap);
};
