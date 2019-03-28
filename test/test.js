'use strict';

var assert = require('assert');
var path = require('path');
var expect = require('expect.js');

var bufferToStream = require('simple-bufferstream');
var File = require('vinyl');
var wrap = require('..');

require('mocha');

describe('gulp-wrap', function() {
  it('should pass an empty file as it is', function(done) {
    wrap('')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isNull());
      done();
    })
    .end(new File({}));
  });

  it('should produce expected file via buffer', function(done) {
    wrap('<%= contents %>bar')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'foobar');
      done();
    })
    .end(new File({
      path: 'test/fixtures/fileBuffer.txt',
      contents: Buffer.from('foo')
    }));
  });

  it('should produce expected file via stream', function(done) {
    wrap('a<%= contents %>c')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isStream());
      file.contents.on('data', function(data) {
        assert.equal(String(data), 'abc');
        done();
      });
    })
    .end(new File({
      path: 'test/fixtures/fileStream.txt',
      contents: bufferToStream('b')
    }));
  });

  it('should error when no template is provided', function() {
    assert.throws(wrap.bind(null), /must be a string or a function./);
  });

  it('should handle a template from a file', function(done) {
    wrap({src: 'test/fixture.jst'})
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE Hello AFTER');
      done();
    })
    .end(new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    }));
  });

  it('should handle a template from a function', function(done) {
    wrap(function() {
      return 'BEFORE <%= contents %> AFTER';
    })
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE Hello AFTER');
      done();
    })
    .end(new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    }));
  });

  it('should fail when it cannot read the template file.', function(done) {
    wrap({src: 'node_modules'})
    .on('error', function(err) {
      assert.equal(err.code, 'EISDIR');
      done();
    })
    .end(new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    }));
  });

  it('should handle template data and options', function(done) {
    wrap(
      'BEFORE <%= data.contents %> <%= data.someVar %> AFTER',
      {someVar: 'someVal'},
      {variable: 'data'}
    )
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE Hello someVal AFTER');
      done();
    })
    .end(new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    }));
  });

  it('should allow for dynamic options', function(done) {
    var srcFile = new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    });
    srcFile.dataProp = 'data';

    wrap(
      'BEFORE <%= data.contents %> <%= data.someVar %> AFTER',
      {someVar: 'someVal'},
      function(file) {
        return {variable: file.dataProp};
      }
    )
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE Hello someVal AFTER');
      done();
    })
    .end(srcFile);
  });

  it('should allow file props in the template data', function(done) {
    var srcFile = new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    });
    srcFile.someProp = 'someValue';

    wrap('Contents: [<%= contents %>] - File prop: [<%= file.someProp %>]')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'Contents: [Hello] - File prop: [someValue]');
      done();
    })
    .end(srcFile);
  });

  it('should make data props override file data', function(done) {
    var srcFile = new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    });
    srcFile.someProp = 'bar';

    wrap('<%= contents %> - <%= file.someProp %>', {
      file: {someProp: 'foo'}
    })
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'Hello - foo');
      done();
    })
    .end(srcFile);
  });

  it('should allow for dynamic data', function(done) {
    var srcFile = new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    });
    srcFile.someProp = 'bar';

    wrap('<%= contents %> - <%= file.someProp %>', function(file) {
      return {
        file: {someProp: 'foo-' + file.someProp}
      };
    })
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'Hello - foo-bar');
      done();
    })
    .end(srcFile);
  });

  it('should not pollute file data across multiple streams', function(done) {
    var srcFile1 = new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('1')
    });
    srcFile1.foo = 'one';

    var srcFile2 = new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('2')
    });
    srcFile2.bar = 'two';

    var expected = ['one  1', 'two  2'];

    var stream = wrap('<%= file.one %> <%= file.two %> <%= contents %>')
    .on('error', done)
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
    var srcFile = new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    });
    srcFile.data = {prop: 'foo'};

    wrap('<%= contents %> <%= prop %>')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'Hello foo');
      done();
    })
    .end(srcFile);
  });

  it('should allow for expressions', function(done) {
    wrap('<%= path.dirname(file.path) %>', {file: {path: 'a/b'}}, {imports: {path: path}})
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'a');
      done();
    })
    .end(new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('Hello')
    }));
  });

  it('should parse JSON files by default', function(done) {
    wrap('BEFORE <%= contents.name %> AFTER')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE foo AFTER');
      done();
    })
    .end(new File({
      path: 'data.json',
      contents: Buffer.from('{"name": "foo"}')
    }));
  });

  it('should parse YAML files by default', function(done) {
    wrap('BEFORE <%= contents.name %> AFTER')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'BEFORE foo AFTER');
      done();
    })
    .end(new File({
      path: 'data.yml',
      contents: Buffer.from('name: foo')
    }));
  });

  it('option parse=false should disable file parsing', function(done) {
    wrap('<%= contents %>', null, {parse: false})
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'name: foo');
      done();
    })
    .end(new File({
      path: 'data.yml',
      contents: Buffer.from('name: foo')
    }));
  });

  it('should throw exception object passed for template and no src property is set',
      function() {
    expect(wrap).withArgs({}).to.throwException(function(e) {
      expect(e.message).to.equal('Expecting `src` option.');
    });
  });

  it('should throw exception if data file parse is invalid', function(done) {
    expect(function() {
      return wrap('<%= contents %>')
      .end(new File({
        path: 'data.json',
        contents: Buffer.from('This is an invalid JSON file.')
      }));
    }).to.throwException(function(e) {
      expect(e.message).to.equal('Error parsing data.json');
      done();
    });
  });

  it('should throw exception if template is invalid', function(done) {
    wrap('<%= contents.does.not.exist %>')
    .on('error', function(err) {
      expect(err.message).to.equal('Cannot read property \'not\' of undefined');
      done();
    })
    .end(new File({
      path: 'data.json',
      contents: Buffer.from('{"name": "foo"}')
    }));
  });

  it('should handle if Promise object not available', function(done) {
    delete require.cache[require.resolve('..')];
    global.Promise = undefined;
    var wrap = require('..');

    wrap('<%= contents %>bar')
    .on('error', done)
    .on('data', function(file) {
      assert(file.isBuffer());
      assert.equal(String(file.contents), 'foobar');
      done();
    })
    .end(new File({
      path: 'test/fixtures/hello.txt',
      contents: Buffer.from('foo')
    }));
  });
});
