import axios from "axios";
import { getHandler } from './handler'
import { bitcoin, chains, enrichChainsFromApi, idToChainNameMap, RPC_URLS, solana, sonic } from "./configs";
import { getTransactionPackets, getPayloadFromRelayPacket, parsePayloadData } from "./action";
import { updateTransactionInfo, updateMpcActionInfo } from "./db";
import dotenv from 'dotenv';
import { SendMessage, SodaxScannerResponse, Transfer, type TxPayload } from "./types";
import { bigintDivisionToDecimalString, multiplyDecimalBy10Pow18, srcHasHashedPayload, extractConnSn } from "./utils";
import pool from './db/db';
import { startHubIntentsPoller } from './hub-intents/poller';
import { isRawTupleActionText, recoverIntentFilledFormat } from './intent-fill-format';
import { findBridgeWithdrawal, formatWithdrawText, type ReceiptLog } from './mpc-withdraw';

dotenv.config();
const SODAXSCAN_CONFIG = {
    method: 'get',
    url: `${process.env.SCANNER_URL}/api/messages?skip=0&limit=${Number.parseInt(process.env.LIMIT || '10')}`,
    headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
    },
};

let lastScannedId = 0
let isRunning = true;
let retries: Record<string, number> = {}
const processSodaxStream = async () => {
    const response: SodaxScannerResponse = (await axios.request(SODAXSCAN_CONFIG)).data satisfies SodaxScannerResponse;
    await parseTransactionEvent(response);
    lastScannedId = response.data[0].id
}

