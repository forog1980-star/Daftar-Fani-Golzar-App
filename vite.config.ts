import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const isNativeBuild = process.env.NATIVE_BUILD === 'true';
  const base = isNativeBuild
    ? './'
    : process.env.GITHUB_PAGES === 'true'
      ? '/Daftar-Fani-Golzar-App/'
      : '/';
  const appVersion = '1.4.2';
  const buildTimestamp = new Date().toISOString();
  const buildId = `${appVersion}-${buildTimestamp.replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  let resolvedOutDir = path.resolve(import.meta.dirname, 'dist');

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        disable: isNativeBuild,
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon-32x32.png',
          'apple-touch-icon.png',
          'app-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: base,
          name: 'دفتر فنی اداره گلزار شهدا',
          short_name: 'دفتر فنی',
          description: 'نرم‌افزار مدیریت امور دفتر فنی اداره گلزار شهدا با معماری Local-First و قابلیت آفلاین',
          lang: 'fa',
          dir: 'rtl',
          theme_color: '#F7F3E9',
          background_color: '#F7F3E9',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          globIgnores: ['**/version.json', '**/update-manifest.json', 'native-bundle/**', 'assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      // Emit fresh version.json + update-manifest.json so Chrome PWA, Windows Desktop, and Android APK can all self-update cleanly
      {
        name: 'emit-version-manifest',
        apply: 'build',
        configResolved(config) {
          resolvedOutDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = resolvedOutDir;
          if (fs.existsSync(distDir)) {
            let notes: string[] = [];
            try {
              const pubVersionPath = path.resolve(import.meta.dirname, 'public/version.json');
              if (fs.existsSync(pubVersionPath)) {
                const parsed = JSON.parse(fs.readFileSync(pubVersionPath, 'utf-8'));
                if (Array.isArray(parsed.notes)) notes = parsed.notes;
              }
            } catch {
              notes = [];
            }

            const versionPayload = { version: appVersion, buildId, builtAt: buildTimestamp, notes };
            fs.writeFileSync(
              path.resolve(distDir, 'version.json'),
              JSON.stringify(versionPayload, null, 2),
              'utf-8'
            );

            // Collect all relative files in outDir for atomic Native OTA updates (Windows Electron & Android Capacitor)
            const collectedFiles: string[] = [];
            const walk = (dir: string, prefix = '') => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
                if (
                  rel === 'update-manifest.json' ||
                  rel === 'native-bundle' ||
                  rel.startsWith('native-bundle/') ||
                  rel.startsWith('assets/aistudio/') ||
                  /^sw\.js$/i.test(rel) ||
                  /^registerSW\.js$/i.test(rel) ||
                  /^workbox-.*\.js$/i.test(rel)
                ) {
                  continue;
                }
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  walk(full, rel);
                } else if (entry.isFile()) {
                  collectedFiles.push(rel);
                }
              }
            };
            walk(distDir);
            collectedFiles.sort();

            fs.writeFileSync(
              path.resolve(distDir, 'update-manifest.json'),
              JSON.stringify(
                {
                  version: appVersion,
                  buildId,
                  builtAt: buildTimestamp,
                  base,
                  files: collectedFiles,
                },
                null,
                2
              ),
              'utf-8'
            );
          }
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
