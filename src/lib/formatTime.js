/**
 * Format a UTC timestamp to IST (Indian Standard Time)
 * @param {string|Date} timestamp
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) return '—'
    const d = new Date(timestamp)
    return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }) + ', ' + d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
        hour12: true,
    }) + ' IST'
}

/**
 * Get current IST date string (YYYY-MM-DD) for use in date inputs
 * @returns {string}
 */
export function todayIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}
