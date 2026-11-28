'use strict';

const fs = require('fs');
const path = require('path');

const electronDir = __dirname;
const repoRoot = path.resolve(electronDir, '..');
const srcDist = path.join(repoRoot, 'dist');
const srcBuildResources = path.join(repoRoot, 'build-resources');

const dstDist = path.join(electronDir, 'dist');
const dstBuildResources = path.join(electronDir, 'build-resources');

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Required ${label} not found at: ${targetPath}`);
  }
}

assertExists(path.join(srcDist, 'index.html'), 'built dist/index.html (run NATIVE_BUILD=true npm run build first)');
assertExists(path.join(srcBuildResources, 'icon.ico'), 'build-resources/icon.ico');
assertExists(path.join(srcBuildResources, 'icon.png'), 'build-resources/icon.png');

fs.rmSync(dstDist, { recursive: true, force: true });
fs.rmSync(dstBuildResources, { recursive: true, force: true });

fs.cpSync(srcDist, dstDist, { recursive: true });
fs.mkdirSync(dstBuildResources, { recursive: true });
fs.copyFileSync(path.join(srcBuildResources, 'icon.ico'), path.join(dstBuildResources, 'icon.ico'));
fs.copyFileSync(path.join(srcBuildResources, 'icon.png'), path.join(dstBuildResources, 'icon.png'));

console.log('[stage-assets] Staged dist/ and build-resources/ inside electron/ successfully.');
