import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import type { AddressInfo } from 'net';

/**
 * Embedded static file server for the packaged Electron app.
 *
 * Why this exists: Next.js's static export (`output: 'export'`) emits HTML that
 * references assets with absolute paths like `/_next/static/chunk.js`. Electron's
 * `file://` protocol treats these as "local resources" and refuses to load them,
 * which leaves the window blank. Serving the export over a real (loopback-only)
 * HTTP origin makes those absolute paths resolve exactly as they would on the web,
 * with none of the file:// or custom-protocol caveats.
 *
 * The server binds to 127.0.0.1 on an ephemeral port and never accepts remote
 * connections.
 */

/** Map common file extensions to the MIME types we serve. */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.map':   'application/json',
  '.txt':   'text/plain; charset=utf-8',
};

export function mimeTypeFor(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Resolve a request URL path to a concrete file inside `rootDir`, mirroring how
 * a static host serves a Next.js export:
 *   - "/"                  -> index.html
 *   - "/profile-picker"    -> profile-picker.html  (falls back to .../index.html)
 *   - "/local/clients"     -> local/clients.html
 *   - "/_next/static/x.js" -> served as-is
 *
 * Returns the absolute file path, or `null` if nothing matches or the request
 * tries to escape `rootDir` (path traversal).
 */
export function resolveFilePath(rootDir: string, urlPath: string): string | null {
  // Strip query string / hash and decode percent-encoding.
  const cleanPath = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);

  let relative = cleanPath.replace(/^\/+/, '');
  if (relative === '' || relative.endsWith('/')) {
    relative = `${relative}index.html`;
  }

  const candidates = [relative];
  if (!path.extname(relative)) {
    // Extensionless route — try the Next export's `<route>.html` and
    // `<route>/index.html` forms.
    candidates.push(`${relative}.html`, `${relative}/index.html`);
  }

  const normalizedRoot = path.normalize(rootDir + path.sep);

  for (const candidate of candidates) {
    const fullPath = path.normalize(path.join(rootDir, candidate));
    // Defensive: never serve anything outside the export root.
    if (!fullPath.startsWith(normalizedRoot)) { continue; }
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }

  return null;
}

export interface StaticServer {
  /** The bound loopback port. */
  port: number;
  /** Full origin, e.g. "http://127.0.0.1:54213". */
  origin: string;
  /** Stop the server. */
  close: () => Promise<void>;
}

/**
 * Start the static server for the given export directory. Resolves once the
 * server is listening, with the chosen ephemeral port.
 */
export function startStaticServer(rootDir: string): Promise<StaticServer> {
  const server = http.createServer((req, res) => {
    const filePath = resolveFilePath(rootDir, req.url ?? '/');

    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal error');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeTypeFor(filePath) });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    // Port 0 => OS assigns a free ephemeral port. Bind to loopback only.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}
