import ms from 'ms'

const map = {
    s: 'second',
    ms: 'millisecond',
    m: 'minute',
    h: 'hour',
    d: 'day'
}

// "5s" -> "5 seconds", "1m" -> "1 minute" (singular for exactly 1).
export default (date) =>
    date
        ? ms(new Date() - date).replace(/^(-?[\d.]+)([a-z]+)$/, (_, n, unit) => `${n} ${map[unit]}${Number(n) === 1 || Number(n) === -1 ? '' : 's'}`)
        : ''
