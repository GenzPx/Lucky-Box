'use strict';

const path = require('path'),
  fs = require('fs');
function uninstallWindows(context, windowsPath) {
  const targetPath = path.join(windowsPath, 'CordovaApp.projitems');
  let projitems = fs.readFileSync(targetPath).toString();
  let changed = false;
  if (projitems.match(/<ItemGroup>[\s]*?<PRIResource +.*?Include="strings\/buildinfo.resjson".+/m)) {
    const search = /<ItemGroup>[\s]*?<PRIResource +.*?Include="strings\/buildinfo.resjson"[^]*?<\/ItemGroup>/m;
    const replace = "<ItemGroup>\r\n" + "        <Content Include=\"strings\/buildinfo.resjson\" />\r\n" + "    </ItemGroup>";
    projitems = projitems.replace(search, replace);
    changed = true;
  }
  if (projitems.match(/<Target +.*?Name="BuildInfo_Timestamp".*/)) {
    const search = /[\r\n ]*<Target +.*?Name="BuildInfo_Timestamp"[^]*?<\/Target>/gm;
    projitems = projitems.replace(search, '');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(targetPath, projitems);
  }
}
module.exports = function (context) {
  const opts = context.opts || {};
  const projectRoot = opts.projectRoot;
  if ('string' != typeof projectRoot) {
    return;
  }
  const windowsPath = path.join(projectRoot, 'platforms', 'windows');
  if (context.opts.plugin.platform == 'windows' && fs.existsSync(windowsPath)) {
    uninstallWindows(context, windowsPath);
  }
};
