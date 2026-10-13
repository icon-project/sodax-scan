import { idToChainNameMap } from '../configs';
import { fetchTradesPage, type ClientConfig } from './client';
import { tradeToRow } from './format';
import { createPoller } from './poller';
import { insertSolverMarketPlaceFill, readFillsCursor, writeFillsCursor } from './repo';

/**
 * SolverMarketPlaceFills poller over the market-maker trades feed (NEAR and
 * LI.FI trades). With no cursor it starts after the newest trade. Env:
 *   SOLVER_FILLS_URL               sodax-data-backend base URL; unset = disabled
 *   SOLVER_FILLS_POLL_INTERVAL_MS  default 5000
 *   SOLVER_FILLS_PAGE_SIZE         default 100, backend max 500
 *   SOLVER_FILLS_TIMEOUT_MS        default 15000
 */

function envPositiveInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function startSolverMarketPlaceFillsPoller(): NodeJS.Timeout | null {
  const baseUrl = process.env.SOLVER_FILLS_URL;
  if (!baseUrl) {
    console.log('solver-fills: SOLVER_FILLS_URL is not set, poller disabled');
    return null;
  }

  const clientConfig: ClientConfig = {
    baseUrl,
    pageSize: envPositiveInt('SOLVER_FILLS_PAGE_SIZE', 100),
    timeoutMs: envPositiveInt('SOLVER_FILLS_TIMEOUT_MS', 15_000),
  };
  const chainIdsByName: Record<string, string> = Object.fromEntries(
    Object.entries(idToChainNameMap).map(([id, name]) => [name, id]),
  );
  const poller = createPoller({
    fetchPage: (q) => fetchTradesPage(clientConfig, q),
    toRow: (trade) => tradeToRow(trade, chainIdsByName),
    insertFill: insertSolverMarketPlaceFill,
    readCursor: readFillsCursor,
    writeCursor: writeFillsCursor,
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
