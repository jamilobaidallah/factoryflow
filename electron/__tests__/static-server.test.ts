import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveFilePath, mimeTypeFor } from '../static-server';

/**
 * The embedded static server is what makes the packaged Electron app load at
 * all — a regression here means a blank window. These tests lock in the path
 * resolution that mirrors a Next.js static export, plus the traversal guard.
 */
describe('static-server resolveFilePath', () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-out-'));
    fs.writeFileSync(path.join(root, 'index.html'), 'home');
    fs.writeFileSync(path.join(root, 'profile-picker.html'), 'picker');
    fs.mkdirSync(path.join(root, '_next', 'static'), { recursive: true });
    fs.writeFileSync(path.join(root, '_next', 'static', 'chunk.js'), 'js');
    fs.mkdirSync(path.join(root, 'local'), { recursive: true });
    fs.writeFileSync(path.join(root, 'local', 'clients.html'), 'clients');
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('serves index.html for the root path', () => {
    expect(resolveFilePath(root, '/')).toBe(path.join(root, 'index.html'));
  });

  it('serves an explicit .html file', () => {
    expect(resolveFilePath(root, '/profile-picker.html')).toBe(
      path.join(root, 'profile-picker.html')
    );
  });

  it('falls back to <route>.html for an extensionless route', () => {
    expect(resolveFilePath(root, '/profile-picker')).toBe(
      path.join(root, 'profile-picker.html')
    );
  });

  it('resolves nested extensionless routes', () => {
    expect(resolveFilePath(root, '/local/clients')).toBe(
      path.join(root, 'local', 'clients.html')
    );
  });

  it('serves _next static assets as-is', () => {
    expect(resolveFilePath(root, '/_next/static/chunk.js')).toBe(
      path.join(root, '_next', 'static', 'chunk.js')
    );
  });

  it('ignores query strings and hashes', () => {
    expect(resolveFilePath(root, '/profile-picker.html?v=2#top')).toBe(
      path.join(root, 'profile-picker.html')
    );
  });

  it('returns null for a missing file', () => {
    expect(resolveFilePath(root, '/nope')).toBeNull();
  });

  it('blocks path traversal outside the export root', () => {
    expect(resolveFilePath(root, '/../../etc/passwd')).toBeNull();
    expect(resolveFilePath(root, '/..%2f..%2fetc%2fpasswd')).toBeNull();
  });
});

describe('static-server mimeTypeFor', () => {
  it('maps known extensions', () => {
    expect(mimeTypeFor('a.html')).toContain('text/html');
    expect(mimeTypeFor('a.js')).toContain('javascript');
    expect(mimeTypeFor('a.css')).toContain('text/css');
    expect(mimeTypeFor('a.woff2')).toBe('font/woff2');
  });

  it('falls back to octet-stream for unknown extensions', () => {
    expect(mimeTypeFor('a.xyz')).toBe('application/octet-stream');
  });
});
