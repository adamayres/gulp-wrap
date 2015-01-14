'use strict';

var path = require('path');

var BufferStreams = require('bufferstreams');
var consolidate = require('consolidate');
var extend = require('node.extend');
var fs = require('graceful-fs');
var PluginError = require('gulp-util').PluginError;
var through = require('through2');

var PLUGIN_NAME = 'gulp-wrap';

module.exports = function(opts, data, options){
  if (!opts) {
    throw new PluginError(PLUGIN_NAME, PLUGIN_NAME + ': Missing template parameter');
  }

  var template;

  if (typeof opts === 'object') {
    if (typeof opts.src !== 'string') {
      throw new PluginError(PLUGIN_NAME, 'Expecting `src` option.');
    }
    template = fs.readFileSync(opts.src, 'utf8');
  } else {
    template = opts;
  }
  
  data = data || {};
  options = options || {};

  if (!options.engine) {
    options.engine = 'lodash';
  }

  return through.obj(function(file, enc, cb){
    var self = this;

    if (file.isNull()) {
      cb(null, file);
      return;
    }

    function compile(contents, done){
      // attempt to parse the file contents for JSON or YAML files
      if (options.parse !== false) {
        var ext = path.extname(file.path).toLowerCase();
        
        try {
          if (ext === '.json') {
            contents = JSON.parse(contents);
          } else if (ext === '.yml' || ext === '.yaml' ) {
            contents = require('js-yaml').safeLoad(contents);
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
      var newData = extend({ file: file }, options, data, file.data, { contents: contents });

      /*
       * Allow template to be a function, pass it the data object.
       */
      if (typeof template === 'function') {
        template = template(newData);
      }

      consolidate[options.engine].render(template, newData, function(err, result) {
        if (err) {
          done(new PluginError(PLUGIN_NAME, err));
          return;
        }

        done(null, new Buffer(result));
      });
    }

    if (file.isStream()) {
      file.contents = file.contents.pipe(new BufferStreams(function(none, buf, done) {
        compile(buf, function(err, contents){
          if (err) {
            self.emit('error', err);
            done(err);
          } else {
            done(null, contents);
            self.push(file);
          }
          cb();
        });
      }));
      return;
    };

    compile(file.contents, function(err, contents) {
      if (err) {
        self.emit('error', err);
      } else {
        file.contents = contents;
        self.push(file);
      }
      cb();
    });
  });
};
