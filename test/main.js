'use strict';

var fs = require('fs');
var es = require('event-stream');
var should = require('should');

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

  it('should allow file props in the template data', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

    srcFile.someProp = 'someValue';

    var stream = wrap('Contents: [<%= contents %>] - File prop: [<%= file.someProp %>]');

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal('Contents: [Hello] - File prop: [someValue]');
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

  it('should make data props override file data', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

    srcFile.someProp = 'someValue';

    var stream = wrap('Contents: [<%= contents %>] - File prop: [<%= file.someProp %>]', {
      file: {
        someProp: 'valueFromData'
      }
    });

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal('Contents: [Hello] - File prop: [valueFromData]');
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

  it('should not pollute file data across multiple streams', function (done) {

    var srcFile1 = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

    srcFile1.somePropFor1 = 'someValueFrom1';

    var srcFile2 = new gutil.File({
      path: 'test/fixtures/hello2.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello2.txt')
    });

    srcFile2.somePropFor2 = 'someValueFrom2';

    var stream = wrap('Contents: [<%= contents %>] - File prop from 1: [<%= file.somePropFor1 %>] - File prop from 2: [<%= file.somePropFor2 %>]');

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      if (newFile.relative === 'hello.txt') {
        String(newFile.contents).should.equal('Contents: [Hello] - File prop from 1: [someValueFrom1] - File prop from 2: []');
      } else if (newFile.relative === 'hello2.txt') {
        String(newFile.contents).should.equal('Contents: [Hello2] - File prop from 1: [] - File prop from 2: [someValueFrom2]');
      }
    });

    stream.write(srcFile1);
    stream.write(srcFile2);

    stream.end();
    done();
  });

  it('should merge file.data property', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

    srcFile.data = {
      someProp1: 'someValue1',
      someProp2: 'someValue2',
    };

    var stream = wrap('Contents: [<%= contents %>] - File prop: [<%= someProp1 %>] [<%= someProp2 %>]');

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal('Contents: [Hello] - File prop: [someValue1] [someValue2]');
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

  it('should allow for expressions', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/hello.txt',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/hello.txt')
    });

//    file.path => path/to/foo.png
//    dirname   => to
//    basename  => foo.png
//    filename  => foo
//    extension => png
    var stream = wrap('<%= path.dirname(file.path) %> ; <%= path.basename(file.path) %> ; <%= path.basename(file.path).split(path.extname(file.path))[0] %>, <%= path.extname(file.path) %>', { file: { path: 'path/to/foo.png'}}, { imports: { path: require('path') }});

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      console.log(String(newFile.contents))
      //String(newFile.contents).should.equal(String(expectedFile.contents));
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

  it('should parse JSON files by default', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/data.json',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/data.json')
    });

    var stream = wrap('BEFORE <%= contents.name %>: <%= contents.job %> AFTER');

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal('BEFORE Roget: Thesaurus AFTER');
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

  it('should parse YAML files by default', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/data.yml',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/data.yml')
    });

    var stream = wrap('BEFORE <%= contents.name %>: <%= contents.job %> AFTER');

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal('BEFORE Roget: Thesaurus AFTER');
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

  it('option parse=false should disable file parsing', function (done) {

    var srcFile = new gutil.File({
      path: 'test/fixtures/data.yml',
      cwd: 'test/',
      base: 'test/fixtures',
      contents: fs.readFileSync('test/fixtures/data.yml')
    });

    var stream = wrap('<%= contents %>', null, {parse: false});

    stream.on('error', function (err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (newFile) {

      should.exist(newFile);
      should.exist(newFile.contents);

      String(newFile.contents).should.equal('name: Roget\njob: Thesaurus');
      done();
    });

    stream.write(srcFile);
    stream.end();
  });

});
