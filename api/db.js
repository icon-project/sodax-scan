const Pool = require('pg').Pool
const dotenv = require('dotenv')
dotenv.config()
const logger = require('./logger')
const { NETWORK, META_URLS } = require('./constants')

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    ssl: { rejectUnauthorized: false }
})
pool.on('error', function (error, client) {
    logger.error(error)
})

// Unified messages view: messages table + hub_intent_events shaped to the same columns.
// hub_intent_events rows get negative ids so they never collide with messages.id
// (BIGSERIAL, always positive); each event row already has a distinct id, so the
// negation keeps them distinct too. One row per on-chain event (created/filled/
// cancelled), all sharing intent_tx_hash — mirrors the relayer one-row-per-message
// model. The event tx is the source tx; these are single-tx hub events (no dest leg).
// Status: filled→executed, cancelled→rollbacked; a created row is pending until a
// fill or cancel for the same intent exists, then it reflects that outcome.
const UNIFIED_SUBQUERY = `(
    SELECT
        id, sn, status, src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app, src_error,
        dest_network, dest_block_number, dest_block_timestamp, dest_tx_hash, dest_app, dest_error,
        response_block_number, response_block_timestamp, response_tx_hash, response_error,
        rollback_block_number, rollback_block_timestamp, rollback_tx_hash, rollback_error,
        value, fee, action_type, action_detail, action_amount_usd,
        created_at, updated_at, intent_tx_hash, slippage
    FROM messages
    UNION ALL
    SELECT
        -e.id AS id,
        NULL::bigint AS sn,
        -- Hub events are single-tx on-chain actions that confirm immediately —
        -- there's no relay-leg waiting step. So each row's status reflects
        -- only its own event: created/filled = executed, cancelled = rollbacked.
        (CASE
            WHEN e.event_type = 'cancelled' THEN 'rollbacked'
            ELSE 'executed'
        END)::varchar AS status,
        e.src_chain_id::varchar           AS src_network,
        e.block_number                    AS src_block_number,
        e.block_timestamp                 AS src_block_timestamp,
        e.tx_hash::varchar                AS src_tx_hash,
        e.creator::varchar                AS src_app,
        NULL::varchar                     AS src_error,
        e.dst_chain_id::varchar           AS dest_network,
        NULL::bigint                      AS dest_block_number,
        NULL::bigint                      AS dest_block_timestamp,
        NULL::varchar                     AS dest_tx_hash,
        e.solver::varchar                 AS dest_app,
        NULL::varchar                     AS dest_error,
        NULL::bigint                      AS response_block_number,
        NULL::bigint                      AS response_block_timestamp,
        NULL::varchar                     AS response_tx_hash,
        NULL::varchar                     AS response_error,
        NULL::bigint                      AS rollback_block_number,
        NULL::bigint                      AS rollback_block_timestamp,
        NULL::varchar                     AS rollback_tx_hash,
        NULL::varchar                     AS rollback_error,
        NULL::varchar AS value,
        NULL::varchar AS fee,
        e.action_type::varchar AS action_type,
        e.action_detail::varchar AS action_detail,
        NULL::varchar AS action_amount_usd,
        e.created_at,
        e.updated_at,
        e.intent_hash::varchar AS intent_tx_hash,
        e.slippage::varchar    AS slippage
    FROM hub_intent_events e
) u`

