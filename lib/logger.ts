export async function remoteLog(message: string, data?: any, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    // Log to console on server
    if (typeof window === 'undefined') {
        const prefix = `[SERVER_LOG:${level}]`;
        if (data) {
            console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
        } else {
            console.log(`${prefix} ${message}`);
        }
        return;
    }

    try {
        await fetch('/api/debug/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, message, data }),
        });
    } catch {
        // Silently fail if log endpoint is down
    }
}
