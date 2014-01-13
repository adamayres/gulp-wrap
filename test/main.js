'use strict';

var fs = require('fs'),
    es = require('event-stream'),
    should = require('should');

require('mocha');

var gutil = require('gulp-util'),
    wrap = require('../');

describe('gulp-wrap', function () {

  var expectedFile = new gutil.File({
    path: 'test/expected/hello.txt',
    cwd: 'test/',
    base: 'test/expected',
    contents: fs.readFileSync('test/expected/hello.txt')
  });

  it('should produce expected file via buffer', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

    var stream = wrap('BEFORE <%= contents %> AFTER');

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal(String(expectedFile.contents));
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

  it('should produce expected file via stream', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.createReadStream('test/fixtures/hello.txt')
    });

    var stream = wrap('BEFORE <%= contents %> AFTER');

    stream.on('error', function (err) {
      should.exist(err);
      done();
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      newFile.contents.pipe(es.wait(function (err, data) {
        should.not.exist(err);
        data.should.equal(String(expectedFile.contents));
        done();
      }));
    });

    stream.write(srcFile);
    stream.end();
  });

  it('should error when no template is provided', function () {
    (function(){
      wrap();
    }).should.throw('gulp-wrap: Missing template parameter');
  });

  it('should handle a template from a file src via buffer', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

    var stream = wrap({src: 'test/fixtures/template.txt'});

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal(String(expectedFile.contents));
      done();
    });

    stream.write(srcFile);
    stream.end();

  });

  it('should handle template data and options', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

    var stream = wrap('BEFORE <%= data.contents %> <%= data.someVar %> AFTER', { someVar: 'someVal'}, { variable: 'data' });

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal('BEFORE Hello someVal AFTER');
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

});
