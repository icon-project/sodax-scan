import { describe, it, expect, beforeEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readCursorFile, writeCursorFile } from './cursor-file';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-file-'));
  process.env.HUB_INTENTS_CURSOR_DIR = dir;
});

describe('cursor-file', () => {
  it('returns null when the cursor file does not exist', async () => {
    expect(await readCursorFile('missing')).toBeNull();
  });

  it('round-trips a value and leaves no temp file behind', async () => {
    const value = { lastTimestamp: '2026-10-05T07:39:25.177740+00:00', updatedAt: 1 };
    await writeCursorFile('solver_fills', value);
    expect(await readCursorFile('solver_fills')).toEqual(value);
    expect(fs.readdirSync(dir)).toEqual(['solver_fills.json']);
  });

  it('throws on a corrupt file instead of silently restarting from scratch', async () => {
    fs.writeFileSync(path.join(dir, 'bad.json'), '{not json');
    await expect(readCursorFile('bad')).rejects.toThrow();
  });
});
