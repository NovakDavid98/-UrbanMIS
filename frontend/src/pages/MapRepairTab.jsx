
import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { clientsAPI } from '../services/api';

const MapRepairTab = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');

    // State for the row being edited
    // We store the "new address" state for each row independently or just render the autocomplete
    // But AddressAutocomplete is controlled. We can just use an internal state or controlled.
    // Let's use a local state map: { [clientId]: { city: '', address: '' } }
    const [edits, setEdits] = useState({});

    const token = localStorage.getItem('token');
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    const fetchClients = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page,
                limit: 50,
                geoStatus: 'failed', // Filter for failed/missing coords
                ...(search && { search })
            });
            const response = await axios.get(`/api/clients?${params}`, authHeaders);
            setClients(response.data.clients || []);
            setTotalPages(response.data.pagination?.totalPages || 1);
        } catch (error) {
            console.error('Error fetching failed geo clients:', error);
            toast.error('Nepodařilo se načíst klienty k opravě.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [page, search]);

    const handleAddressSelect = async (clientId, data) => {
        // Optimistic update or wait for API?
        // Let's call API immediately to save.

        try {
            // Update client properties
            // We update address AND lat/lon from the suggestion
            await clientsAPI.update(clientId, {
                czechCity: data.city,
                czechAddress: data.street,
                czechZip: data.zip || '',
                // If the update endpoint supports these (it should, or we patch it, 
                // but standard update might recalculate or we trust specific lat/lon)
                // Actually, the backend update usually triggers geocoding if address changes.
                // But providing lat/lon explicity is better if we have it.
                // For now, let's rely on the address update. 
                // Wait! The user wants to set it manually. 
                // If I send just address, the backend might re-geocode. 
                // Let's send lat/lon too if the backend accepts it.
                latitude: parseFloat(data.lat),
                longitude: parseFloat(data.lon)
            });

            toast.success('Adresa opravena a klient přesunut na mapu');

            // Remove from list
            setClients(prev => prev.filter(c => c.id !== clientId));

        } catch (error) {
            console.error('Error updating client address:', error);
            toast.error('Chyba při ukládání adresy');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-lg font-medium text-gray-900">
                            Klienti s chybějící adresou na mapě ({clients.length} na této stránce)
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Tito klienti mají neplatnou adresu (zaznamenáno 0,0).
                            Vyberte správnou adresu z našeptávače, abyste je opravili.
                        </p>
                    </div>
                    <div className="w-64">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hledat klienta</label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Jméno..."
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Načítám...</div>
                ) : (
                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Klient</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Současný záznam</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">
                                        Nová adresa (Vyhledat a vybrat)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {clients.map(client => (
                                    <tr key={client.id}>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">
                                                {client.first_name} {client.last_name}
                                            </div>
                                            <div className="text-xs text-gray-500">ID: {client.id}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            <div>{client.czech_address || <span className="text-red-300 italic">Bez ulice</span>}</div>
                                            <div>{client.czech_city || <span className="text-red-300 italic">Bez města</span>}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-full max-w-md">
                                                <AddressAutocomplete
                                                    // Start with current, but maybe it's bad, so let user type freely?
                                                    // Usually better to start empty if current is bad, or init with current and let user correct.
                                                    // Let's init with existing string to save typing if it's just a typo.
                                                    value={edits[client.id] !== undefined ? edits[client.id] : (client.czech_address || '')}
                                                    onChange={(val) => {
                                                        // Just local UI state update string
                                                        setEdits(prev => ({ ...prev, [client.id]: val }));
                                                    }}
                                                    onSelect={(data) => handleAddressSelect(client.id, data)}
                                                    cityValue={client.czech_city}
                                                    // onCityChange... we don't need to change separate city field here, just the composite select
                                                    placeholder="Začněte psát správnou adresu..."
                                                    className="w-full"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {clients.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-12 text-center text-green-600 font-medium">
                                            Žádní klienti s chybou v mapě! Všechno v pořádku.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
                        >
                            ← Předchozí
                        </button>
                        <span className="px-4 py-2 text-gray-600">
                            Strana {page} z {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
                        >
                            Další →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapRepairTab;
