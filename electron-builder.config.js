/**
 * Electron Builder configuration.
 * Run: npm run electron:build
 * Output: dist/FactoryFlow-Setup-{version}.exe
 */

module.exports = {
  appId: 'com.factoryflow.app',
  productName: 'FactoryFlow',

  // Where to find compiled files
  directories: {
    output: 'dist',
  },

  // Files to include in the app package
  files: [
    'electron-dist/**/*',   // compiled Electron main process
    'out/**/*',             // Next.js static export
    'node_modules/**/*',
    'package.json',
  ],

  // Unpack the static export and native modules from app.asar so they can be
  // read by raw fs functions (fs.existsSync needs real filesystem paths).
  asarUnpack: [
    'out/**/*',
    'node_modules/better-sqlite3/**/*',
  ],

  // Windows installer (using Electron's default icon for now —
  // a custom icon can be added later by dropping an .ico file in /assets/)
  win: {
    target: 'nsis',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'FactoryFlow',
  },

  // Rebuild native modules (better-sqlite3) for Electron's Node version
  npmRebuild: true,
};
