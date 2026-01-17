import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SNAPSHOT_DIR = path.resolve(__dirname, 'snapshots');

/**
 * Saves an HTML snapshot with a <base href="..."> injected
 *
 * @param {string} html - Raw HTML string
 * @param {string} requestUrl - Full requested URL (with or without query)
 */
export function saveHtmlSnapshot(html, requestUrl) {

    if (!html) {
        console.error('HTML is empty');
        return;
    }
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  // Remove query + hash
  const urlObj = new URL(requestUrl);
  const baseHref = `${urlObj.origin}${urlObj.pathname.endsWith('/')
    ? urlObj.pathname
    : urlObj.pathname + '/'
  }`;

  // Inject <base> right after <html ...>
  const modifiedHtml = html.replace(
    /<html([^>]*)>/i,
    `<html$1>\n<base href="${baseHref}">`
  );

  // Determine next incremental filename
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.match(/^html_\d+\.html$/));

  const nextId = files.length === 0
    ? 1
    : Math.max(...files.map(f => Number(f.match(/\d+/)[0]))) + 1;

  const filename = `html_${String(nextId).padStart(4, '0')}.html`;
  const filepath = path.join(SNAPSHOT_DIR, filename);

  fs.writeFileSync(filepath, modifiedHtml, 'utf-8');

  return filepath;
}
