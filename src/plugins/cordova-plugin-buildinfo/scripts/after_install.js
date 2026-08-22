'use strict';

const path = require('path'),
  fs = require('fs');
function installWindows(windowsPath) {
  const targetPath = path.join(windowsPath, 'CordovaApp.projitems');
  let projitems = fs.readFileSync(targetPath).toString();
  let changed = false;
  if (projitems.match(/<ItemGroup>[\s]*?<Content +.*?Include="strings\/buildinfo.resjson".+/m)) {
    const search = /<ItemGroup>[\s]*?<Content +.*?Include="strings\/buildinfo.resjson"[^]*?<\/ItemGroup>/m;
    const replace = "<ItemGroup>\r\n" + "        <PRIResource Include=\"strings\/buildinfo.resjson\" />\r\n" + "    </ItemGroup>";
    projitems = projitems.replace(search, replace);
    changed = true;
  }
  if (!projitems.match(/<Target +.*?Name="BuildInfo_Timestamp".*?/)) {
    const search = /<\/Project>/;
    const replace = "    <Target Name=\"BuildInfo_Timestamp\" BeforeTargets=\"BeforeBuild\">\r\n" + "        <PropertyGroup>\r\n" + "            <BuildInfoTimestamp>$([System.DateTime]::Now.ToString(\"yyyy-MM-dd\THH:mm:sszzz\"))</BuildInfoTimestamp>\r\n" + "        </PropertyGroup>\r\n" + "        <ItemGroup>\r\n" + "            <BuildInfoResJson Include=\"{\" />\r\n" + "            <BuildInfoResJson Include=\"&quot;Timestamp&quot;: &quot;$(BuildInfoTimestamp)&quot;\" />\r\n" + "            <BuildInfoResJson Include=\"}\" />\r\n" + "        </ItemGroup>\r\n" + "        <WriteLinesToFile File=\"strings\\buildinfo.resjson\" Lines=\"@(BuildInfoResJson)\" Overwrite=\"true\" Encoding=\"UTF-8\" />\r\n" + "    </Target>\r\n" + "</Project>";
    projitems = projitems.replace(search, replace);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(targetPath, projitems);
  }
}
module.exports = function (context) {
  const projectRoot = context.opts.projectRoot;
  const windowsPath = path.join(projectRoot, 'platforms', 'windows');
  if (fs.existsSync(windowsPath) && context.opts.plugin.platform == 'windows') {
    installWindows(windowsPath);
  }
};
