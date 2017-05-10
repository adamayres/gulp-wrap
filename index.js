'use strict';

var path = require('path');

var consolidate = require('consolidate');
var extend = require('node.extend');
var PluginError = require('gulp-util').PluginError;
var ES6Promise = global.Promise || require('es6-promise').Promise;
var readFile = require('fs-readfile-promise');
var through = require('through2');
var tryit = require('tryit');
var VinylBufferStream = require('vinyl-bufferstream');
consolidate.requires.lodash = require('lodash');

var PLUGIN_NAME = 'gulp-wrap';

module.exports = function gulpWrap(opts, data, options) {
  var promise;
  if (typeof opts === 'object') {
    if (typeof opts.src !== 'string') {
      throw new PluginError(PLUGIN_NAME, new TypeError('Expecting `src` option.'));
    }
    promise = readFile(opts.src, 'utf8');
  } else {
    if (typeof opts !== 'string' && typeof opts !== 'function') {
      throw new PluginError(PLUGIN_NAME, 'Template must be a string or a function.');
    }

    promise = ES6Promise.resolve(opts);
  }

  return through.obj(function gulpWrapTransform(file, enc, cb) {
    function compile(contents, done) {
      var currentData = data;
      if (typeof currentData === 'function') {
        currentData = currentData.call(null, file);
      }

      if (typeof options === 'function') {
        options = options.call(null, file);
      }

      currentData = currentData || {};
      options = options || {};

      if (!options.engine) {
        options.engine = 'lodash';
      }

      // attempt to parse the file contents for JSON or YAML files
      if (options.parse !== false) {
        var ext = path.extname(file.path).toLowerCase();

        tryit(function() {
          if (ext === '.json') {
            contents = JSON.parse(contents);
          } else if (ext === '.yml' || ext === '.yaml') {
            contents = require('js-yaml').safeLoad(contents);
          }
        }, function(err) {
          if (!err) {
            return;
          }
          throw new PluginError(PLUGIN_NAME, 'Error parsing ' + file.path);
        });
      }

      currentData = extend({file: file}, options, currentData, file.data, {contents: contents});

      promise.then(function(template) {
        if (typeof template === 'function') {
          template = template(currentData);
        }

        consolidate[options.engine].render(template, currentData, function(err, result) {
          if (err) {
            done(new PluginError(PLUGIN_NAME, err));
            return;
          }
          done(null, new Buffer(result));
        });
      }, done).catch(done);
    }

    var run = new VinylBufferStream(compile);
    var self = this;

    run(file, function(err, contents) {
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
