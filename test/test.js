'use strict';

var assert = require('assert');
var path = require('path');

var bufferToStream = require('simple-bufferstream');
var File = require('vinyl');
var wrap = require('..');

require('mocha');

describe('gulp-wrap', function() {
  it('should pass an empty file as it is', function(done) {
    wrap('')
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isNull());
      done();
    })
    .end(new File({}));
  });

  it('should produce expected file via buffer', function(done) {
    wrap('<%= contents %>bar')
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'foobar');
      done();
    })
    .end(new File({contents: new Buffer('foo')}));
  });

  it('should produce expected file via stream', function(done) {
    wrap('a<%= contents %>c')
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isStream());
      file.contents.on('data', function(data) {
        assert.equal(String(data), 'abc');
        done();
      });
    })
    .end(new File({contents: bufferToStream('b')}));
  });

  it('should error when no template is provided', function() {
    assert.throws(wrap.bind(null), /must be a string or a function./);
  });

  it('should handle a template from a file', function(done) {
    wrap({src: 'test/fixture.jst'})
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE Hello AFTER');
      done();
    })
    .end(new File({contents: new Buffer('Hello')}));
  });

  it('should fail when it cannot read the template file.', function(done) {
    wrap({src: 'node_modules'})
    .on('error', function(err) {
      assert.equal(err.code, 'EISDIR');
      done();
    })
    .end(new File({contents: new Buffer('Hello')}));
  });

  it('should handle template data and options', function(done) {
    wrap(
      'BEFORE <%= data.contents %> <%= data.someVar %> AFTER',
      {someVar: 'someVal'},
      {variable: 'data'}
    )
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE Hello someVal AFTER');
      done();
    })
    .end(new File({contents: new Buffer('Hello')}));
  });

  it('should allow file props in the template data', function(done) {
    var srcFile = new File({contents: new Buffer('Hello')});
    srcFile.someProp = 'someValue';

    wrap('Contents: [<%= contents %>] - File prop: [<%= file.someProp %>]')
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'Contents: [Hello] - File prop: [someValue]');
      done();
    })
    .end(srcFile);
  });

  it('should make data props override file data', function(done) {
    var srcFile = new File({contents: new Buffer('Hello')});
    srcFile.someProp = 'bar';

    wrap('<%= contents %> - <%= file.someProp %>', {
      file: {someProp: 'foo'}
    })
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'Hello - foo');
      done();
    })
    .end(srcFile);
  });

  it('should not pollute file data across multiple streams', function(done) {
    var srcFile1 = new File({contents: new Buffer('1')});
    srcFile1.foo = 'one';

    var srcFile2 = new File({contents: new Buffer('2')});
    srcFile2.bar = 'two';

    var expected = ['one  1', 'two  2'];

    var stream = wrap('<%= file.one %> <%= file.two %> <%= contents %>')
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert(String(file.contents), expected.shift());
      if (expected.length === 0) {
        done();
      }
    });

    stream.write(srcFile1);
    stream.write(srcFile2);
    stream.end();
  });

  it('should merge file.data property', function(done) {
    var srcFile = new File({contents: new Buffer('Hello')});
    srcFile.data = {prop: 'foo'};

    wrap('<%= contents %> <%= prop %>')
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'Hello foo');
      done();
    })
    .end(srcFile);
  });

  it('should allow for expressions', function(done) {
    wrap('<%= path.dirname(file.path) %>', {file: {path: 'a/b'}}, {imports: {path: path}})
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'a');
      done();
    })
    .end(new File({
      path: 'test/fixtures/hello.txt',
      contents: new Buffer('Hello')
    }));
  });

  it('should parse JSON files by default', function(done) {
    wrap('BEFORE <%= contents.name %> AFTER')
    .on('error', assert.ifError)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE foo AFTER');
      done();
    })
    .end(new File({
      path: 'data.json',
      contents: new Buffer('{"name": "foo"}')
    }));
  });

  it('should parse YAML files by default', function(done) {
    wrap('BEFORE <%= contents.name %> AFTER')
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE foo AFTER');
      done();
    })
    .end(new File({
      path: 'data.yml',
      contents: new Buffer('name: foo')
    }));
  });

  it('option parse=false should disable file parsing', function(done) {
    wrap('<%= contents %>', null, {parse: false})
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'name: foo');
      done();
    })
    .end(new File({
      path: 'data.yml',
      contents: new Buffer('name: foo')
    }));
  });

});
