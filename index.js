'use strict';

var es = require('event-stream');
var gutil = require('gulp-util');
var consolidate = require('consolidate');
var fs = require('fs');
var extend = require('node.extend');
var PluginError = gutil.PluginError;

var PLUGIN_NAME = 'gulp-wrap';

function compile(file, contents, template, data, options, callback){
  options = options || {};

  if (!options.engine) {
    options.engine = 'lodash';
  }

  data = data || {};
  data.contents = contents;

  // attempt to parse the file contents for JSON or YAML files
  if (options.parse !== false) {
    try {
      if (file.path.match(/json$/)) {
        data.contents = JSON.parse(contents);
      } else if (file.path.match(/ya?ml$/)) {
        data.contents = require('js-yaml').safeLoad(contents);
      }
    } catch (err) {
      throw new PluginError(PLUGIN_NAME, PLUGIN_NAME + ': error parsing ' + file.path);
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
  data = extend(true, { file: file }, file.data, data);

  /*
   * Allow template to be a function, pass it the data object.
   */
  if (typeof template === 'function') {
    template = template(data);
  }
  data = extend(data, options);

  consolidate[options.engine].render(template, data, callback);
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
        compile(file, contents, template, data, options, function(compileErr, output) {
          if (compileErr) {
            callback(compileErr);
          } else {
            through.write(output);
            through.end();
          }
        });
      });

      file.contents.pipe(wait);
      file.contents = through;
      callback(null, file);
    } else if (gutil.isBuffer(file.contents)) {
      compile(file, file.contents.toString('utf-8'), template, data, options, function(compileErr, output) {
        if (compileErr) {
          callback(compileErr);
        } else {
          file.contents = new Buffer(output);
          callback(null, file);
        }
      });
    } else {
      callback(null, file);
    }

  }

  return es.map(wrap);
};
