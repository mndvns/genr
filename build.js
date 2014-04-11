
/**
 * Module dependencies.
 */

var debug = require('debug')('genr:build');
var async = require('async');
var Metalsmith = require('metalsmith');
var prompt = require('cli-prompt');
var render = require('consolidate').handlebars.render;
var path = require('path');
var yaml = require('js-yaml');
var fs = require('fs-extra');
var vm = require('vm');

/**
 * Build.
 */

module.exports = Builder;

function Builder(dir, options){
  if (!(this instanceof Builder))
    return new Builder(dir, options);
  Metalsmith.call(this, __dirname);
  this.use(ask)
  this.use(template)
  this.build(function(err){
      if (err) throw(err)
      console.log('done');
    });
};

require('util').inherits(Builder, Metalsmith);

/**
 * Prompt plugin.
 *
 * @param {Object} files
 * @param {Metalsmith} metalsmith
 * @param {Function} done
 */

function ask(files, metalsmith, done){
  var metadata = metalsmith.metadata();

  getConfig(metadata, function(err, data){
    var prompts = loadPrompt(data);

    // ascii helper fns
    var last = prompts[prompts.length - 1];
    var maxw = prompts.sort(function(a,b){ return b.length - a.length })[0].length;
    var padw = function(s){ return Array(maxw - s.length + 2).join(' ') };

    // pretty print
    var prnt = function prnt(str){
      return [
        padw(str),
        escc('30m', str),
        escc('0m'),
        ' : ',
      ].join('');
    }

    // clear screen and position
    write('2J');
    write('2;H');

    // run prompts
    async.eachSeries(prompts, run, done);

    function run(key, done){
      prompt(prnt(key), function(val){
        if (key == last) console.log();
        metadata[key] = val;
        done();
      });
    }
  });

}

/**
 * Template in place plugin.
 *
 * @param {Object} files
 * @param {Metalsmith} metalsmith
 * @param {Function} done
 */

function template(files, metalsmith, done){
  var keys = Object.keys(files);
  var metadata = metalsmith.metadata();

  getConfig(metadata, function(err, data){
    if (err) return done(err);
    debug(data);
    metadata = merge(metadata, data);
    async.each(keys, run, done);
  });

  function run(file, done){
    var str = files[file].contents.toString();
    render(str, metadata, function(err, res){
      if (err) return done(err);
      var buf = new Buffer(res);
      fs.outputFile(process.cwd() + '/' + file, buf, done);
    });
  }
}

/**
 * Get user's config.
 * @api private
 */

function getConfig(metadata, done){
  // TODO
  // this thing sucks
  var path = process.env.HOME + '/.config/genr';
  fs.exists(path, function(ex){
    if (!ex) return done('No config found at %s', path);
    fs.readdir(path, function(err, data){
      if (err) return done(err);
      // TODO
      // need to implement types/groups
      // and fucking flow control
      var types = path + '/' + data[0];
      readConfig(types, function(err, data){
        if (err) return done(err);
        data = merge(metadata, data);
        createContext(data, done);
      });
    });
  });
}

/**
 * Create context with config
 * data.
 *
 * @param {Object} data
 * @param {Function} done
 */

function createContext(data, done){
  var ctxdata = {
    path: path,
    process: process,
    cwd: process.cwd(),
    dirname: path.dirname,
    basename: path.basename,
    resolve: path.resolve
  };

  var d, m, ctx;
  for (var k in data) {
    if (!(d = data[k]).match(/(\(|\))/)) continue;
    m = merge(ctxdata, data);
    ctx = vm.createContext(m);
    try{d = vm.runInContext(d, ctx)}
    catch(err){return done(err)};
    data[k] = d;
  }
  done(null, data);
}

/**
 * Read config file.
 *
 * @param {String} path
 * @param {Function} done
 * @api private
 */

function readConfig(path, done){
  fs.readFile(path, {encoding: 'utf8'}, function(err, data){
    if (err) return done(err);
    // TODO
    // FIX MEEEEEEEEEaaaah, just kidding. could you imagine?
    try {data = yaml.safeLoad(data)} catch(e) {
      try {data = JSON.parse(data)} catch(e) {
        return done('Config file must be YAML or JSON');
      }
    }
    done(null, data);
  });
}

/**
 * Parse config keys and return array
 * of prompt questions.
 *
 * @param {Object} data
 * @return {Array} buf
 * @api private
 */

function loadPrompt(data){
  var buf = [];
  var key;
  var val;
  for (key in data) {
    if (key.slice(-1) !== '?') continue;
    val = data[key];
    key = key.slice(0, -1);
    buf.push(key);
  }

  return buf;
}


/**
 * Merge two objects.
 * @api private
 */

function merge(a, b){
  for (var k in b) a[k] = b[k];
  return a;
}


/**
 * ASCII escape code helper.
 *
 * @param {String} code
 * @param {String} str
 * @api private
 */

function escc(code, str){
  return '\u001B[' + code + (str || '');
};


/**
 * Stdout helper.
 *
 * @param {String} str
 * @api private
 */

function write(str){
  return process.stdout.write(escc(str));
};
