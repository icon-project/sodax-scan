import { idToChainNameMap } from '../configs';
import { fetchFillsPage, parseIsoMs, type ClientConfig } from './client';
import { fillToRow } from './format';
import { createPoller } from './poller';
import { insertSolverFill, readFillsCursor, writeFillsCursor } from './repo';

/**
 * Solver fills poller. Env:
 *   SOLVER_FILLS_URL               sodax-data-backend base URL; unset = disabled
 *   SOLVER_FILLS_ACCOUNTS          comma list of solver accounts (required when enabled; missing = disabled with error log)
 *   SOLVER_FILLS_START             optional; default = current time at startup; only used when no cursor exists; invalid = disabled with error log
 *   SOLVER_FILLS_POLL_INTERVAL_MS  default 5000
 *   SOLVER_FILLS_PAGE_SIZE         default 100
 *   SOLVER_FILLS_TIMEOUT_MS        default 15000
 */

function envPositiveInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function startSolverFillsPoller(): NodeJS.Timeout | null {
  const baseUrl = process.env.SOLVER_FILLS_URL;
  if (!baseUrl) {
    console.log('solver-fills: SOLVER_FILLS_URL is not set, poller disabled');
    return null;
  }
  const accounts = (process.env.SOLVER_FILLS_ACCOUNTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (accounts.length === 0) {
    console.error('solver-fills: SOLVER_FILLS_ACCOUNTS must list at least one account when SOLVER_FILLS_URL is set, poller disabled');
    return null;
  }
  let startFrom = (process.env.SOLVER_FILLS_START ?? '').trim();
  if (!startFrom) {
    startFrom = new Date().toISOString();
    console.log(`solver-fills: SOLVER_FILLS_START not set, starting from now (${startFrom}) when no cursor exists`);
  } else if (Number.isNaN(parseIsoMs(startFrom))) {
    console.error('solver-fills: SOLVER_FILLS_START must be an ISO timestamp, e.g. 2026-10-01T00:00:00Z, poller disabled');
    return null;
  }

  const clientConfig: ClientConfig = {
    baseUrl,
    accounts,
    pageSize: envPositiveInt('SOLVER_FILLS_PAGE_SIZE', 100),
    timeoutMs: envPositiveInt('SOLVER_FILLS_TIMEOUT_MS', 15_000),
  };
  const chainIdsByName: Record<string, string> = Object.fromEntries(
    Object.entries(idToChainNameMap).map(([id, name]) => [name, id]),
  );
  const poller = createPoller({
    fetchPage: (q) => fetchFillsPage(clientConfig, q),
    toRow: (fill) => fillToRow(fill, chainIdsByName),
    insertFill: insertSolverFill,
    readCursor: readFillsCursor,
    writeCursor: writeFillsCursor,
    startFrom,
    log: console,
  });

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await poller.runOnce();
    } catch (err) {
      console.error('solver-fills: poll error:', err);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, envPositiveInt('SOLVER_FILLS_POLL_INTERVAL_MS', 5_000));
}
