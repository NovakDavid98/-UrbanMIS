import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken as auth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'installation.json');
const UPLOADS_PATH = path.join(__dirname, '..', 'uploads', 'branding');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_PATH)) {
    fs.mkdirSync(UPLOADS_PATH, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_PATH),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `logo${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/svg+xml'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PNG, JPEG, and SVG allowed.'));
        }
    }
});

// Helper to read config
function getConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) { }
    return {
        organization: { name: 'UrbanMIS', primaryColor: '#4F46E5', logo: null },
        terminology: { client: 'Client', worker: 'Worker', visit: 'Visit' }
    };
}

// Helper to save config
function saveConfig(config) {
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Get branding configuration (public)
router.get('/', (req, res) => {
    const config = getConfig();
    res.json({
        organization: config.organization,
        terminology: config.terminology
    });
});

// Update organization details (admin only)
router.put('/organization', auth, adminOnly, (req, res) => {
    const { name, primaryColor } = req.body;
    const config = getConfig();

    if (name) config.organization.name = name;
    if (primaryColor) config.organization.primaryColor = primaryColor;

    saveConfig(config);
    res.json({ success: true, organization: config.organization });
});

// Upload logo (admin only)
router.post('/logo', auth, adminOnly, upload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const config = getConfig();
    config.organization.logo = `/uploads/branding/${req.file.filename}`;
    saveConfig(config);

    res.json({ success: true, logo: config.organization.logo });
});

// Delete logo (admin only)
router.delete('/logo', auth, adminOnly, (req, res) => {
    const config = getConfig();

    if (config.organization.logo) {
        const logoPath = path.join(__dirname, '..', config.organization.logo);
        if (fs.existsSync(logoPath)) {
            fs.unlinkSync(logoPath);
        }
        config.organization.logo = null;
        saveConfig(config);
    }

    res.json({ success: true });
});

// Update terminology (admin only)
router.put('/terminology', auth, adminOnly, (req, res) => {
    const { client, worker, visit } = req.body;
    const config = getConfig();

    if (client) config.terminology.client = client;
    if (worker) config.terminology.worker = worker;
    if (visit) config.terminology.visit = visit;

    saveConfig(config);
    res.json({ success: true, terminology: config.terminology });
});

// Get CSS variables for theming
router.get('/theme.css', (req, res) => {
    const config = getConfig();
    const primaryColor = config.organization?.primaryColor || '#4F46E5';

    // Generate lighter/darker variants
    const css = `:root {
    --color-primary: ${primaryColor};
    --color-primary-hover: ${adjustBrightness(primaryColor, -10)};
    --color-primary-light: ${adjustBrightness(primaryColor, 90)};
    --org-name: "${config.organization?.name || 'UrbanMIS'}";
}`;

    res.setHeader('Content-Type', 'text/css');
    res.send(css);
});

// Helper to adjust color brightness
function adjustBrightness(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

export default router;
