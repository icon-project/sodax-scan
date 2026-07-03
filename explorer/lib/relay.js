// Server-only. Performs the xcall-relay `submit` call that ops otherwise run
// by hand via curl. Kept out of the client bundle so the relay endpoint and
// payload shape aren't advertised to visitors.
const DEFAULT_RELAY_URL = 'https://xcall-relay.nw.iconblockchain.xyz/'

export async function submitTx(chainId, txHash) {
    const url = process.env.RELAY_URL || DEFAULT_RELAY_URL
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'submit',
            params: { chain_id: String(chainId), tx_hash: String(txHash) }
        }),
        cache: 'no-store'
    })
    let body
    try {
        body = await res.text()
    } catch {
        body = ''
    }
    return { ok: res.ok, status: res.status, body }
}
