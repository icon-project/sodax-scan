import { xdr } from "@stellar/stellar-sdk";
import { Message } from "./types";

export function stringToEncodedScVal(inputString: string): string {
    try {
        const scval = xdr.ScVal.scvString(inputString);
        return scval.toXDR("base64");
    } catch (error) {
        console.error("Error converting string to SCVal:", error);
        throw error;
    }
}

function decodeSingleScVal(scval: xdr.ScVal): string {
    switch (scval.switch().name) {
        case "scvU128": {
            const u128 = scval.u128();
            const high = u128.hi().toBigInt();
            const low = u128.lo().toBigInt();
            const bigIntValue = (BigInt(high) << BigInt(64)) | BigInt(low);
            return bigIntValue.toString();
        }
        case "scvU32":
            return scval.u32().toFixed();
        case "scvSymbol":
            return scval.sym().toString();
        case "scvString":
            return scval.str().toString();
        case "scvBytes":
            return Buffer.from(scval.bytes()).toString("base64");
        default:
            return `Unsupported type: ${scval.switch().name}`;
    }
}


export function scvMapToMap(scVal: xdr.ScVal): Map<string, string> {
    if (scVal.switch() === xdr.ScValType.scvMap()) {
        const scMap = scVal.map(); 
        const map = new Map<string, string>();
        if(scMap){
            for(const entry of scMap)
            {
                const key = decodeSingleScVal(entry.key());
                const value = decodeSingleScVal(entry.val());
                map.set(key, value);
            };
        }
        return map;
    } 
    throw new Error("Expected SCVal to be of type scvMap");
}


export function getMessageFromValue(txHash: string, xdrString: string): Message {
    const scval = xdr.ScVal.fromXDR(Buffer.from(xdrString, "base64"));
    const map = scvMapToMap(scval)
    return {
        srcChainId: map.get("src_chain_id") || "",
        srcAddress: map.get("src_address") || "",
        dstAddress: map.get("dst_address") || "",
        connSn: map.get("conn_sn") || "",
        dstChainId: map.get("dst_chain_id") || "",
        payload: map.get("payload") || "",
        txHash: txHash
    }
}