export async function parseTransactionEvent(response: SodaxScannerResponse) {
    for (const transaction of response.data) {
        const id = transaction.id;

        // An MPC row is identified by mpc_id (set by the external MPC service at
        // insert). mint_tx_hash lands later, so it can't gate detection.
        const isMpc = transaction.mpc_id != null && transaction.mpc_id !== '';

        // Hub-origin rows (sn = NULL, written by the hub-intents poller) are
        // complete at insert — re-parsing them here would overwrite their
        // action_type/action_detail with garbage and break the poller's
        // duplicate check. Only relayer rows (sn set) need enrichment; MPC
        // rows are the exception, enriched regardless of sn.
        if (transaction.sn == null && !isMpc) {
            continue;
        }

        // Skip only if we've already seen this message and have nothing left to
        // do for it. MPC rows bypass this: their action can't be inferred from
        // action_type (which the external writer sets upfront), so they are
        // retried every poll until the mint tx lands and decodes.
        const alreadySeen = lastScannedId !== 0 && id <= lastScannedId;
        const hasIntentTxHash = transaction.intent_tx_hash != null && transaction.intent_tx_hash !== '';
        const createIntentDone = transaction.action_type !== 'CreateIntent' || hasIntentTxHash;
        const needsNoMoreWork = transaction.action_type !== 'SendMsg' && createIntentDone;
        if (!isMpc && alreadySeen && needsNoMoreWork) {
            continue;
        }

        // MPC rows are done once action_detail is written. It's empty until we
        // enrich it (action_type is set by the external writer upfront, so it
        // can't signal completion), making it the reliable done-marker.
        if (isMpc && transaction.action_detail != null && transaction.action_detail !== '') {
            continue;
        }

        if (id in retries && retries[id] > 4) {
            continue
        }

        if (isMpc) {
            // Every MPC leg we decode is a hub (Sonic) tx: the mint for a
            // deposit; for a withdrawal (no mint leg) the burn, or the source tx
            // itself when it started on Sonic. With none yet it's a deposit
            // awaiting its mint — leave it pending without burning a retry.
            const mintTxHash = transaction.mint_tx_hash || null;
            const hubTxHash = mintTxHash ?? (transaction.hub_burn_tx_hash || (transaction.src_network === sonic ? transaction.src_tx_hash : null));
            if (!hubTxHash) {
                continue;
            }
            // Decode entirely in Sonic's context: the spoke chain has no indexer
            // handler and may be absent from config. The specific hub action
            // (intent fill/create/cancel, migration) wins over the plain
            // deposit/withdrawal, which is only the fallback.
            try {
                console.log("Processing MPC hub txn", hubTxHash);
                const payload = await getHandler(sonic).fetchPayload(hubTxHash, transaction.sn ?? '');
                let result = await specificHubAction(payload);
                if (!result && mintTxHash) {
                    const decoded = parsePayloadData(payload.payload, sonic, sonic);
                    if (decoded.action !== SendMessage && decoded.actionText) {
                        result = { action: decoded.action, actionText: decoded.actionText };
                    }
                }
                if (!result && !mintTxHash) {
                    const withdrawal = findBridgeWithdrawal(await fetchSonicReceiptLogs(hubTxHash));
                    if (withdrawal) {
                        const chainName = idToChainNameMap[withdrawal.dstChainId] ?? withdrawal.dstChainId;
                        result = { action: 'Withdraw', actionText: formatWithdrawText(withdrawal, chains[sonic].Assets, chainName) };
                    }
                }
                if (result) {
                    await updateMpcActionInfo(id, result.action, result.actionText);
                } else {
                    if (id in retries) retries[id] = retries[id] + 1; else retries[id] = 1;
                    console.log("MPC hub tx decode incomplete for id", id, "- will retry");
                }
            } catch (error) {
                const errMessage = error instanceof Error ? error.message : String(error);
                console.log("Failed MPC enrichment for id", id, errMessage);
                if (id in retries) retries[id] = retries[id] + 1; else retries[id] = 1;
            }
            continue;
        }

        const srcChainId = transaction.src_network as string;
        const dstChainId = transaction.dest_network as string;
        try {
            console.log("Processing txn", transaction.src_tx_hash);
            const txHash = transaction.src_tx_hash;
            const payload = await getHandler(srcChainId).fetchPayload(txHash, transaction.sn);
            let actionType = parsePayloadData(payload.payload, srcChainId, dstChainId);

            if (actionType.intentTxHash) {
                payload.intentTxHash = actionType.intentTxHash
            }
            if (actionType.action === SendMessage) {
                if (srcChainId === solana) {
                    try {
                        const payload = await getPayloadFromRelayPacket(transaction.src_tx_hash, String(transaction.sn), srcChainId)
                        if (payload !== '0x') {
                            actionType = parsePayloadData(payload, srcChainId, dstChainId)
                        }
                    } catch (error) {
                        console.log('Error parsing Solana transaction', error)
                    }
                }
            }
            if (payload.intentFilled) {
                actionType.action = "IntentFilled";
                actionType.actionText = payload.actionText;
                actionType.swapInputToken = payload.swapInputToken;
                actionType.swapOutputToken = payload.swapOutputToken;

                // Raw event-tuple fallback ("IntentFilled 0xHASH,bool,…")
                // means the calldata decode failed — try to recover the
                // proper action_detail + slippage from the sibling
                // CreateIntent row. If unavailable yet, keep the raw text;
                // the periodic backfill script catches it later.
                if (
                    isRawTupleActionText(actionType.actionText) &&
                    payload.intentTxHash &&
                    payload.filledOutputAmount
                ) {
                    try {
                        const fmt = await recoverIntentFilledFormat(
                            payload.intentTxHash,
                            BigInt(payload.filledOutputAmount),
                        );
                        if (fmt) {
                            actionType.actionText = fmt.actionDetail;
                            if (fmt.slippage) payload.slippage = fmt.slippage;
                        }
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        console.log('IntentFilled format recovery failed:', msg);
                    }
                }
            }
            if (payload.intentCancelled) {
                actionType.action = "CancelIntent";
                actionType.actionText = payload.actionText;
            }
            if (payload.reverseSwap) {
                actionType.action = "Migration";
                actionType.actionText = payload.actionText;
            }
            const assetManager = chains[srcChainId].AssetManager;
            let assetsInformation = chains[srcChainId].Assets;
            if (srcChainId === sonic) {
                assetsInformation = chains[dstChainId].Assets;
            }
            if (actionType.action === Transfer || actionType.action === SendMessage) {
                const dstAddress: string = payload.dstAddress || "";
                if (dstAddress.toLowerCase() === assetManager.toLowerCase()) {
                    actionType.action = 'Deposit';
                    const token = actionType.tokenAddress || "";
                    if (token in assetsInformation) {
                        const adjustedAmount = bigintDivisionToDecimalString(BigInt(multiplyDecimalBy10Pow18(actionType.amount || "0")), assetsInformation[token].decimals);
                        actionType.denom = assetsInformation[token].name;
                        actionType.actionText = `Deposit ${adjustedAmount} ${actionType.denom}`;
                    } else {
                        actionType.actionText = `Deposit ${actionType.amount} ${actionType.tokenAddress}`;
                    }
                }
            }

            if (actionType.action === "SendMsg") {
                if (id in retries) {
                    retries[id] = retries[id] + 1
                } else {
                    retries[id] = 1
                }
            }


            if (srcChainId === bitcoin) {
                // note: Im not sure if we handle txs with mulitple packets/messages correctly here.
                const relayResponse = await getTransactionPackets(transaction.src_tx_hash, srcChainId)
                const connSn = extractConnSn(relayResponse)
                if (!connSn) {
                    console.log('No connSn found')
                    continue
                }

                let payload = '0x' as any
                try {
                    payload = await getPayloadFromRelayPacket(transaction.src_tx_hash, connSn, srcChainId)
                } catch (error) {
                    console.log('Error getting relay packet', error)
                }
                actionType = parsePayloadData(payload, srcChainId, dstChainId)
            }

            if (actionType.action === "CreateIntent") {
                if (transaction.dest_tx_hash) {
                    const dstPayload = await getHandler(dstChainId).fetchPayload(transaction.dest_tx_hash, transaction.sn);
                    payload.intentTxHash = dstPayload.intentTxHash
                }

                // else: keep payload.intentTxHash (e.g. from Bitcoin path)
            }
            if (!payload.intentTxHash?.startsWith("0x")) {
                payload.intentTxHash = ""
            }

            // Check for stored call reverted or intent tx hash in the destination transaction
            if (srcHasHashedPayload(srcChainId) && transaction.dest_tx_hash) {
                const dstPayload = await getHandler(dstChainId).fetchPayload(transaction.dest_tx_hash, transaction.sn)
                if (dstPayload.storedCallReverted) {
                    actionType.action = 'Reverted'
                    actionType.actionText = 'StoredCallReverted'
                }
            }

            console.log(`Action: ${actionType.action} \nAction Details: ${actionType.actionText} \nTransaction Fee: ${payload.txnFee}\n\n`)

            const feeValid = typeof payload.txnFee === 'string'
            const blockNumberValid = payload.blockNumber === null || typeof payload.blockNumber === 'number'
            if (feeValid && blockNumberValid) {
                await updateTransactionInfo(
                    id,
                    payload.txnFee,
                    actionType.action,
                    actionType.actionText || '',
                    payload.intentTxHash ?? '',
                    payload.slippage ?? '',
                    payload.blockNumber
                )
            } else {
                if (id in retries) retries[id] = retries[id] + 1;
                else retries[id] = 1;
                console.log("Invalid data for id", id, "fee", payload.txnFee, "blockNumber", payload.blockNumber);
            }
        } catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error);
            console.log("Failed updating transaction info for id", id, errMessage);
            if (id in retries) {
                retries[id] = retries[id] + 1;
            } else {
                retries[id] = 1;
            }
        }
    }
}



