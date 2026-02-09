import express from 'express';
import axios from 'axios';

const router = express.Router();

// Nominatim requires a valid User-Agent
const HEADERS = {
    'User-Agent': 'CentralniMozekCehupo/1.0 (internal tool)'
};

/**
 * GET /api/geo/suggest
 * Autocomplete for addresses using Nominatim (OSM)
 * Supports: type=city for city-only results, or general address search
 */
router.get('/suggest', async (req, res) => {
    try {
        const { query, city, type, limit = 10 } = req.query;

        if (!query || query.length < 2) {
            return res.json({ items: [] });
        }

        // Construct search query
        let q = query;
        if (city) q += `, ${city}`;
        q += ', Česká republika'; // Bias towards Czech Republic

        // Nominatim Search API
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: q,
                format: 'json',
                addressdetails: 1,
                countrycodes: 'cz',
                limit: parseInt(limit)
            },
            headers: HEADERS
        });

        // Transform to clean, user-friendly format
        const suggestions = response.data.map(item => {
            const addr = item.address || {};

            // Extract city name (try multiple fields)
            const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';

            // Extract street with house number
            let streetName = '';
            if (addr.road) {
                streetName = addr.road;
                if (addr.house_number) {
                    streetName += ' ' + addr.house_number;
                }
            }

            // Extract region (just the region name, not full hierarchy)
            const region = addr.state || addr.county || '';

            // Create clean label based on what we have
            let label;
            if (streetName && cityName) {
                // Address: "Masarykova 123, Teplice"
                label = `${streetName}, ${cityName}`;
            } else if (cityName) {
                // City only: "Teplice, Ústecký kraj"
                label = region ? `${cityName}, ${region}` : cityName;
            } else {
                // Fallback: use first part of display_name
                label = item.display_name.split(',').slice(0, 2).join(',').trim();
            }

            return {
                label: label,
                name: label,
                city: cityName,
                street: streetName,
                zip: addr.postcode || '',
                lat: item.lat,
                lon: item.lon,
                region: region
            };
        });

        // For city-type searches, filter to only results with a city and no specific street
        let filtered = suggestions;
        if (type === 'city') {
            filtered = suggestions.filter(s => s.city && !s.street);
            // Deduplicate by city name
            const seen = new Set();
            filtered = filtered.filter(s => {
                if (seen.has(s.city)) return false;
                seen.add(s.city);
                return true;
            });
        }

        res.json({ items: filtered });

    } catch (error) {
        console.error('Geo Suggest Error:', error.message);
        res.status(500).json({ error: 'Geocoding service unavailable' });
    }
});

/**
 * GET /api/geo/geocode
 * Precise geocoding for saving coordinates
 */
router.get('/geocode', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ error: 'Missing query' });

        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: query,
                format: 'json',
                limit: 1,
                countrycodes: 'cz'
            },
            headers: HEADERS
        });

        if (response.data.length > 0) {
            const result = response.data[0];
            res.json([{
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                display_name: result.display_name
            }]);
        } else {
            res.json([]);
        }

    } catch (error) {
        console.error('Geocode Error:', error.message);
        res.status(500).json({ error: 'Geocoding failed' });
    }
});

/**
 * GET /api/geo/reverse
 * Reverse geocoding: coordinates -> address
 */
router.get('/reverse', async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing latitude or longitude' });
        }

        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
                lat: lat,
                lon: lon,
                format: 'json',
                addressdetails: 1
            },
            headers: HEADERS
        });

        const item = response.data;
        const addr = item.address || {};

        // Extract standardized fields
        const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        let streetName = '';
        if (addr.road) {
            streetName = addr.road;
            if (addr.house_number) {
                streetName += ' ' + addr.house_number;
            }
        }

        const region = addr.state || addr.county || '';

        res.json({
            city: cityName,
            street: streetName,
            zip: addr.postcode || '',
            region: region,
            fullAddress: streetName ? `${streetName}, ${cityName}` : cityName
        });

    } catch (error) {
        console.error('Reverse Geo Error:', error.message);
        res.status(500).json({ error: 'Reverse geocoding failed' });
    }
});

export default router;
