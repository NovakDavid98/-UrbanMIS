import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import serviceRoutes from './routes/services.js';
import contractRoutes from './routes/contracts.js';
import planRoutes from './routes/plans.js';
import workerRoutes from './routes/workers.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import noteRoutes from './routes/notes.js';
import sanctionRoutes from './routes/sanctions.js';
import tagRoutes from './routes/tags.js';
import wallRoutes from './routes/wall.js';
import visitRoutes from './routes/visits.js';
import uploadRoutes from './routes/upload.js';
import chatRoutes from './routes/chat.js';
import votingRoutes from './routes/voting.js';
import plannerRoutes from './routes/planner.js';
import ragRoutes from './routes/rag.js';
import geoRoutes from './routes/geo.js';
import dataRepairRoutes from './routes/dataRepair.js';
import licenseRoutes from './routes/license.js';
import setupRoutes from './routes/setup.js';
import brandingRoutes from './routes/branding.js';
import { authLimiter, apiLimiter } from './middleware/rateLimiter.js';
import { geoblock } from './middleware/geoblock.js';
import { initializeLicense, addLicenseHeaders } from './middleware/license.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// =================================================================================
// MIDDLEWARE
// =================================================================================

// Trust proxy - CRITICAL for rate limiting behind Nginx
// This allows Express to see the real client IP from X-Forwarded-For header
app.set('trust proxy', 1);

// Security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
            workerSrc: ["'self'", "blob:"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https://*.openstreetmap.org", "https://*.mapy.com"],
            connectSrc: ["'self'", "https://*.openstreetmap.org", "https://nominatim.openstreetmap.org", "wss:"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// IP Geoblocking - Block traffic from specific countries
// Enabled in production, can be configured in .env
app.use(geoblock({
    enabled: process.env.GEOBLOCK_ENABLED !== 'false', // Enabled by default
    logBlocked: true,
    useWhitelist: false // Use blacklist mode (block specific countries)
}));

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Compression - exclude binary file exports to prevent corruption
app.use(compression({
    filter: (req, res) => {
        // Don't compress Excel exports or other binary downloads
        if (req.path.includes('/export')) {
            return false;
        }
        // Use default compression filter for everything else
        return compression.filter(req, res);
    }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Static files (for uploads if needed)
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// =================================================================================
// API ROUTES
// =================================================================================

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// IP Tracking Middleware
import { ipTracker } from './middleware/ipTracker.js';
app.use(ipTracker);

// Strict rate limiting for authentication
app.use('/api/auth/login', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/sanctions', sanctionRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/wall', wallRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/data-repair', dataRepairRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/branding', brandingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// =================================================================================
// ERROR HANDLING
// =================================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// =================================================================================
// SOCKET.IO SETUP
// =================================================================================

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

// Export io for use in routes
export { io };

// Socket.IO authentication middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const { query } = await import('./config/database.js');
        const result = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);

        if (result.rows.length === 0) {
            return next(new Error('User not found'));
        }

        socket.userId = decoded.userId;
        socket.user = result.rows[0];
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
    console.log(`User ${socket.user.username} connected`);

    // Update user presence (UPSERT)
    const { query } = await import('./config/database.js');
    const updateResult = await query(
        'UPDATE user_presence SET is_online = true, socket_id = $1, updated_at = NOW() WHERE user_id = $2',
        [socket.id, socket.userId]
    );

    if (updateResult.rowCount === 0) {
        await query(
            'INSERT INTO user_presence (user_id, is_online, socket_id, last_seen, updated_at) VALUES ($1, true, $2, NOW(), NOW())',
            [socket.userId, socket.id]
        );
    }

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Broadcast user online status
    socket.broadcast.emit('user_online', {
        userId: socket.userId,
        username: socket.user.username,
        firstName: socket.user.first_name,
        lastName: socket.user.last_name
    });

    // Handle joining conversation rooms
    socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
        try {
            const { conversationId, content, messageType = 'text' } = data;

            // Save message to database
            const messageResult = await query(
                `INSERT INTO messages (conversation_id, sender_id, content, message_type)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [conversationId, socket.userId, content, messageType]
            );

            const message = messageResult.rows[0];

            // Update conversation last message time
            await query(
                'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
                [conversationId]
            );

            // Get sender info and emit message to conversation room
            const senderResult = await query(
                'SELECT username, first_name, last_name FROM users WHERE id = $1',
                [socket.userId]
            );

            const sender = senderResult.rows[0];

            // Emit message to conversation room with complete sender info
            io.to(`conversation_${conversationId}`).emit('new_message', {
                ...message,
                first_name: sender.first_name,
                last_name: sender.last_name,
                username: sender.username
            });

        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('message_error', { error: 'Failed to send message' });
        }
    });

    // Handle typing indicators
    socket.on('typing_start', (conversationId) => {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
            userId: socket.userId,
            username: socket.user.username
        });
    });

    socket.on('typing_stop', (conversationId) => {
        socket.to(`conversation_${conversationId}`).emit('user_stop_typing', {
            userId: socket.userId
        });
    });

    // Handle marking messages as seen
    socket.on('mark_seen', async (conversationId) => {
        try {
            // Update read status in database for all messages in this conversation
            // that were sent by the OTHER participant and haven't been read by THIS user yet
            await query(`
                INSERT INTO message_read_status (message_id, user_id)
                SELECT m.id, $1
                FROM messages m
                WHERE m.conversation_id = $2 
                  AND m.sender_id != $1
                  AND NOT EXISTS (
                      SELECT 1 FROM message_read_status mrs 
                      WHERE mrs.message_id = m.id AND mrs.user_id = $1
                  )
            `, [socket.userId, conversationId]);

            // Notify the conversation room that messages have been seen
            // The sender will receive this and update their UI
            io.to(`conversation_${conversationId}`).emit('messages_seen', {
                conversationId,
                seenByUserId: socket.userId,
                seenAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error marking messages as seen:', error);
        }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        console.log(`User ${socket.user.username} disconnected`);

        // Update user presence
        await query(
            'UPDATE user_presence SET is_online = false, last_seen = NOW(), socket_id = NULL WHERE user_id = $1',
            [socket.userId]
        );

        // Broadcast user offline status
        socket.broadcast.emit('user_offline', {
            userId: socket.userId
        });
    });
});

// =================================================================================
// START SERVER
// =================================================================================

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error(' UNCAUGHT EXCEPTION! Shutting down...');
    console.error('Error:', err.name, err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (err, promise) => {
    console.error(' UNHANDLED REJECTION! Shutting down...');
    console.error('Error:', err);
    console.error('Promise:', promise);
    server.close(() => {
        process.exit(1);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(' SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log(' Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log(' SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log(' Process terminated');
        process.exit(0);
    });
});

// Start server
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API Base URL: http://localhost:${PORT}/api`);

    // Initialize license system
    try {
        await initializeLicense();
    } catch (e) {
        console.log('License check skipped (offline mode)');
    }
});

export default app;


























