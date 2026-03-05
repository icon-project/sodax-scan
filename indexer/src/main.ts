import axios from 'axios'
import { getHandler } from './handler'
import { chains, solana, sonic, bitcoin } from './configs'
import { decodeBitcoinPayload, mapBitcoinPayloadToActionType, parseBitcoinTransaction, parsePayloadData, parseSolanaTransaction } from './action'
import { updateTransactionInfo } from './db'
import dotenv from 'dotenv'
import { actionType, SendMessage, SodaxScannerResponse, Transfer } from './types'
import { bigintDivisionToDecimalString, multiplyDecimalBy10Pow18, srcHasHashedPayload } from './utils'
import pool from './db/db'

dotenv.config()
const SODAXSCAN_CONFIG = {
    method: 'get',
    url: `${process.env.SCANNER_URL}/api/messages?skip=0&limit=${Number.parseInt(process.env.LIMIT || '10')}`,
    headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd'
    }
}

let lastScannedId = 0
let isRunning = true
let retries: Record<string, number> = {}
const processSodaxStream = async () => {
    const response: SodaxScannerResponse = (await axios.request(SODAXSCAN_CONFIG)).data satisfies SodaxScannerResponse
    await parseTransactionEvent(response)
    lastScannedId = response.data[0].id
}

async function parseTransactionEvent(response: SodaxScannerResponse) {
    for (const transaction of response.data) {
        const id = transaction.id

        // Skip only if we've already seen this message and have nothing left to do for it.
        const alreadySeen = lastScannedId !== 0 && id <= lastScannedId
        const hasIntentTxHash = transaction.intent_tx_hash != null && transaction.intent_tx_hash !== ''
        const createIntentDone = transaction.action_type !== 'CreateIntent' || hasIntentTxHash
        const needsNoMoreWork = transaction.action_type !== 'SendMsg' && createIntentDone
        if (alreadySeen && needsNoMoreWork) {
            continue
        }

        if (id in retries && retries[id] > 4) {
            continue
        }
        const srcChainId = transaction.src_network as string
        const dstChainId = transaction.dest_network as string
        try {
            console.log('Processing txn', transaction.src_tx_hash)
            const txHash = transaction.src_tx_hash
            const payload = await getHandler(srcChainId).fetchPayload(txHash, transaction.sn)
            console.log('FULL PAYLOAD', payload)
            let actionType: actionType
            actionType = parsePayloadData(payload.payload, srcChainId, dstChainId)

            // console.log('ACTION TYPE', actionType)
            if (actionType.intentTxHash) {
                payload.intentTxHash = actionType.intentTxHash
            }
            if (actionType.action === SendMessage) {
                if (srcChainId === solana) {
                    try {
                        const solanaPayload = await parseSolanaTransaction(transaction.src_tx_hash, transaction.sn)
                        if (solanaPayload !== '0x') {
                            actionType = parsePayloadData(solanaPayload, srcChainId, dstChainId)
                        }
                    } catch (error) {
                        console.log('Error parsing Solana transaction', error)
                    }
                }
                // if (dstChainId === bitcoin) {
                //     console.log("Decoding bitcoin payload", payload.payload);
                //     const decoded = decodeBitcoinPayload(payload.payload);
                //     console.log("Decoded bitcoin payload", decoded);
                //     if (decoded) {
                //         actionType = mapBitcoinPayloadToActionType(decoded, srcChainId, dstChainId);
                //         if (payload.intentTxHash && !payload.intentFilled && !payload.intentCancelled) {
                //             actionType.action = "CreateIntent";
                //             actionType.intentTxHash = payload.intentTxHash;
                //             actionType.actionText = `CreateIntent ${actionType.actionText ?? ""} to Bitcoin`;
                //         }
                //     } else {
                //         actionType = { action: SendMessage };
                //     }
                // }
            }

            // do this because the ones we test are already in the db and not as sendmsg
            if (dstChainId === bitcoin) {
                console.log('Decoding bitcoin payload', payload.payload)
                const decoded = decodeBitcoinPayload(payload.payload)
                if (decoded) {
                    actionType = mapBitcoinPayloadToActionType(decoded, srcChainId, dstChainId)
                    if (payload.intentTxHash && !payload.intentFilled && !payload.intentCancelled) {
                        actionType.action = 'CreateIntent'
                        actionType.intentTxHash = payload.intentTxHash
                        actionType.actionText = `CreateIntent ${actionType.actionText ?? ''} to Bitcoin`
                    }
                    try {
                    const bitcoinPayload = await parseBitcoinTransaction(transaction.src_tx_hash, transaction.sn)
                        console.log('Bitcoin payload', bitcoinPayload)
                        if (bitcoinPayload !== '0x') {
                            actionType = parsePayloadData(bitcoinPayload, srcChainId, dstChainId)
                        }
                    } catch (error) {
                        console.log('Error parsing Bitcoin transaction')
                    }
                } else {
                    actionType = { action: SendMessage }
                }
            }

            if (payload.intentFilled) {
                actionType.action = 'IntentFilled'
                actionType.actionText = payload.actionText
                actionType.swapInputToken = payload.swapInputToken
                actionType.swapOutputToken = payload.swapOutputToken
            }
            if (payload.intentCancelled) {
                actionType.action = 'CancelIntent'
                actionType.actionText = payload.actionText
                console.log(payload)
            }
            if (payload.reverseSwap) {
                actionType.action = 'Migration'
                actionType.actionText = payload.actionText
            }
            const assetManager = chains[srcChainId].AssetManager
            let assetsInformation = chains[srcChainId].Assets
            if (srcChainId === sonic) {
                assetsInformation = chains[dstChainId].Assets
            }
            if (actionType.action === Transfer || actionType.action === SendMessage) {
                const dstAddress: string = payload.dstAddress || ''
                if (dstAddress.toLowerCase() === assetManager.toLowerCase()) {
                    actionType.action = 'Deposit'
                    const token = actionType.tokenAddress || ''
                    if (token in assetsInformation) {
                        const adjustedAmount = bigintDivisionToDecimalString(
                            BigInt(multiplyDecimalBy10Pow18(actionType.amount || '0')),
                            assetsInformation[token].decimals
                        )
                        actionType.denom = assetsInformation[token].name
                        actionType.actionText = `Deposit ${adjustedAmount} ${actionType.denom}`
                    } else {
                        actionType.actionText = `Deposit ${actionType.amount} ${actionType.tokenAddress}`
                    }
                }
            }
            console.log(`Action: ${actionType.action} \nAction Details: ${actionType.actionText} \nTransaction Fee: ${payload.txnFee}\n\n`)
            if (actionType.action === 'SendMsg') {
                if (id in retries) {
                    retries[id] = retries[id] + 1
                } else {
                    retries[id] = 1
                }

                if (srcHasHashedPayload(srcChainId) && transaction.dest_tx_hash) {
                    const dstPayload = await getHandler(dstChainId).fetchPayload(transaction.dest_tx_hash, transaction.sn)
                    if (dstPayload.storedCallReverted) {
                        actionType.action = 'Reverted'
                        actionType.actionText = 'StoredCallReverted'
                        console.log('Reverted transaction found', dstPayload)
                    } else {
                        console.log('No reverted transaction found', dstPayload)
                    }
                }
            }
            if (actionType.action === 'CreateIntent') {
                if (transaction.dest_tx_hash) {
                    const dstPayload = await getHandler(dstChainId).fetchPayload(transaction.dest_tx_hash, transaction.sn)
                    payload.intentTxHash = dstPayload.intentTxHash
                }
                // else: keep payload.intentTxHash (e.g. from Bitcoin path)
            }

            // Only update DB when we have valid data (avoids JSON/undefined errors from bad payloads)
            const feeValid = typeof payload.txnFee === 'string'
            const blockNumberValid = typeof payload.blockNumber === 'number'
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
                if (id in retries) retries[id] = retries[id] + 1
                else retries[id] = 1
                console.log('Invalid data for id', id, 'fee', payload.txnFee, 'blockNumber', payload.blockNumber)
            }
        } catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error)
            console.log('Failed updating transaction info for id', id, errMessage)
            if (id in retries) {
                retries[id] = retries[id] + 1
            } else {
                retries[id] = 1
            }
        }
    }
}

