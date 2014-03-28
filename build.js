
/**
 * Module dependencies
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

var metalsmith = Metalsmith(__dirname)
  .use(ask)
  .use(template)



metalsmith.build(function(err){
    if (err) throw err;
    console.log(metalsmith);
    console.log(metalsmith.__proto__);
  });

/**
 * Prompt plugin.
 *
 * @param {Object} files
 * @param {Metalsmith} metalsmith
 * @param {Function} done
 */

function ask(files, metalsmith, done){
  var prompts = ['description'];
  var metadata = metalsmith.metadata();

  async.eachSeries(prompts, run, done);

  function run(key, done){
    prompt('  ' + key + ': ', function(val){
      metadata[key] = val;
      done();
    });
  }
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
  var path = process.env.HOME + '/.config/project';
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
 * @api private
 */

function readConfig(path, done){
  fs.readFile(path, {encoding: 'utf8'}, function(err, data){
    if (err) return done(err);
    try {data = yaml.safeLoad(data)} catch(e) {
      try {data = JSON.parse(data)} catch(e) {
        return done('Config file must be YAML or JSON');
      }
    }
    done(null, data);
  });
}

/**
 * Merge two objects.
 * @api private
 */

function merge(a, b){
  for (var k in b) a[k] = b[k];
  return a;
}
