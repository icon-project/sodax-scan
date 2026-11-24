// Human-readable label for a message's action_type.
// Known indexer values get a curated label; anything else (including the
// lowercase legacy values) falls back to camelCase -> sentence case, so a new
// action type still reads sensibly without a code change.
const ACTION_LABELS = {
    SendMsg: 'Send message',
    SolverMarketPlaceFill: 'Solver fill',
    IntentFilled: 'Intent filled',
    CreateIntent: 'Create intent',
    CancelIntent: 'Cancel intent'
}

export default function actionLabel(actionType) {
    if (actionType == null) return ''
    const raw = String(actionType).trim()
    if (!raw) return ''
    if (ACTION_LABELS[raw]) return ACTION_LABELS[raw]
    const words = raw
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
    return words.charAt(0).toUpperCase() + words.slice(1)
}
