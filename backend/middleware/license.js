import crypto from 'crypto';
import axios from 'axios';

import fs from 'fs';
import path from 'path';

// License configuration
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://license.urbanmis.org';
const LICENSE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const INSTANCE_ID_FILE = './config/instance_id.txt';

let licenseState = {
    status: 'unchecked', // 'active', 'expired', 'invalid', 'unchecked', 'offline'
    lastCheck: null,
    features: {
        aiSearch: false,
        dataSync: false,
        multiTenant: false,
        advancedReports: false
    },
    expiresAt: null,
    organization: null
};

// Generate or retrieve instance ID
function getInstanceId() {
    const idPath = path.resolve(INSTANCE_ID_FILE);

    try {
        if (fs.existsSync(idPath)) {
            return fs.readFileSync(idPath, 'utf8').trim();
        }
    } catch (e) {
        // File doesn't exist, create new ID
    }

    const newId = crypto.randomUUID();
    try {
        fs.mkdirSync(path.dirname(idPath), { recursive: true });
        fs.writeFileSync(idPath, newId);
    } catch (e) {
        console.error('Could not persist instance ID:', e.message);
    }

    return newId;
}

// Check license with remote server
async function checkLicenseRemote() {
    try {
        const instanceId = await getInstanceId();
        const domain = process.env.DOMAIN || 'localhost';
        const version = process.env.npm_package_version || '1.0.0';

        const response = await axios.post(`${LICENSE_SERVER_URL}/api/verify`, {
            instanceId,
            domain,
            version
        }, {
            timeout: 10000
        });

        if (response.data.status === 'active') {
            licenseState = {
                status: 'active',
                lastCheck: new Date(),
                features: response.data.features || licenseState.features,
                expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : null,
                organization: response.data.organization || null
            };
        } else {
            licenseState.status = response.data.status || 'invalid';
            licenseState.lastCheck = new Date();
        }

        return licenseState;
    } catch (error) {
        console.error('License check failed:', error.message);

        // If we had a previous valid license, allow grace period
        if (licenseState.status === 'active' && licenseState.lastCheck) {
            const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
            const timeSinceCheck = Date.now() - licenseState.lastCheck.getTime();

            if (timeSinceCheck < gracePeriod) {
                licenseState.status = 'offline';
                return licenseState;
            }
        }

        licenseState.status = 'invalid';
        return licenseState;
    }
}

// Initialize license check on startup
export async function initializeLicense() {
    console.log('Initializing license check...');
    await checkLicenseRemote();

    // Schedule periodic checks
    setInterval(checkLicenseRemote, LICENSE_CHECK_INTERVAL);

    console.log(`License status: ${licenseState.status}`);
    return licenseState;
}

// Get current license state
export function getLicenseState() {
    return { ...licenseState };
}

// Check if a specific feature is enabled
export function isFeatureEnabled(feature) {
    if (licenseState.status !== 'active' && licenseState.status !== 'offline') {
        return false;
    }
    return licenseState.features[feature] === true;
}

// Middleware to check license for protected routes
export function requireLicense(requiredFeature = null) {
    return (req, res, next) => {
        if (licenseState.status !== 'active' && licenseState.status !== 'offline') {
            return res.status(403).json({
                error: 'License required',
                message: 'This feature requires a valid license. Please contact your administrator.',
                licenseStatus: licenseState.status
            });
        }

        if (requiredFeature && !isFeatureEnabled(requiredFeature)) {
            return res.status(403).json({
                error: 'Feature not licensed',
                message: `The ${requiredFeature} feature requires an upgraded license.`,
                feature: requiredFeature
            });
        }

        next();
    };
}

// Middleware to add license info to response headers
export function addLicenseHeaders(req, res, next) {
    res.set('X-License-Status', licenseState.status);
    if (licenseState.organization) {
        res.set('X-Licensed-To', licenseState.organization);
    }
    next();
}

export default {
    initializeLicense,
    getLicenseState,
    isFeatureEnabled,
    requireLicense,
    addLicenseHeaders
};
