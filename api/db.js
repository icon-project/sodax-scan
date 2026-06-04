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

// Hub-origin rows are written into `messages` with sn = NULL; relayer rows
// have sn IS NOT NULL. They share the same `intent_tx_hash`. The hub
// poller skips its CreateIntent row when the relayer already has an
// enriched one (spoke-originated creation), so an intent normally has a
// single CreateIntent. A hub create row with no relayer twin means the
// intent was created directly on the hub — or the relay row never
// enriched and the hub event is the only usable record.

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

    let sqlTotal = `SELECT count(*) FROM messages`
    let sqlMessages = `SELECT ${LIST_FIELDS}
                       FROM messages
                       ORDER BY created_at DESC, sn DESC NULLS LAST
                       OFFSET $1 LIMIT $2`
    if (conditions.length > 0) {
        sqlTotal = `SELECT count(*) FROM messages WHERE ${conditions.join(' AND ')}`
        sqlMessages = `SELECT ${LIST_FIELDS}
                       FROM messages
                       WHERE ${conditions.join(' AND ')}
                       ORDER BY created_at DESC, sn DESC NULLS LAST
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
    const sql = `SELECT ${DETAIL_FIELDS} FROM messages WHERE id = $1`
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
         FROM messages
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
    const totalRs = await pool.query(`SELECT count(*) FROM messages`)
    const messages = Number(totalRs.rows[0].count)
    const fees = {}
    const networks = Object.values(NETWORK)
    for (let index = 0; index < networks.length; index++) {
        const network = networks[index]
        const feeRs = await pool.query(`SELECT sum(cast(value as decimal)) FROM messages WHERE src_network = $1`, [network])
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
    let sql = `SELECT count(*) as total FROM messages`
    if (conditions.length == 0) {
        const totalRs = await pool.query(sql, values)
        const total = Number(totalRs.rows[0].total)
        data.total = total
    } else {
        if (!src_networks && !dest_networks) {
            sql = `SELECT count(*) as total
                    FROM messages
                    WHERE ${conditions.join(' AND ')}`
            const totalRs = await pool.query(sql, values)
            const total = Number(totalRs.rows[0].total)
            data.total = total
        } else {
            if (src_networks) {
                let { conditions, values } = buildWhereSql(status, src_networks, undefined, src_address, dest_address, from_timestamp, to_timestamp)
                sql = `SELECT src_network, count(*) as total
                    FROM messages
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
                    FROM messages
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

module.exports = {
    getMessages,
    getMessageById,
    searchMessages,
    getStatistic,
    getTotalMessages,
}
