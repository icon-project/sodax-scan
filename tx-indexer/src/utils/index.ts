import { ethers } from 'ethers';
import { RLP } from "@ethereumjs/rlp";
import { FunctionSignature, DecodedFunction, CallData, Transfer, DecodedParams } from '../types/utils'
import { FUNCTION_SIGNATURES, PRIORITY_METHODS } from '../config'
import { ASSET_MANAGERS } from '../config'

function calculateSelector(signature: string): string {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
    return hash.slice(0, 10);
}

function createFunctionSelectors(): Record<string, FunctionSignature> {
    return FUNCTION_SIGNATURES.reduce((acc, fn) => {
        acc[fn.selector || calculateSelector(fn.signature)] = fn;
        return acc;
    }, {} as Record<string, FunctionSignature>);
}

function mapDecodedParams(fn: FunctionSignature, decoded: DecodedParams): DecodedFunction {
    const functionMappers: Record<string, (decoded: DecodedParams) => DecodedFunction> = {
        'deposit': (d) => ({ function: 'deposit', token: String(d[0]), amount: String(d[1]) }),
        'transfer': (d) => ({ function: 'transfer', to: String(d[0]), amount: String(d[1]) }),
        'supply': (d) => ({ function: 'supply', to: String(d[0]), amount: String(d[1]) }),
        'withdraw': (d) => ({ function: 'withdraw', token: String(d[0]), amount: String(d[1]), to: String(d[2]) }),
        'borrow': (d) => ({ function: 'borrow', asset: String(d[0]), amount: String(d[1]), interestRateMode: String(d[2]), referralCode: Number(d[3]), onBehalfOf: String(d[4]) }),
        'repay': (d) => ({ function: 'repay', asset: String(d[0]), amount: String(d[1]), rateMode: String(d[2]), onBehalfOf: String(d[3]) }),
        'createIntent': (d) => ({ function: 'createIntent', intent: d[0] as object }),
        'cancelIntent': (d) => ({ function: 'cancelIntent', intent: d[0] as object })
    };

    const mapper = functionMappers[fn.name];
    return mapper ? mapper(decoded) : { function: fn.name, params: decoded.toString() };
}

function decodeFunctionCall(callData: string, abiCoder: ethers.AbiCoder): DecodedFunction | null {
    if (!callData || callData === '0x') return null;

    const selector = callData.slice(0, 10);
    const functionSelectors = createFunctionSelectors();
    const fn = functionSelectors[selector];

    if (!fn) return { function: 'unknown', selector };

    try {
        const decoded = abiCoder.decode(fn.params, `0x${callData.slice(10)}`);
        return mapDecodedParams(fn, decoded);
    } catch (error) {
        console.error('Error decoding function call:', error);
        return { function: 'error', selector };
    }
}

function findPriorityFunction(decodedCalls: (DecodedFunction | null)[]): DecodedFunction {
    const validCalls = decodedCalls.filter((call): call is DecodedFunction => call !== null);

    for (const priorityMethod of PRIORITY_METHODS) {
        const found = validCalls.find(decoded => decoded.function === priorityMethod);
        if (found) return found;
    }

    return { function: 'unknown' };
}

export function priority(decodedOuter: CallData[], abiCoder: ethers.AbiCoder): DecodedFunction {
    if (!decodedOuter || decodedOuter.length === 0) {
        return { function: 'unknown' };
    }

    const decodedCalls = decodedOuter.map((call: CallData) => decodeFunctionCall(call[2], abiCoder));
    return findPriorityFunction(decodedCalls);
}

function parseRLPTransfer(decodedRLP: Buffer[]): Transfer {
    return {
        token: `0x${decodedRLP[0].toString('hex')}`,
        from: `0x${decodedRLP[1].toString('hex')}`,
        to: `0x${decodedRLP[2].toString('hex')}`,
        amount: BigInt(`0x${decodedRLP[3].toString('hex')}`),
        data: `0x${decodedRLP[4].toString('hex')}`
    };
}

function handleTransferDecoding(transfer: Transfer, abiCoder: ethers.AbiCoder): DecodedFunction {
    if (transfer.data !== '0x') {
        try {
            const decodedOuter = abiCoder.decode(['(address,uint256,bytes)[]'], transfer.data);
            const callDataArray = decodedOuter[0] as CallData[];
            return priority(callDataArray, abiCoder);
        } catch (error) {
            console.error('Error decoding transfer data:', error);
            return { function: 'error' };
        }
    }

    if (ASSET_MANAGERS.includes(transfer.to)) {
        return {
            function: 'deposit',
            to: transfer.to,
            amount: transfer.amount.toString()
        };
    }

    return { function: 'sendMsg' };
}

export const decodePayload = (bufferPayload: Buffer): DecodedFunction => {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    try {
        const decodedRLP = RLP.decode(bufferPayload);

        if (Array.isArray(decodedRLP) && decodedRLP.length === 5) {
            const transfer = parseRLPTransfer(decodedRLP as Buffer[]);
            return handleTransferDecoding(transfer, abiCoder);
        }
    } catch (rlpError) {
        // Fall back to direct ABI decoding
        try {
            const decodedOuter = abiCoder.decode(['(address,uint256,bytes)[]'], bufferPayload);
            const callDataArray = decodedOuter[0] as CallData[];
            return priority(callDataArray, abiCoder);
        } catch (abiError) {
            console.error('Error decoding payload:', { rlpError, abiError });
            return { function: 'unknown' };
        }
    }

    return { function: 'unknown' };
};
