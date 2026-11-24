// Which characters of `next` changed versus `prev`, aligned from the right
// (the ones place stays the ones place when the number grows a digit).
// Returns a boolean per character of `next`. No prev: nothing changed.
export function changedMask(prev, next) {
    const n = next.length
    const mask = new Array(n).fill(false)
    if (prev == null || prev === next) return mask
    for (let i = 0; i < n; i++) {
        const j = prev.length - n + i
        mask[i] = j < 0 || prev[j] !== next[i]
    }
    return mask
}
