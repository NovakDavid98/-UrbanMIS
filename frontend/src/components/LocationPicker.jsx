import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function LocationPicker({ latitude, longitude, onChange, className }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const marker = useRef(null);

    // Initialize Map
    useEffect(() => {
        if (map.current) return;

        // Default center (Teplice)
        const defaultCenter = [13.8245, 50.6404];
        const initialCenter = (longitude && latitude && longitude !== 0)
            ? [longitude, latitude]
            : defaultCenter;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'osm-tiles': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap Contributors',
                    },
                },
                layers: [
                    {
                        id: 'osm-tiles',
                        type: 'raster',
                        source: 'osm-tiles',
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            },
            center: initialCenter,
            zoom: 13
        });

        // Add navigation controls
        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Create draggable marker
        marker.current = new maplibregl.Marker({ draggable: true, color: '#e11d48' })
            .setLngLat(initialCenter)
            .addTo(map.current);

        // Handle marker drag
        marker.current.on('dragend', () => {
            const lngLat = marker.current.getLngLat();
            onChange(lngLat.lat, lngLat.lng);
        });

        // Handle map click
        map.current.on('click', (e) => {
            marker.current.setLngLat(e.lngLat);
            onChange(e.lngLat.lat, e.lngLat.lng);
        });

    }, []); // Run once on mount

    // Update marker when props change (e.g. from autocomplete)
    useEffect(() => {
        if (!map.current || !marker.current) return;

        if (longitude && latitude && longitude !== 0) {
            const currentPos = marker.current.getLngLat();
            // Only update if significantly different to avoid feedback loop
            if (Math.abs(currentPos.lng - longitude) > 0.00001 || Math.abs(currentPos.lat - latitude) > 0.00001) {
                marker.current.setLngLat([longitude, latitude]);
                map.current.flyTo({ center: [longitude, latitude], zoom: 16 });
            }
        }
    }, [latitude, longitude]);

    return <div ref={mapContainer} className={`rounded-lg overflow-hidden border border-gray-300 ${className}`} />;
}