const main = async () => {
    console.log('RELAY URL', process.env.RELAY_URL)
    const args = process.argv.slice(2)
    if (args.length === 0) {
        processSodaxStream()
            .catch(console.error)
            .finally(() => {
                isRunning = false
            })
        const intervalId = setInterval(
            () => {
                if (isRunning) return
                isRunning = true
                processSodaxStream()
                    .catch(console.error)
                    .finally(() => {
                        isRunning = false
                    })
            },
            Number.parseInt(process.env.REQUEST_DELAY || '5000')
        )
        function shutdownHandler(signal: string) {
            return () => {
                console.log(`Received ${signal}. Cleaning up...`)
                clearInterval(intervalId)
                process.exit(0) // Exit cleanly
            }
        }
        process.on('SIGINT', shutdownHandler('SIGINT'))
        process.on('SIGTERM', shutdownHandler('SIGTERM'))
    } else {
        const eventId = args[0]
        const SINGLE_EVENT_SODAXSCAN_CONFIG = {
            method: 'get',
            url: `${process.env.SCANNER_URL}/api/messages/${eventId}`,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: '*/*',
                'Accept-Encoding': 'gzip, deflate, br, zstd'
            }
        }
        const response: SodaxScannerResponse = (await axios.request(SINGLE_EVENT_SODAXSCAN_CONFIG)).data satisfies SodaxScannerResponse
        await parseTransactionEvent(response)
        await pool.end()
        process.exit(0)
    }
}

function cleanupRecords() {
    retries = {}
}

main().catch(console.error)
setInterval(() => cleanupRecords(), 1800 * 1000)
