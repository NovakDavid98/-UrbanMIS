import geoip from 'geoip-lite';

// =================================================================================
// IP GEOBLOCKING MIDDLEWARE
// =================================================================================
// Blocks traffic from specific countries to reduce attack surface
// and comply with data protection requirements

// List of blocked country codes (ISO 3166-1 alpha-2)
const BLOCKED_COUNTRIES = [
  'RU', // Russia
  'CN', // China
  'IN', // India
  'IR', // Iran
  'KP', // North Korea
];

// List of allowed countries (if you want to whitelist instead)
// Leave empty to only use blocklist
const ALLOWED_COUNTRIES = [
  // 'CZ', // Czech Republic
  // 'SK', // Slovakia
  // 'UA', // Ukraine
  // 'PL', // Poland
  // 'DE', // Germany
  // Add other EU countries as needed
];

/**
 * Geoblocking middleware
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Enable/disable geoblocking
 * @param {boolean} options.logBlocked - Log blocked requests
 * @param {boolean} options.useWhitelist - Use whitelist instead of blacklist
 */
export const geoblock = (options = {}) => {
  const {
    enabled = true,
    logBlocked = true,
    useWhitelist = false
  } = options;

  return (req, res, next) => {
    // Skip if disabled
    if (!enabled) {
      return next();
    }

    // Get client IP
    // Handle proxied requests (X-Forwarded-For, X-Real-IP)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                     req.headers['x-real-ip'] ||
                     req.socket.remoteAddress ||
                     req.connection.remoteAddress;

    // Skip localhost and private IPs (for development)
    if (isLocalhost(clientIp) || isPrivateIP(clientIp)) {
      return next();
    }

    // Lookup IP geolocation
    const geo = geoip.lookup(clientIp);

    if (!geo) {
      // IP not found in database, allow by default (or block if paranoid)
      if (logBlocked) {
        console.warn(`⚠️  Unknown IP location: ${clientIp} - Allowing`);
      }
      return next();
    }

    const countryCode = geo.country;

    // Whitelist mode: Only allow specific countries
    if (useWhitelist && ALLOWED_COUNTRIES.length > 0) {
      if (!ALLOWED_COUNTRIES.includes(countryCode)) {
        if (logBlocked) {
          console.warn(`🚫 BLOCKED: ${clientIp} from ${countryCode} (${geo.region}) - Not in whitelist`);
        }
        return res.status(403).json({
          error: 'Access denied',
          message: 'Access from your region is not permitted'
        });
      }
    } 
    // Blacklist mode: Block specific countries (default)
    else {
      if (BLOCKED_COUNTRIES.includes(countryCode)) {
        if (logBlocked) {
          console.warn(`🚫 BLOCKED: ${clientIp} from ${countryCode} (${geo.region})`);
        }
        return res.status(403).json({
          error: 'Access denied',
          message: 'Access from your region is not permitted'
        });
      }
    }

    // IP is allowed
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ALLOWED: ${clientIp} from ${countryCode} (${geo.region})`);
    }

    next();
  };
};

/**
 * Check if IP is localhost
 */
function isLocalhost(ip) {
  if (!ip) return false;
  
  // Remove IPv6 prefix if present
  const cleanIp = ip.replace(/^::ffff:/, '');
  
  return cleanIp === '127.0.0.1' ||
         cleanIp === 'localhost' ||
         cleanIp === '::1';
}

/**
 * Check if IP is in private range
 */
function isPrivateIP(ip) {
  if (!ip) return false;
  
  // Remove IPv6 prefix if present
  const cleanIp = ip.replace(/^::ffff:/, '');
  
  // Private IP ranges
  const parts = cleanIp.split('.');
  if (parts.length !== 4) return false;
  
  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);
  
  // 10.0.0.0 - 10.255.255.255
  if (first === 10) return true;
  
  // 172.16.0.0 - 172.31.255.255
  if (first === 172 && second >= 16 && second <= 31) return true;
  
  // 192.168.0.0 - 192.168.255.255
  if (first === 192 && second === 168) return true;
  
  return false;
}

/**
 * Get statistics about blocked requests
 * This can be called from an admin endpoint
 */
export const getGeoblockStats = () => {
  return {
    blockedCountries: BLOCKED_COUNTRIES,
    allowedCountries: ALLOWED_COUNTRIES,
    totalBlocked: BLOCKED_COUNTRIES.length,
    mode: ALLOWED_COUNTRIES.length > 0 ? 'whitelist' : 'blacklist'
  };
};

// Export country lists for configuration
export { BLOCKED_COUNTRIES, ALLOWED_COUNTRIES };