const buildWhereSql = (status, src_network, dest_network, src_address, dest_address, from_timestamp, to_timestamp, action_type, intent_tx_hash) => {
    let values = []
    let conditions = []
    if (status) {
        conditions.push(`status = $${conditions.length + 1}`)
        values.push(status)
    }
    if (src_network) {
        conditions.push(`src_network = any(string_to_array($${conditions.length + 1},','))`)
        values.push(src_network)
    }
    if (dest_network) {
        conditions.push(`dest_network = any(string_to_array($${conditions.length + 1},','))`)
        values.push(dest_network)
    }
    if (src_address) {
        conditions.push(`LOWER(src_app) = LOWER($${conditions.length + 1})`)
        values.push(src_address)
    }
    if (dest_address) {
        conditions.push(`LOWER(dest_app) = LOWER($${conditions.length + 1})`)
        values.push(dest_address)
    }
    if (from_timestamp) {
        conditions.push(`created_at >= $${conditions.length + 1}`)
        values.push(from_timestamp)
    }
    if (to_timestamp) {
        conditions.push(`(created_at <= $${conditions.length + 1} OR
                            dest_block_timestamp <= $${conditions.length + 1} OR
                            response_block_timestamp <= $${conditions.length + 1} OR
                            rollback_block_timestamp <= $${conditions.length + 1})`)
        values.push(to_timestamp)
    }
    if (action_type) {
        conditions.push(`action_type = any(string_to_array($${conditions.length + 1},','))`)
        values.push(action_type)
    }
    if (intent_tx_hash) {
        conditions.push(`intent_tx_hash = $${conditions.length + 1}`)
        values.push(intent_tx_hash)
    }

    return { conditions, values }
}

const LIST_FIELDS = ` id, sn, status, src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app as src_address, src_error,
                      dest_network, dest_block_number, dest_block_timestamp, dest_tx_hash, dest_app as dest_address, dest_error,
                      response_block_number, response_block_timestamp, response_tx_hash, response_error,
                      rollback_block_number, rollback_block_timestamp, rollback_tx_hash, rollback_error,
                      action_type, created_at, updated_at, intent_tx_hash, slippage `

const DETAIL_FIELDS = ` id, sn, status, src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app as src_address, src_error,
                        dest_network, dest_block_number, dest_block_timestamp, dest_tx_hash, dest_app as dest_address, dest_error,
                        response_block_number, response_block_timestamp, response_tx_hash, response_error,
                        rollback_block_number, rollback_block_timestamp, rollback_tx_hash, rollback_error,
                        value, fee, action_type, action_detail, action_amount_usd, created_at, updated_at, slippage, intent_tx_hash `

const SEARCH_FIELDS = ` id, sn, status, src_network, src_block_number, src_block_timestamp, src_tx_hash, src_app as src_address, src_error,
                        dest_network, dest_block_number, dest_block_timestamp, dest_tx_hash, dest_app as dest_address, dest_error,
                        response_block_number, response_block_timestamp, response_tx_hash, response_error,
                        rollback_block_number, rollback_block_timestamp, rollback_tx_hash, rollback_error,
                        value, fee, created_at, updated_at, action_type, action_detail, intent_tx_hash, slippage `

const getMessages = async (skip, limit, status, src_network, dest_network, src_address, dest_address, from_timestamp, to_timestamp, action_type, intent_tx_hash) => {
    let { conditions, values } = buildWhereSql(
        status,
        src_network,
        dest_network,
        src_address,
        dest_address,
        from_timestamp,
        to_timestamp,
        action_type,
        intent_tx_hash
    )

    let sqlTotal = `SELECT count(*) FROM ${UNIFIED_SUBQUERY}`
    let sqlMessages = `SELECT ${LIST_FIELDS}
                       FROM ${UNIFIED_SUBQUERY}
                       ORDER BY created_at DESC, sn DESC NULLS LAST
                       OFFSET $1 LIMIT $2`
    if (conditions.length > 0) {
        sqlTotal = `SELECT count(*) FROM ${UNIFIED_SUBQUERY} WHERE ${conditions.join(' AND ')}`
        sqlMessages = `SELECT ${LIST_FIELDS}
                       FROM ${UNIFIED_SUBQUERY}
                       WHERE ${conditions.join(' AND ')}
                       ORDER BY created_at DESC
                       OFFSET $${conditions.length + 1} LIMIT $${conditions.length + 2}`
    }

    const totalRs = await pool.query(sqlTotal, values)
    const messagesRs = await pool.query(sqlMessages, values.concat([skip, limit]))

    return {
        data: messagesRs.rows,
        meta: {
            urls: META_URLS,
            pagination: {
                total: Math.ceil(Number(totalRs.rows[0].count) / Number(limit)),
                size: Number(limit),
                number: Math.floor(Number(skip) / Number(limit)) + 1
            },
            time: Math.floor(Date.now() / 1000)
        }
    }
}

