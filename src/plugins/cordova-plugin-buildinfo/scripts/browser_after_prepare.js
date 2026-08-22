'use strict';

const path = require('path'),
  fs = require('fs');
function rewriteBuildInfoProxy(context, pathPrefix) {
  const opts = context.opts || {};
  const options = opts.options || {};
  const release = options.release || false;
  const debug = options.debug || !release;
  const pluginId = (opts.plugin || {}).id || 'cordova-plugin-buildinfo';
  const pathRewriteFile = path.join(pathPrefix, 'www', 'plugins', pluginId, 'src', 'browser', 'BuildInfoProxy.js');
  if (!fs.existsSync(pathRewriteFile)) {
    console.error('File not found: '.pathRewriteFile);
    return;
  }
  const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
  const cfg = new ConfigParser('config.xml');
  const json = {
    debug: debug,
    packageName: cfg.packageName(),
    basePackageName: cfg.packageName(),
    name: cfg.name(),
    displayName: cfg.shortName(),
    version: cfg.version(),
    versionCode: cfg.version()
  };
  const code = 'const json = ' + JSON.stringify(json) + ';';
  const contentJs = fs.readFileSync(pathRewriteFile, 'utf8');
  const outputJs = contentJs.replace(/(\/\* <EMBED_CODE> \*\/).*?(\s*)(\/\* <\/EMBED_CODE> \*\/)/s, '$1$2' + code + '$2$3');
  fs.writeFileSync(pathRewriteFile, outputJs);
}
module.exports = function (context) {
  const opts = context.opts || {};
  const projectRoot = opts.projectRoot;
  const platforms = opts.platforms || [];
  if ('string' != typeof projectRoot) {
    return;
  }
  ['browser', 'electron'].forEach((value, index, array) => {
    if (!platforms.includes(value)) {
      return;
    }
    const pathPrefix = path.join(projectRoot, 'platforms', value);
    if (fs.existsSync(pathPrefix)) {
      rewriteBuildInfoProxy(context, pathPrefix);
    }
  });
};
