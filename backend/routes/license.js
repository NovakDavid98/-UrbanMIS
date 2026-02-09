import express from 'express';
import { getLicenseState, isFeatureEnabled } from '../middleware/license.js';
import { authenticateToken as auth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();

// Get current license status (admin only)
router.get('/status', auth, adminOnly, (req, res) => {
    const licenseState = getLicenseState();

    res.json({
        status: licenseState.status,
        lastCheck: licenseState.lastCheck,
        expiresAt: licenseState.expiresAt,
        organization: licenseState.organization,
        features: licenseState.features
    });
});

// Get enabled features (any authenticated user)
router.get('/features', auth, (req, res) => {
    const licenseState = getLicenseState();

    res.json({
        status: licenseState.status,
        features: {
            aiSearch: isFeatureEnabled('aiSearch'),
            dataSync: isFeatureEnabled('dataSync'),
            multiTenant: isFeatureEnabled('multiTenant'),
            advancedReports: isFeatureEnabled('advancedReports')
        }
    });
});

export default router;