const getMessageById = async (id) => {
    const sql = `SELECT ${DETAIL_FIELDS} FROM ${UNIFIED_SUBQUERY} WHERE id = $1`
    const messagesRs = await pool.query(sql, [id])
    return {
        data: messagesRs.rows,
        meta: {
            urls: META_URLS
        }
    }
}

const searchMessages = async (value) => {
    const messagesRs = await pool.query(
        `SELECT ${SEARCH_FIELDS}
         FROM ${UNIFIED_SUBQUERY}
         WHERE src_tx_hash = $1 OR dest_tx_hash = $1 OR response_tx_hash = $1 OR rollback_tx_hash = $1 OR sn = $2 OR intent_tx_hash = $1
         ORDER BY src_block_timestamp DESC NULLS LAST`,
        [value, value.startsWith('0x') || !Number.isInteger(Number(value)) ? '0' : value]
    )
    return {
        data: messagesRs.rows,
        meta: {
            urls: META_URLS
        }
    }
}

// TODO: to be removed
const getStatistic = async () => {
    const totalRs = await pool.query(`SELECT count(*) FROM ${UNIFIED_SUBQUERY}`)
    const messages = Number(totalRs.rows[0].count)
    const fees = {}
    const networks = Object.values(NETWORK)
    for (let index = 0; index < networks.length; index++) {
        const network = networks[index]
        const feeRs = await pool.query(`SELECT sum(cast(value as decimal)) FROM ${UNIFIED_SUBQUERY} WHERE src_network = $1`, [network])
        fees[network] = feeRs.rows[0].sum ? feeRs.rows[0].sum.toString() : '0'
    }

    return {
        data: {
            messages,
            fees
        },
        meta: {
            urls: META_URLS
        }
    }
}

const getTotalMessages = async (status, src_networks, dest_networks, src_address, dest_address, from_timestamp, to_timestamp) => {
    let data = {}

    let { conditions, values } = buildWhereSql(status, src_networks, dest_networks, src_address, dest_address, from_timestamp, to_timestamp)
    let sql = `SELECT count(*) as total FROM ${UNIFIED_SUBQUERY}`
    if (conditions.length == 0) {
        const totalRs = await pool.query(sql, values)
        const total = Number(totalRs.rows[0].total)
        data.total = total
    } else {
        if (!src_networks && !dest_networks) {
            sql = `SELECT count(*) as total
                    FROM ${UNIFIED_SUBQUERY}
                    WHERE ${conditions.join(' AND ')}`
            const totalRs = await pool.query(sql, values)
            const total = Number(totalRs.rows[0].total)
            data.total = total
        } else {
            if (src_networks) {
                let { conditions, values } = buildWhereSql(status, src_networks, undefined, src_address, dest_address, from_timestamp, to_timestamp)
                sql = `SELECT src_network, count(*) as total
                    FROM ${UNIFIED_SUBQUERY}
                    WHERE ${conditions.join(' AND ')}
                    GROUP BY src_network
                    ORDER BY src_network`
                const srcNetworkTotalRs = await pool.query(sql, values)
                data.src_networks = {}
                srcNetworkTotalRs.rows.forEach((n) => {
                    data.src_networks[n.src_network] = { total: Number(n.total) }
                })
            }
            if (dest_networks) {
                let { conditions, values } = buildWhereSql(status, undefined, dest_networks, src_address, dest_address, from_timestamp, to_timestamp)
                sql = `SELECT dest_network, count(*) as total
                    FROM ${UNIFIED_SUBQUERY}
                    WHERE ${conditions.join(' AND ')}
                    GROUP BY dest_network
                    ORDER BY dest_network`
                const destNetworkTotalRs = await pool.query(sql, values)
                data.dest_networks = {}
                destNetworkTotalRs.rows.forEach((n) => {
                    data.dest_networks[n.dest_network] = { total: Number(n.total) }
                })
            }
        }
    }

    return {
        data
    }
}

