import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'ip_tracker.log');

// Track request counts per IP per minute
const requestCounts = new Map();
const ALERT_THRESHOLD = 100; // requests per minute
const CLEANUP_INTERVAL = 300000; // Clean old entries every 5 minutes

// Cleanup old request count entries
setInterval(() => {
    const currentMinute = Math.floor(Date.now() / 60000);
    for (const [key] of requestCounts) {
        const [, minute] = key.split('-');
        if (currentMinute - parseInt(minute) > 5) {
            requestCounts.delete(key);
        }
    }
}, CLEANUP_INTERVAL);

export const ipTracker = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const userAgent = req.get('User-Agent') || 'Unknown';

    // Track request count
    const minute = Math.floor(Date.now() / 60000);
    const key = `${ip}-${minute}`;
    const count = (requestCounts.get(key) || 0) + 1;
    requestCounts.set(key, count);

    // Log entry format
    const logEntry = `[${timestamp}] IP: ${ip} | Method: ${method} | URL: ${url} | UA: ${userAgent}\n`;

    // Append to log file
    fs.appendFile(logFile, logEntry, (err) => {
        if (err) {
            console.error('Error writing to IP tracker log:', err);
        }
    });

    // Alert on suspicious activity
    const suspiciousIPs = ['77.48.24.209'];
    if (suspiciousIPs.includes(ip)) {
        console.warn(`⚠️ SUSPICIOUS ACTIVITY: ${logEntry.trim()}`);
    }

    // Alert on high volume
    if (count > ALERT_THRESHOLD) {
        console.error(`🚨 ALERT: IP ${ip} exceeded ${ALERT_THRESHOLD} req/min (current: ${count})`);
        const alertEntry = `[${timestamp}] 🚨 HIGH VOLUME ALERT: IP ${ip} made ${count} requests in 1 minute\n`;
        fs.appendFile(logFile, alertEntry, () => { });
    }

    next();
};