// Hub-specific action carried by a Sonic tx, or null for a plain transfer.
// Checked most specific first: a fill also carries an intent hash and text.
async function specificHubAction(payload: TxPayload): Promise<{ action: string; actionText: string } | null> {
    if (payload.intentFilled) {
        let actionText = payload.actionText;
        // Raw event-tuple text means the calldata decode failed — recover the
        // detail from the sibling CreateIntent row, as the relay path does.
        if (isRawTupleActionText(actionText) && payload.intentTxHash && payload.filledOutputAmount) {
            try {
                const fmt = await recoverIntentFilledFormat(payload.intentTxHash, BigInt(payload.filledOutputAmount));
                if (fmt) actionText = fmt.actionDetail;
            } catch (err) {
                console.log('IntentFilled format recovery failed:', err instanceof Error ? err.message : String(err));
            }
        }
        return actionText ? { action: 'IntentFilled', actionText } : null;
    }
    if (payload.intentCancelled && payload.actionText) return { action: 'CancelIntent', actionText: payload.actionText };
    if (payload.reverseSwap && payload.actionText) return { action: 'Migration', actionText: payload.actionText };
    if (payload.actionText && payload.intentTxHash) return { action: 'CreateIntent', actionText: payload.actionText };
    return null;
}

async function fetchSonicReceiptLogs(txHash: string): Promise<ReceiptLog[]> {
    const { data } = await axios.post(RPC_URLS[sonic], {
        jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash],
    });
    if (!data.result) {
        throw new Error(`no Sonic receipt for ${txHash}${data.error ? `: ${data.error.message}` : ''}`);
    }
    return data.result.logs;
}

const main = async () => {
    await enrichChainsFromApi();

    const args = process.argv.slice(2);
    if (args.length === 0) {
        const hubIntentsTimer = startHubIntentsPoller();
        processSodaxStream().catch(console.error).finally(() => {
            isRunning = false;
        });
        const intervalId = setInterval(() => {
            if (isRunning) return;
            isRunning = true;
            processSodaxStream().catch(console.error).finally(() => {
                isRunning = false;
            });
        }, Number.parseInt(process.env.REQUEST_DELAY || "5000"));
        function shutdownHandler(signal: string) {
            return () => {
                console.log(`Received ${signal}. Cleaning up...`);
                clearInterval(intervalId);
                clearInterval(hubIntentsTimer);
                process.exit(0); // Exit cleanly
            };
        }
        process.on('SIGINT', shutdownHandler('SIGINT'));
        process.on('SIGTERM', shutdownHandler('SIGTERM'));
    } else {
        const eventId = args[0]
        const SINGLE_EVENT_SODAXSCAN_CONFIG = {
            method: 'get',
            url: `${process.env.SCANNER_URL}/api/messages/${eventId}`,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
            },
        };
        const response: SodaxScannerResponse = (await axios.request(SINGLE_EVENT_SODAXSCAN_CONFIG)).data satisfies SodaxScannerResponse;
        await parseTransactionEvent(response);
        await pool.end();
        process.exit(0);
    }
}

function cleanupRecords() {
    retries = {};
}

// Only auto-start when executed directly — scripts import
// parseTransactionEvent without booting the pollers.
if (require.main === module) {
    main().catch(console.error)
    setInterval(() => cleanupRecords(), 1800 * 1000);
}
