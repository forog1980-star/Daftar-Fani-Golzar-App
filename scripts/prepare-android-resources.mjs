import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const androidResSrc = path.join(projectRoot, 'build-resources', 'android-res');
const androidResDest = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
const androidManifestPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const stringsXmlPath = path.join(androidResDest, 'values', 'strings.xml');
const colorsXmlPath = path.join(androidResDest, 'values', 'ic_launcher_background.xml');

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

// 1. Copy generated launcher icons, adaptive foregrounds, and splash screen
copyRecursive(androidResSrc, androidResDest);

// 2. Ensure adaptive icon background matches emblem cream (#F7F3E9)
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

// 3. Ensure Persian app name in strings.xml
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

// 4. Enable RTL layout and hardware acceleration in AndroidManifest.xml
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
