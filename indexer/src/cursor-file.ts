import * as fs from 'node:fs';
import * as path from 'node:path';

// Every poller's resume cursor lives in one directory. The env name predates
// the solver-fills poller; it is kept so existing deployments need no change.
function cursorDir(): string {
  return process.env.HUB_INTENTS_CURSOR_DIR || path.resolve('.cursors');
}

function cursorPath(name: string): string {
  return path.join(cursorDir(), `${name}.json`);
}

/** Parsed cursor JSON, or null when the file does not exist. Corrupt JSON throws. */
export async function readCursorFile(name: string): Promise<unknown | null> {
  try {
    const raw = await fs.promises.readFile(cursorPath(name), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Writes to a temp file then renames, so a crash mid-write can't leave a partial file. */
export async function writeCursorFile(name: string, value: object): Promise<void> {
  await fs.promises.mkdir(cursorDir(), { recursive: true });
  const finalPath = cursorPath(name);
  const tmpPath = `${finalPath}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(value), 'utf8');
  await fs.promises.rename(tmpPath, finalPath);
}
