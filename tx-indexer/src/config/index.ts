import { FunctionSignature } from '../types/utils'

const AVAX_ASSET_MANAGER = '0x5bDD1E1C5173F4c912cC919742FB94A55ECfaf86';
export const ASSET_MANAGERS = [AVAX_ASSET_MANAGER];

export const CRON_INTERVAL = '*/2 * * * * *'; // Every 2 seconds

export const FUNCTION_SIGNATURES: FunctionSignature[] = [
    { name: 'deposit', signature: 'deposit(address,uint256)', params: ['address', 'uint256'] },
    { name: 'transfer', signature: 'transfer(address,uint256)', params: ['address', 'uint256'] },
    { name: 'supply', signature: 'supply(address,uint256,address,uint16)', params: ['address', 'uint256', 'address', 'uint16'] },
    { name: 'withdraw', signature: 'withdraw(address,uint256,address)', params: ['address', 'uint256', 'address'] },
    { name: 'borrow', signature: 'borrow(address,uint256,uint256,uint16,address)', params: ['address', 'uint256', 'uint256', 'uint16', 'address'] },
    { name: 'repay', signature: 'repay(address,uint256,uint256,address)', params: ['address', 'uint256', 'uint256', 'address'] },
    { name: 'createIntent', signature: 'createIntent((uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))', params: ['tuple(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)'] },
    { name: 'cancelIntent', signature: 'cancelIntent((uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes))', params: ['tuple(uint256,address,address,address,uint256,uint256,uint256,bool,uint256,uint256,bytes,bytes,address,bytes)'] },
];

export const PRIORITY_METHODS = [
    'supply',
    'withdraw',
    'borrow',
    'repay',
    'deposit',
    'createIntent',
    'cancelIntent',
    'transfer',
];