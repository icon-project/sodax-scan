import { describe, it, expect, mock, beforeEach } from 'bun:test';

// parseTransactionEvent pulls in the chain handlers, the SODAX config loader
// (which calls requireEnv on a dozen RPC URLs), the pg pool, and the pollers —
// all of which throw or hit the network at import time. Mock every dependency
// so the test exercises only the MPC routing/gating control flow in main.ts.

const fetchPayload = mock(async (_txHash: string, _sn: string) => ({
    txnFee: '0.1 Sonic',
    payload: '0xdeadbeef',
    blockNumber: 123,
}));
const getHandler = mock((_chainId: string) => ({ fetchPayload }));

// parsePayloadData is the decode step. Default: a real, final Withdraw action.
const parsePayloadData = mock((_data: string, _src: string, _dst: string) => ({
    action: 'Withdraw',
    actionText: 'Withdraw 5 zBTC',
}));

const updateTransactionInfo = mock(async () => {});
const updateMpcActionInfo = mock(async () => {});

mock.module('./configs', () => ({
    sonic: '146',
    bitcoin: '0',
    solana: '1',
    chains: { '146': { AssetManager: '0x0000000000000000000000000000000000000000', Assets: {} } },
    enrichChainsFromApi: async () => {},
}));
mock.module('./handler', () => ({ getHandler }));
mock.module('./action', () => ({
    parsePayloadData,
    getTransactionPackets: mock(async () => ''),
    getPayloadFromRelayPacket: mock(async () => '0x'),
}));
mock.module('./db', () => ({ updateTransactionInfo, updateMpcActionInfo }));
mock.module('./hub-intents/poller', () => ({ startHubIntentsPoller: () => 0 }));
mock.module('./solver-fills', () => ({ startSolverFillsPoller: () => null }));
mock.module('./intent-fill-format', () => ({
    isRawTupleActionText: () => false,
    recoverIntentFilledFormat: async () => null,
}));
mock.module('./utils', () => ({
    bigintDivisionToDecimalString: () => '0',
    multiplyDecimalBy10Pow18: () => '0',
    srcHasHashedPayload: () => false,
    extractConnSn: () => '',
}));

const { parseTransactionEvent } = await import('./main');

// The row supplied by the external MPC service. Note mint_tx_hash (the real
// column) and an empty action_detail — the unenriched initial state. src_network
// is the hub (146) even though the MPC origin is zcash (mpc_id prefix 133).
const baseRow = {
    id: 1558,
    sn: null,
    status: 'executed',
    src_network: '146',
    src_tx_hash: '34be1a4c25c7c416e62443c800b1334158cc30c7b2b1142b5046489fa4aff0be',
    dest_network: '48',
    dest_tx_hash: '0x0dd7d292a2cde1560c0c18623d0a69a272521ab2d9207a22e74149f7a00169c0',
    dest_address: '0x0048000000000000000000000000000000000000',
    action_type: 'Withdraw',
    action_detail: '',
    created_at: '1790137576',
    updated_at: '1790137595',
    intent_tx_hash: null,
    slippage: null,
    mint_tx_hash: '0xbf40b486b4e68694b6d350469e171578855c19ec666c2435cb1e05148fb1c6ea',
    mpc_id: '133-34be1a4c25c7c416e62443c800b1334158cc30c7b2b1142b5046489fa4aff0be-0',
} as any;

const run = (row: any) => parseTransactionEvent({ data: [row] } as any);

describe('parseTransactionEvent — MPC routing (mpc_id set)', () => {
    beforeEach(() => {
        getHandler.mockClear();
        fetchPayload.mockClear();
        parsePayloadData.mockClear();
        updateTransactionInfo.mockClear();
        updateMpcActionInfo.mockClear();
        parsePayloadData.mockReturnValue({ action: 'Withdraw', actionText: 'Withdraw 5 zBTC' });
    });

    it('decodes the mint tx on Sonic and enriches action-only (not the src tx, despite sn=null / action_type set)', async () => {
        await run(baseRow);

        // Routed to the hub handler + the mint tx, never the (undecodable) src tx.
        expect(getHandler).toHaveBeenCalledWith('146');
        expect(fetchPayload.mock.calls[0][0]).toBe(baseRow.mint_tx_hash);
        // Decode context is Sonic on both sides (dest 48 isn't in config).
        expect(parsePayloadData.mock.calls[0][1]).toBe('146');
        expect(parsePayloadData.mock.calls[0][2]).toBe('146');

        // Only the action fields are written, via the MPC-scoped update.
        expect(updateMpcActionInfo).toHaveBeenCalledTimes(1);
        expect(updateMpcActionInfo.mock.calls[0]).toEqual([1558, 'Withdraw', 'Withdraw 5 zBTC']);
        expect(updateTransactionInfo).not.toHaveBeenCalled();
    });

    it('skips a row already enriched (action_detail present) — the done-gate', async () => {
        await run({ ...baseRow, action_detail: 'Withdraw 5 zBTC' });

        expect(fetchPayload).not.toHaveBeenCalled();
        expect(updateMpcActionInfo).not.toHaveBeenCalled();
    });

    it('waits (no write, no decode) when the mint tx has not landed yet', async () => {
        await run({ ...baseRow, mint_tx_hash: null });

        expect(fetchPayload).not.toHaveBeenCalled();
        expect(updateMpcActionInfo).not.toHaveBeenCalled();
        expect(updateTransactionInfo).not.toHaveBeenCalled();
    });

    it('does not write when the mint tx does not decode to a real action (SendMsg sentinel)', async () => {
        parsePayloadData.mockReturnValue({ action: 'SendMsg' });
        await run(baseRow);

        expect(fetchPayload).toHaveBeenCalledTimes(1);
        expect(updateMpcActionInfo).not.toHaveBeenCalled();
    });

    it('does not override with a non-final Transfer action', async () => {
        parsePayloadData.mockReturnValue({ action: 'Transfer', actionText: 'Transfer 1 X' });
        await run(baseRow);

        expect(updateMpcActionInfo).not.toHaveBeenCalled();
    });

    it('derives CreateIntent from the mint tx IntentCreated tuple (payload actionText + intent hash)', async () => {
        // A hub create tx: fetchPayload returns "0x" payload but carries the
        // decoded IntentSwap text + intent hash. parsePayloadData("0x") is
        // Transfer, so the override to CreateIntent must come from the payload.
        parsePayloadData.mockReturnValue({ action: 'Transfer' });
        fetchPayload.mockResolvedValueOnce({
            txnFee: '0.02 Sonic',
            payload: '0x',
            intentTxHash: '0xf0d2bde431158ab434d677f12babee1c86741d48e46a514724a4b065e8856f40',
            actionText: 'IntentSwap 0.5 IN(sonic) -> 0.62 Circle USDC(sonic)',
            blockNumber: 79236987,
        });
        await run(baseRow);

        expect(updateMpcActionInfo).toHaveBeenCalledTimes(1);
        expect(updateMpcActionInfo.mock.calls[0]).toEqual([
            1558, 'CreateIntent', 'IntentSwap 0.5 IN(sonic) -> 0.62 Circle USDC(sonic)',
        ]);
    });
});
