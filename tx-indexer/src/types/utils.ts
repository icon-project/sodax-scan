import { ethers } from 'ethers'

export interface FunctionSignature {
    name: string;
    signature: string;
    params: string[];
    selector?: string;
}

export interface DecodedFunction {
    function: string;
    [key: string]: string | number | boolean | object | undefined;
}

export interface Transfer {
    token: string;
    from: string;
    to: string;
    amount: bigint;
    data: string;
}

export type CallData = [string, string, string]; // [target, value, calldata]

export type DecodedParams = ethers.Result;