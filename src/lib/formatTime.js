/**
 * Format a UTC timestamp to a human-readable string
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
        timeZone: 'UTC',
    }) + ', ' + d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
    }) + ' UTC'
}
