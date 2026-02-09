import rateLimit from 'express-rate-limit';

// =================================================================================
// RATE LIMITING - CRITICAL SECURITY MEASURE
// =================================================================================
// Protects against brute force attacks, credential stuffing, and DDoS

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 50, // 10 in production, 50 in development
  message: {
    error: 'Too many login attempts from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again after 15 minutes',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: process.env.NODE_ENV === 'production' ? 1000 : 2000, // 1000 in production, 2000 in development
  message: {
    error: 'Too many requests from this IP, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check only
    return req.path === '/api/health';
  }
});

// Stricter rate limiting for data-intensive endpoints
export const heavyApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 500, // 100 in production, 500 in development
  message: {
    error: 'Too many requests to this endpoint, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === 'development';
  }
});

// Password reset/change rate limiting
export const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 password changes per hour
  message: {
    error: 'Too many password change attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});
