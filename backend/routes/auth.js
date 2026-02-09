import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// =================================================================================
// LOGIN
// =================================================================================

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        // Get user from database
        const result = await query(
            'SELECT * FROM users WHERE username = $1 AND is_active = true',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
        );

        // Return user data (without password) and token
        const { password_hash, ...userWithoutPassword } = user;

        res.json({
            token,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// =================================================================================
// GET CURRENT USER
// =================================================================================

router.get('/me', authenticateToken, async (req, res) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// =================================================================================
// CHANGE PASSWORD
// =================================================================================

router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        // Strong password policy: 12+ characters with complexity
        if (newPassword.length < 12) {
            return res.status(400).json({ error: 'Password must be at least 12 characters' });
        }

        // Check complexity requirements
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
            return res.status(400).json({ 
                error: 'Password must contain uppercase, lowercase, number, and special character' 
            });
        }

        // Check for common weak passwords
        const commonPasswords = [
            'password', 'password123', 'admin123', '123456', '123456789',
            'qwerty', 'abc123', 'password1', 'admin', 'letmein'
        ];
        if (commonPasswords.includes(newPassword.toLowerCase())) {
            return res.status(400).json({ error: 'This password is too common and not allowed' });
        }

        // Get user with password
        const result = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newPasswordHash, req.user.id]
        );

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// =================================================================================
// REGISTER NEW USER (Admin only)
// =================================================================================

router.post('/register', authenticateToken, async (req, res) => {
    try {
        // Only admins can create new users
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { username, email, password, firstName, lastName, role, phone } = req.body;

        if (!username || !email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        // Check if username or email already exists
        const existing = await query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, role, phone)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, username, email, first_name, last_name, role, phone, is_active, created_at`,
            [username, email, passwordHash, firstName, lastName, role || 'worker', phone]
        );

        res.status(201).json({
            message: 'User created successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// =================================================================================
// UPDATE USER PROFILE
// =================================================================================

router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName, email, phone } = req.body;

        if (!firstName || !lastName || !email) {
            return res.status(400).json({ error: 'First name, last name, and email are required' });
        }

        // Check if email is already taken by another user
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, req.user.id]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email address is already in use' });
        }

        // Update user profile
        const result = await query(
            `UPDATE users SET 
                first_name = $1, 
                last_name = $2, 
                email = $3, 
                phone = $4, 
                updated_at = NOW()
             WHERE id = $5
             RETURNING id, username, email, first_name, last_name, role, phone, is_active, last_login, created_at, updated_at`,
            [firstName, lastName, email, phone, req.user.id]
        );

        res.json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// =================================================================================
// GET USER PREFERENCES
// =================================================================================

router.get('/preferences', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT category, key, value FROM user_preferences WHERE user_id = $1',
            [req.user.id]
        );

        // Group preferences by category
        const preferences = {};
        result.rows.forEach(row => {
            if (!preferences[row.category]) {
                preferences[row.category] = {};
            }
            preferences[row.category][row.key] = row.value;
        });

        res.json({ preferences });

    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

// =================================================================================
// UPDATE USER PREFERENCES
// =================================================================================

router.put('/preferences', authenticateToken, async (req, res) => {
    try {
        const { preferences } = req.body;

        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({ error: 'Preferences object is required' });
        }

        // Start transaction
        await query('BEGIN');

        try {
            // Update each preference
            for (const [category, categoryPrefs] of Object.entries(preferences)) {
                for (const [key, value] of Object.entries(categoryPrefs)) {
                    await query(
                        `INSERT INTO user_preferences (user_id, category, key, value, updated_at)
                         VALUES ($1, $2, $3, $4, NOW())
                         ON CONFLICT (user_id, category, key)
                         DO UPDATE SET value = $4, updated_at = NOW()`,
                        [req.user.id, category, key, JSON.stringify(value)]
                    );
                }
            }

            await query('COMMIT');

            res.json({ message: 'Preferences updated successfully' });

        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }

    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

export default router;


























