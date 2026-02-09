
import { useEffect, useState, useRef, useMemo } from 'react';
import { clientsAPI } from '../services/api';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useNavigate } from 'react-router-dom';

function ClientMap() {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const navigate = useNavigate();

    // State
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [stats, setStats] = useState({ total: 0, mapped: 0 });

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Fetch a large batch. 
                // Add timestamp to prevent caching
                const response = await clientsAPI.getAll({ limit: 10000, _t: Date.now() });
                const data = response.data.data || response.data.clients || [];
                setClients(data);

                // Count valid coordinates (ensure strictly not null and not 0,0)
                const mappedCount = data.filter(c => c.latitude != null && c.longitude != null && c.latitude !== 0).length;
                setStats({ total: data.length, mapped: mappedCount });

            } catch (error) {
                console.error('Failed to load clients', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Initialize Map
    useEffect(() => {
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'osm': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap Contributors',
                        maxzoom: 19
                    }
                },
                layers: [
                    {
                        id: 'osm-tiles',
                        type: 'raster',
                        source: 'osm',
                    }
                ]
            },
            center: [15.3, 49.8], // Czech Republic center
            zoom: 7
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.current.addControl(new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true
        }), 'top-right');

        map.current.on('load', () => {
            setMapLoaded(true);
        });

    }, []);

    // Update Map Sources/Layers when data changes
    useEffect(() => {
        if (!mapLoaded || !map.current || clients.length === 0) return;

        // 1. Group clients by location (exact lat,lon match)
        const clientsByLocation = {};
        clients.forEach(c => {
            if (!c.latitude || !c.longitude || c.latitude === 0) return;
            const key = `${c.latitude},${c.longitude}`;
            if (!clientsByLocation[key]) clientsByLocation[key] = [];
            clientsByLocation[key].push(c);
        });

        // 2. Create Features from Groups
        const features = Object.values(clientsByLocation).map(group => {
            const c = group[0];
            return {
                type: 'Feature',
                properties: {
                    // Start with basic props of the first one
                    id: c.id,
                    count: group.length,
                    // Store strict minimal data for popup rendering
                    clientsJSON: JSON.stringify(group.map(g => ({
                        id: g.id,
                        name: `${g.first_name} ${g.last_name}`,
                        city: g.czech_city
                    })))
                },
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(c.longitude), parseFloat(c.latitude)]
                }
            };
        });

        const geojson = {
            type: 'FeatureCollection',
            features: features
        };

        const sourceId = 'clients-source';

        if (map.current.getSource(sourceId)) {
            map.current.getSource(sourceId).setData(geojson);
        } else {
            // Add Source with Clustering
            map.current.addSource(sourceId, {
                type: 'geojson',
                data: geojson,
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            });

            // Layer: Clusters (Circles)
            map.current.addLayer({
                id: 'clusters',
                type: 'circle',
                source: sourceId,
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step',
                        ['get', 'point_count'],
                        '#51bbd6', // Blue for low count
                        100,
                        '#f1f075', // Yellow for medium
                        750,
                        '#f28cb1'  // Pink for high
                    ],
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        20,
                        100,
                        30,
                        750,
                        40
                    ]
                }
            });

            // Layer: Cluster Text (Count)
            map.current.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: sourceId,
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 12
                }
            });

            // Layer: Unclustered Points (Individual Markers OR Exact Overlaps)
            map.current.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: sourceId,
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': '#11b4da', // Unified blue color
                    'circle-radius': [
                        'case',
                        ['>', ['get', 'count'], 1], // Bigger if multiple
                        10,
                        8
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            });

            // Add "count" text for unclustered points if > 1 (mini cluster)
            map.current.addLayer({
                id: 'unclustered-point-count',
                type: 'symbol',
                source: sourceId,
                filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'count'], 1]],
                layout: {
                    'text-field': '{count}',
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 10
                },
                paint: {
                    'text-color': '#ffffff'
                }
            });

            // Interactions
            map.current.on('click', 'clusters', (e) => {
                const features = map.current.queryRenderedFeatures(e.point, { layers: ['clusters'] });
                const clusterId = features[0].properties.cluster_id;
                map.current.getSource(sourceId).getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    map.current.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: zoom
                    });
                });
            });

            // Popup on click individual point (or grouped address)
            map.current.on('click', 'unclustered-point', (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const props = e.features[0].properties;
                const clientsList = JSON.parse(props.clientsJSON);

                // Ensure we handle wrapped worlds
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }

                // Build HTML
                let contentHTML = `<div class="p-2 min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">`;

                if (clientsList.length > 1) {
                    contentHTML += `
                        <div class="mb-2 pb-2 border-b border-gray-100 flex justify-between items-center">
                            <span class="font-bold text-gray-800 text-sm">Na této adrese</span>
                            <span class="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">${clientsList.length} klientů</span>
                        </div>
                        <ul class="space-y-3">
                    `;

                    clientsList.forEach(c => {
                        contentHTML += `
                            <li class="flex flex-col gap-1 items-start">
                                <div class="font-medium text-sm text-gray-800">${c.name}</div>
                                <button id="btn-detail-${c.id}" class="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                                    Detail <span class="text-[10px]">&rarr;</span>
                                </button>
                            </li>
                        `;
                    });
                    contentHTML += `</ul>`;
                } else {
                    // Single client
                    const c = clientsList[0];
                    contentHTML += `
                        <div class="min-w-[150px]">
                            <h3 class="font-bold text-sm text-gray-900">${c.name}</h3>
                            <p class="text-xs text-gray-500 mb-2">${c.city || ''}</p>
                            <button id="btn-detail-${c.id}" class="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wide">
                                Detail klienta &rarr;
                            </button>
                        </div>
                    `;
                }
                contentHTML += `</div>`;

                const popup = new maplibregl.Popup({ maxWidth: '300px' })
                    .setLngLat(coordinates)
                    .setHTML(contentHTML)
                    .addTo(map.current);

                // Add event listeners
                setTimeout(() => {
                    clientsList.forEach(c => {
                        const btn = document.getElementById(`btn-detail-${c.id}`);
                        if (btn) btn.onclick = () => {
                            // Close popup to be clean?
                            // popup.remove(); 
                            navigate(`/clients/${c.id}`);
                        };
                    });
                }, 100);
            });

            // Cursor style
            map.current.on('mouseenter', 'clusters', () => map.current.getCanvas().style.cursor = 'pointer');
            map.current.on('mouseleave', 'clusters', () => map.current.getCanvas().style.cursor = '');
            map.current.on('mouseenter', 'unclustered-point', () => map.current.getCanvas().style.cursor = 'pointer');
            map.current.on('mouseleave', 'unclustered-point', () => map.current.getCanvas().style.cursor = '');
        }

    }, [mapLoaded, clients, navigate]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Mapa Klientů</h1>
                    <p className="text-sm text-gray-500">Vizualizace rozložení klientů v ČR</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{stats.mapped} <span className="text-sm font-normal text-gray-400">/ {stats.total}</span></div>
                    <div className="text-xs text-gray-500">Zobrazeno na mapě</div>
                </div>
            </div>

            <div className="h-[calc(100vh-220px)] rounded-xl overflow-hidden shadow-lg border border-gray-200 relative bg-gray-50">
                <div ref={mapContainer} className="w-full h-full" />

                {isLoading && (
                    <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mb-2"></div>
                            <p className="text-blue-800 font-medium">Načítám mapová data...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend / Info */}
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-4 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#11b4da]"></span> Klient
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#51bbd6]"></span> Skupina
                </div>
            </div>
        </div>
    );
}

export default ClientMap;
