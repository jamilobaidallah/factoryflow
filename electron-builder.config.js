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

  // Windows installer
  win: {
    target: 'nsis',
    icon: 'assets/icon.ico',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'FactoryFlow',
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
  },

  // Rebuild native modules (better-sqlite3) for Electron's Node version
  npmRebuild: true,
};
