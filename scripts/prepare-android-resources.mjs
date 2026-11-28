import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const androidResSrc = path.join(projectRoot, 'build-resources', 'android-res');
const androidResDest = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
const androidManifestPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const stringsXmlPath = path.join(androidResDest, 'values', 'strings.xml');
const colorsXmlPath = path.join(androidResDest, 'values', 'ic_launcher_background.xml');
const androidGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
const desktopPackagePath = path.join(projectRoot, 'electron', 'package.json');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

if (!fs.existsSync(androidResDest)) {
  console.error('Android project not initialized yet. Run: npx cap add android');
  process.exit(1);
}

// 1. Keep Android versionCode monotonic and versionName aligned with the desktop/web release.
// This is required for Android to accept an in-place APK upgrade.
if (!fs.existsSync(androidGradlePath) || !fs.existsSync(desktopPackagePath)) {
  console.error('Android Gradle file or electron/package.json is missing; refusing to build an unversioned APK.');
  process.exit(1);
}

const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, 'utf8'));
const appVersion = String(desktopPackage.version || '').trim();
const versionMatch = appVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!versionMatch) {
  console.error(`Invalid release version in electron/package.json: ${appVersion}`);
  process.exit(1);
}

const [, majorText, minorText, patchText] = versionMatch;
const androidVersionCode =
  Number(majorText) * 1000000 + Number(minorText) * 1000 + Number(patchText);
if (!Number.isSafeInteger(androidVersionCode) || androidVersionCode < 1 || androidVersionCode > 2100000000) {
  console.error(`Calculated Android versionCode is outside the supported range: ${androidVersionCode}`);
  process.exit(1);
}

let appGradle = fs.readFileSync(androidGradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(appGradle) || !/versionName\s+["'][^"']+["']/.test(appGradle)) {
  console.error('Could not locate versionCode/versionName in android/app/build.gradle; refusing to build an APK with an unknown version.');
  process.exit(1);
}
appGradle = appGradle
  .replace(/versionCode\s+\d+/, `versionCode ${androidVersionCode}`)
  .replace(/versionName\s+["'][^"']+["']/, `versionName "${appVersion}"`);
fs.writeFileSync(androidGradlePath, appGradle, 'utf8');
console.log(`Android package version set to ${appVersion} (versionCode ${androidVersionCode}).`);

// 2. Copy generated launcher icons, adaptive foregrounds, and splash screen
copyRecursive(androidResSrc, androidResDest);

// 3. Ensure adaptive icon background matches emblem cream (#F7F3E9)
fs.mkdirSync(path.join(androidResDest, 'values'), { recursive: true });
fs.writeFileSync(
  colorsXmlPath,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F7F3E9</color>
</resources>
`,
  'utf8'
);

// 4. Ensure Persian app name in strings.xml
if (fs.existsSync(stringsXmlPath)) {
  let stringsXml = fs.readFileSync(stringsXmlPath, 'utf8');
  stringsXml = stringsXml
    .replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">دفتر فنی گلزار</string>')
    .replace(
      /<string name="title_activity_main">[^<]*<\/string>/,
      '<string name="title_activity_main">دفتر فنی اداره گلزار شهدا</string>'
    );
  fs.writeFileSync(stringsXmlPath, stringsXml, 'utf8');
}

// 5. Enable RTL layout and hardware acceleration in AndroidManifest.xml
if (fs.existsSync(androidManifestPath)) {
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');
  if (!manifest.includes('android:supportsRtl')) {
    manifest = manifest.replace('<application', '<application\n        android:supportsRtl="true"');
  }
  if (!manifest.includes('android:hardwareAccelerated')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:hardwareAccelerated="true"'
    );
  }
  fs.writeFileSync(androidManifestPath, manifest, 'utf8');
}

console.log('Android adaptive icons, Persian strings, splash screen, hardware acceleration, and RTL manifest configured successfully.');
