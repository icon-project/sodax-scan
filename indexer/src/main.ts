import axios from "axios";
import { getHandler } from './handler'
import { chains, solana, sonic } from "./configs";
import { parsePayloadData, parseSolanaTransaction } from "./action";
import { updateTransactionInfo } from "./db";
import dotenv from 'dotenv';
import { SendMessage, SodaxScannerResponse, Transfer } from "./types";
import { bigintDivisionToDecimalString, multiplyDecimalBy10Pow18, srcHasHashedPayload } from "./utils";
import pool from './db/db';

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
        let lastUpdateArgs: { id: number; fee: unknown; actionType: unknown; actionText: unknown; intentTxHash: unknown; slippage: unknown; blockNumber: unknown } | null = null;
        try {
            console.log("Processing txn", transaction.src_tx_hash);
            const txHash = transaction.src_tx_hash;
            const payload = await getHandler(srcChainId).fetchPayload(txHash, transaction.sn);
            let actionType = parsePayloadData(payload.payload, srcChainId, dstChainId, 'initial');
            if (actionType.intentTxHash) {
                payload.intentTxHash = actionType.intentTxHash
            }
            if (actionType.action === SendMessage) {
                if (srcChainId === solana) {
                    const payload = await parseSolanaTransaction(transaction.src_tx_hash, transaction.sn)
                    if (payload !== "0x") {
                        actionType = parsePayloadData(payload, srcChainId, dstChainId, 'Solana fallback');
                    }
                }
            }
            if (payload.intentFilled) {
                actionType.action = "IntentFilled";
                actionType.actionText = payload.actionText;
                actionType.swapInputToken = payload.swapInputToken;
                actionType.swapOutputToken = payload.swapOutputToken;
            }
            if (payload.intentCancelled) {
                actionType.action = "CancelIntent";
                actionType.actionText = payload.actionText;
                console.log(payload)
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
            console.log(`Action: ${actionType.action} \nAction Details: ${actionType.actionText} \nTransaction Fee: ${payload.txnFee}\n\n`);
            if (actionType.action === "SendMsg") {
                if (id in retries) {
                    retries[id] = retries[id] + 1
                } else {
                    retries[id] = 1
                }

                if (srcHasHashedPayload(srcChainId) && transaction.dest_tx_hash) {
                    // todo: remove when verified that this is working
                    console.log("Checking for reverted transaction", transaction.dest_tx_hash, transaction.sn, dstChainId);
                    const dstPayload = await getHandler(dstChainId).fetchPayload(transaction.dest_tx_hash, transaction.sn);
                    if (dstPayload.storedCallReverted) {
                        actionType.action = "Reverted";
                        actionType.actionText = "StoredCallReverted";
                        console.log("Reverted transaction found", dstPayload);
                    } else {
                        console.log("No reverted transaction found", dstPayload);
                    }
                }
            }
            if (actionType.action === "CreateIntent") {
                if (transaction.dest_tx_hash) {
                    const dstPayload = await getHandler(dstChainId).fetchPayload(transaction.dest_tx_hash, transaction.sn);
                    payload.intentTxHash = dstPayload.intentTxHash
                } else {
                    payload.intentTxHash = undefined
                }
            }

            // Only update DB when we have valid data (avoids JSON/undefined errors from bad payloads)
            const feeValid = typeof payload.txnFee === 'string';
            const blockNumberValid = typeof payload.blockNumber === 'number';
            const DEBUG_TX_HASH = '2SASERdAfFVYhqxZoFGSFozQif3Ar8MAThPcSAFr2FrLn1dnAMbPqZfpgaAxeCwKzehRv4uwxFxJSSp6XVKzXHnR';
            const DEBUG_ID = 156988;
            const isDebugTx = txHash === DEBUG_TX_HASH || id === DEBUG_ID;
            if (feeValid && blockNumberValid) {
                lastUpdateArgs = {
                    id,
                    fee: payload.txnFee,
                    actionType: actionType.action,
                    actionText: actionType.actionText ?? '',
                    intentTxHash: payload.intentTxHash ?? '',
                    slippage: payload.slippage ?? '',
                    blockNumber: payload.blockNumber,
                };
                if (isDebugTx) {
                    const updateArgs = [
                        ['id', id],
                        ['fee', payload.txnFee],
                        ['actionType', actionType.action],
                        ['actionText', actionType.actionText ?? ''],
                        ['intentTxHash', payload.intentTxHash ?? ''],
                        ['slippage', payload.slippage ?? ''],
                        ['blockNumber', payload.blockNumber],
                    ] as const;
                    console.log(
                        '[DEBUG] updateTransactionInfo args id=' + id + ' txHash=' + txHash.slice(0, 12) + '... attempt=' + (retries[id] ?? 1) + ':',
                        updateArgs.map(([name, v]) => `${name}=${typeof v === 'undefined' ? 'undefined' : JSON.stringify(v)}`).join(', ')
                    );
                }
                await updateTransactionInfo(id, payload.txnFee, actionType.action,
                    actionType.actionText || "", payload.intentTxHash ?? '', payload.slippage ?? '', payload.blockNumber);
            } else {
                if (id in retries) retries[id] = retries[id] + 1;
                else retries[id] = 1;
                if (isDebugTx) {
                    console.log("[DEBUG] Skipped update (invalid data) id=" + id + " txHash=" + txHash.slice(0, 12) + "... feeValid=" + feeValid + " blockNumberValid=" + blockNumberValid + " fee=" + payload.txnFee + " blockNumber=" + payload.blockNumber);
                } else {
                    console.log("Invalid data for id", id, "fee", payload.txnFee, "blockNumber", payload.blockNumber);
                }
            }
        } catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error);
            const firstFailure = !(id in retries);
            if (firstFailure) {
                console.log("Failed updating transaction info for id", id, errMessage);
                if (lastUpdateArgs && lastUpdateArgs.id === id) {
                    console.log("  -> updateTransactionInfo args we tried to pass:", JSON.stringify(lastUpdateArgs, (_, v) => (v === undefined ? '<undefined>' : v)));
                }
            }
            // Count failed attempts so we eventually skip this message (avoids endless retry on parse/DB errors)
            if (id in retries) {
                retries[id] = retries[id] + 1;
            } else {
                retries[id] = 1;
            }
        }
    }
}

const main = async () => {
    const args = process.argv.slice(2);
    if (args.length === 0) {
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