// Direct hub_intent_events access — kept for utility / admin. /api/messages already
// surfaces these via the unified subquery above. One row per on-chain event.
const HUB_INTENT_FIELDS = ` id, intent_hash, event_type, action_type, creator, solver,
    input_token, output_token, input_amount, min_output_amount, filled_output_amount,
    src_chain_id, dst_chain_id, block_number, block_timestamp, tx_hash, log_index,
    slippage, action_detail, created_at, updated_at `

// `status` here filters on event_type (created|filled|cancelled) for backward compat
// with the previous per-intent status vocabulary, which used the same words.
const buildHubIntentsWhereSql = (status, creator, from_timestamp, to_timestamp) => {
    let values = []
    let conditions = []
    if (status) {
        conditions.push(`event_type = any(string_to_array($${conditions.length + 1},','))`)
        values.push(status)
    }
    if (creator) {
        conditions.push(`LOWER(creator) = LOWER($${conditions.length + 1})`)
        values.push(creator)
    }
    if (from_timestamp) {
        conditions.push(`block_timestamp >= $${conditions.length + 1}`)
        values.push(from_timestamp)
    }
    if (to_timestamp) {
        conditions.push(`block_timestamp <= $${conditions.length + 1}`)
        values.push(to_timestamp)
    }
    return { conditions, values }
}

const getHubIntents = async (skip, limit, status, creator, from_timestamp, to_timestamp) => {
    const { conditions, values } = buildHubIntentsWhereSql(status, creator, from_timestamp, to_timestamp)

    let sqlTotal = `SELECT count(*) FROM hub_intent_events`
    let sqlRows = `SELECT ${HUB_INTENT_FIELDS}
                    FROM hub_intent_events
                    ORDER BY block_timestamp DESC NULLS LAST, id DESC
                    OFFSET $1 LIMIT $2`
    if (conditions.length > 0) {
        sqlTotal = `SELECT count(*) FROM hub_intent_events WHERE ${conditions.join(' AND ')}`
        sqlRows = `SELECT ${HUB_INTENT_FIELDS}
                    FROM hub_intent_events
                    WHERE ${conditions.join(' AND ')}
                    ORDER BY block_timestamp DESC NULLS LAST, id DESC
                    OFFSET $${conditions.length + 1} LIMIT $${conditions.length + 2}`
    }

    const totalRs = await pool.query(sqlTotal, values)
    const rowsRs = await pool.query(sqlRows, values.concat([skip, limit]))

    return {
        data: rowsRs.rows,
        meta: {
            urls: META_URLS,
            pagination: {
                total: Math.ceil(Number(totalRs.rows[0].count) / Number(limit)),
                size: Number(limit),
                number: Math.floor(Number(skip) / Number(limit)) + 1
            },
            time: Math.floor(Date.now() / 1000)
        }
    }
}

// Returns the full event timeline for an intent (created → filled/cancelled),
// oldest first.
const getHubIntentByHash = async (hash) => {
    const rs = await pool.query(
        `SELECT ${HUB_INTENT_FIELDS} FROM hub_intent_events
         WHERE intent_hash = $1
         ORDER BY block_timestamp ASC NULLS LAST, id ASC`,
        [hash]
    )
    return {
        data: rs.rows,
        meta: { urls: META_URLS }
    }
}

module.exports = {
    getMessages,
    getMessageById,
    searchMessages,
    getStatistic,
    getTotalMessages,
    getHubIntents,
    getHubIntentByHash
}
