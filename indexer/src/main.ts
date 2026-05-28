import axios from "axios";
import { getHandler } from './handler'
import { bitcoin, chains, enrichChainsFromApi, solana, sonic } from "./configs";
import { getTransactionPackets, getPayloadFromRelayPacket, parsePayloadData } from "./action";
import { updateTransactionInfo } from "./db";
import dotenv from 'dotenv';
import { SendMessage, SodaxScannerResponse, Transfer } from "./types";
import { bigintDivisionToDecimalString, multiplyDecimalBy10Pow18, srcHasHashedPayload, extractConnSn } from "./utils";
import pool from './db/db';
import { ensureHubIntentsSchema } from './hub-intents/schema';
import { startHubIntentsPoller } from './hub-intents/poller';
import { isRawTupleActionText, recoverIntentFilledFormat } from './intent-fill-format';

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

async function parseTransactionEvent(response: SodaxScannerResponse) {
    for (const transaction of response.data) {
        const id = transaction.id;

        // Skip only if we've already seen this message and have nothing left to do for it.
        const alreadySeen = lastScannedId !== 0 && id <= lastScannedId;
        const hasIntentTxHash = transaction.intent_tx_hash != null && transaction.intent_tx_hash !== '';
        const createIntentDone = transaction.action_type !== 'CreateIntent' || hasIntentTxHash;
        const needsNoMoreWork = transaction.action_type !== 'SendMsg' && createIntentDone;
        if (alreadySeen && needsNoMoreWork) {
            continue;
        }

        if (id in retries && retries[id] > 4) {
            continue
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

                // If the handler emitted the raw event-tuple fallback
                // ("IntentFilled 0xHASH,bool,…,FILLED,…"), recover a proper
                // human-readable format using the intent hash + raw filled
                // amount the handler provided. Sources: hub_intent_events.filled
                // first, then the sibling CreateIntent message. If neither
                // resolves yet (e.g. sibling hasn't been ingested), keep the
                // existing text — the periodic backfill script catches it.
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



const main = async () => {
    await enrichChainsFromApi();

    const args = process.argv.slice(2);
    if (args.length === 0) {
        try {
            await ensureHubIntentsSchema();
        } catch (err) {
            console.error('hub-intents: schema bootstrap failed:', err);
        }
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

main().catch(console.error)
setInterval(() => cleanupRecords(), 1800 * 1000);
