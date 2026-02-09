import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import fetch from 'node-fetch';
import { io } from '../server.js';

const router = express.Router();

// RAG service URL
const RAG_SERVICE_URL = 'http://localhost:8001';

// All routes require authentication
router.use(authenticateToken);

// =================================================================================
// SEARCH CLIENTS WITH AI
// =================================================================================
router.post('/search/clients', async (req, res) => {
    try {
        const { query, limit = 50 } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Call RAG service
        const response = await fetch(`${RAG_SERVICE_URL}/search/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit })
        });

        if (!response.ok) {
            throw new Error(`RAG service error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('AI search clients error:', error);
        res.status(500).json({ error: 'Failed to search clients', details: error.message });
    }
});

// =================================================================================
// SEARCH VISITS WITH AI
// =================================================================================
router.post('/search/visits', async (req, res) => {
    try {
        const { query, limit = 50 } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // Call RAG service
        const response = await fetch(`${RAG_SERVICE_URL}/search/visits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit })
        });

        if (!response.ok) {
            throw new Error(`RAG service error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('AI search visits error:', error);
        res.status(500).json({ error: 'Failed to search visits', details: error.message });
    }
});

// =================================================================================
// MANUAL SYNC TRIGGER
// =================================================================================
router.post('/sync/manual', async (req, res) => {
    try {
        const response = await fetch(`${RAG_SERVICE_URL}/sync/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`RAG service error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Manual sync error:', error);
        res.status(500).json({ error: 'Failed to trigger sync', details: error.message });
    }
});

// =================================================================================
// SYNC NOTIFICATION ENDPOINT (Called by RAG service)
// =================================================================================
router.post('/sync-notification', async (req, res) => {
    try {
        const { status, message, stats, timestamp } = req.body;

        console.log(`📢 RAG Sync Notification: ${status} - ${message}`);

        // Broadcast to all connected users via Socket.IO
        io.emit('rag-sync-notification', {
            status,
            message,
            stats,
            timestamp
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Sync notification error:', error);
        res.status(500).json({ error: 'Failed to process notification' });
    }
});

// =================================================================================
// GET RAG STATS
// =================================================================================
router.get('/stats', async (req, res) => {
    try {
        const response = await fetch(`${RAG_SERVICE_URL}/stats`);

        if (!response.ok) {
            throw new Error(`RAG service error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats', details: error.message });
    }
});

// =================================================================================
// HEALTH CHECK
// =================================================================================
router.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${RAG_SERVICE_URL}/health`);

        if (!response.ok) {
            throw new Error(`RAG service error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ error: 'RAG service unavailable', details: error.message });
    }
});

export default router;


