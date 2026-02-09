import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import MapRepairTab from './MapRepairTab';

const DataRepair = () => {
    const [activeTab, setActiveTab] = useState('visas');

    // Visa repair state
    const [visaData, setVisaData] = useState({ outliers: [], summary: [], standardTypes: [] });
    const [visaLoading, setVisaLoading] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [selectedTarget, setSelectedTarget] = useState('');
    const [selectedReplacement, setSelectedReplacement] = useState('Dočasná ochrana');

    // Address repair state
    const [addressData, setAddressData] = useState({
        addresses: [],
        stats: { total_scraped: 0, total_matched: 0, total_different: 0, total_unmatched: 0, scraped_at: null },
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
    });
    const [addressLoading, setAddressLoading] = useState(false);
    const [addressSearch, setAddressSearch] = useState('');
    const [addressFilter, setAddressFilter] = useState('different');
    const [addressPage, setAddressPage] = useState(1);
    const [selectedAddresses, setSelectedAddresses] = useState({});
    const [applyingAddresses, setApplyingAddresses] = useState(false);

    const token = localStorage.getItem('token');
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // Fetch visa data
    const fetchVisaData = async () => {
        setVisaLoading(true);
        try {
            const response = await axios.get('/api/data-repair/visas', authHeaders);
            setVisaData(response.data);
        } catch (error) {
            console.error('Error fetching visa data:', error);
            toast.error('Nepodařilo se načíst data víz.');
        } finally {
            setVisaLoading(false);
        }
    };

    // Fetch address data
    const fetchAddressData = useCallback(async () => {
        setAddressLoading(true);
        try {
            const params = new URLSearchParams({
                page: addressPage,
                limit: 50,
                filter: addressFilter,
                ...(addressSearch && { search: addressSearch })
            });
            const response = await axios.get(`/api/data-repair/addresses?${params}`, authHeaders);
            // Ensure response has expected structure
            setAddressData({
                addresses: response.data?.addresses || [],
                stats: response.data?.stats || { total_scraped: 0, total_matched: 0, total_different: 0, total_unmatched: 0, scraped_at: null },
                pagination: response.data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }
            });
        } catch (error) {
            console.error('Error fetching address data:', error);
            toast.error('Nepodařilo se načíst adresy.');
            // Reset to safe defaults on error
            setAddressData({
                addresses: [],
                stats: { total_scraped: 0, total_matched: 0, total_different: 0, total_unmatched: 0, scraped_at: null },
                pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
            });
        } finally {
            setAddressLoading(false);
        }
    }, [addressPage, addressFilter, addressSearch]);

    useEffect(() => {
        if (activeTab === 'visas') {
            fetchVisaData();
        } else if (activeTab === 'addresses') {
            fetchAddressData();
        }
    }, [activeTab, fetchAddressData]);

    // Handle visa bulk replace
    const handleBulkReplace = async () => {
        if (!selectedTarget) {
            toast.error('Vyberte hodnotu, kterou chcete nahradit.');
            return;
        }

        if (!confirm(`Opravdu chcete nahradit všechny výskyty "${selectedTarget}" hodnotou "${selectedReplacement}"?`)) {
            return;
        }

        setReplacing(true);
        try {
            await axios.post('/api/data-repair/visas/replace', {
                targetType: selectedTarget,
                newType: selectedReplacement
            }, authHeaders);

            toast.success('Oprava úspěšně provedena');
            fetchVisaData();
            setSelectedTarget('');
        } catch (error) {
            console.error('Error replacing data:', error);
            toast.error('Chyba při opravě dat.');
        } finally {
            setReplacing(false);
        }
    };

    // Handle address selection
    const toggleAddressSelection = (item) => {
        if (!item.local_client_id) return;

        setSelectedAddresses(prev => {
            const key = item.local_client_id;
            if (prev[key]) {
                const { [key]: removed, ...rest } = prev;
                return rest;
            } else {
                return {
                    ...prev,
                    [key]: {
                        client_id: item.local_client_id,
                        street: item.scraped_street,
                        city: item.scraped_city
                    }
                };
            }
        });
    };

    // Select all visible addresses
    const selectAllVisible = () => {
        if (!addressData.addresses || addressData.addresses.length === 0) return;

        const newSelections = {};
        addressData.addresses.forEach(item => {
            if (item.local_client_id && item.address_differs) {
                newSelections[item.local_client_id] = {
                    client_id: item.local_client_id,
                    street: item.scraped_street,
                    city: item.scraped_city
                };
            }
        });
        setSelectedAddresses(prev => ({ ...prev, ...newSelections }));
    };

    // Clear all selections
    const clearSelections = () => {
        setSelectedAddresses({});
    };

    // Apply selected addresses
    const applySelectedAddresses = async () => {
        const updates = Object.values(selectedAddresses);
        if (updates.length === 0) {
            toast.error('Vyberte alespoň jednu adresu k opravě.');
            return;
        }

        if (!confirm(`Opravdu chcete aktualizovat ${updates.length} adres?`)) {
            return;
        }

        setApplyingAddresses(true);
        try {
            const response = await axios.post('/api/data-repair/addresses/apply', { updates }, authHeaders);
            toast.success(`Úspěšně aktualizováno ${response.data.successCount} adres`);
            setSelectedAddresses({});
            fetchAddressData();
        } catch (error) {
            console.error('Error applying addresses:', error);
            toast.error('Chyba při aktualizaci adres.');
        } finally {
            setApplyingAddresses(false);
        }
    };

    // Handle search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'addresses') {
                setAddressPage(1);
                fetchAddressData();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [addressSearch]);

    // Handle filter change
    useEffect(() => {
        if (activeTab === 'addresses') {
            setAddressPage(1);
            fetchAddressData();
        }
    }, [addressFilter]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Oprava dat</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Nástroje pro hromadnou opravu dat klientů.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('visas')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'visas'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Víza
                    </button>
                    <button
                        onClick={() => setActiveTab('addresses')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'addresses'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Adresy (customer)
                    </button>
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'map'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        Mapa (chyby)
                    </button>
                </nav>
            </div>

            {/* Visa Tab Content */}
            {activeTab === 'visas' && (
                <>
                    {visaLoading ? (
                        <div className="p-8 text-center text-gray-500">Načítání dat...</div>
                    ) : (
                        <>
                            {/* Visa Bulk Replace */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h2 className="text-lg font-medium text-gray-900 mb-4">Hromadná oprava víz</h2>
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nahradit tuto hodnotu (Outlier)
                                        </label>
                                        <select
                                            value={selectedTarget}
                                            onChange={(e) => setSelectedTarget(e.target.value)}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            <option value="">-- Vyberte hodnotu --</option>
                                            {visaData.summary.map(item => (
                                                <option key={item.type} value={item.type}>
                                                    {item.type} ({item.count} klientů)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Za tuto hodnotu (Standard)
                                        </label>
                                        <select
                                            value={selectedReplacement}
                                            onChange={(e) => setSelectedReplacement(e.target.value)}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            {visaData.standardTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleBulkReplace}
                                        disabled={replacing || !selectedTarget}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        {replacing ? 'Opravuji...' : 'Opravit Vše'}
                                    </button>
                                </div>
                            </div>

                            {/* Visa List */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-lg font-medium text-gray-900">
                                        Seznam klientů s nestandardními vízy ({visaData.outliers.length})
                                    </h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jméno</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Příjmení</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Současný stav</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akce</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {visaData.outliers.map((client) => (
                                                <tr key={client.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{client.first_name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{client.last_name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{client.visa_type}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <a href={`/clients/${client.id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-900">
                                                            Detail klienta
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))}
                                            {visaData.outliers.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-8 text-center text-green-600 font-medium">
                                                        Skvělá práce! Žádné nestandardní záznamy nenalezeny.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Address Tab Content */}
            {activeTab === 'addresses' && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="text-2xl font-bold text-blue-600">{addressData.stats.total_scraped || 0}</div>
                            <div className="text-sm text-gray-500">Celkem v Cehupo</div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="text-2xl font-bold text-green-600">{addressData.stats.total_matched || 0}</div>
                            <div className="text-sm text-gray-500">Propojeno s DB</div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="text-2xl font-bold text-orange-600">{addressData.stats.total_different || 0}</div>
                            <div className="text-sm text-gray-500">Rozdílné adresy</div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="text-2xl font-bold text-gray-600">{addressData.stats.total_unmatched || 0}</div>
                            <div className="text-sm text-gray-500">Nepropojeno</div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            {/* Search */}
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Hledat</label>
                                <input
                                    type="text"
                                    value={addressSearch}
                                    onChange={(e) => setAddressSearch(e.target.value)}
                                    placeholder="Jméno nebo adresa..."
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            {/* Filter */}
                            <div className="w-48">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Filtr</label>
                                <select
                                    value={addressFilter}
                                    onChange={(e) => setAddressFilter(e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="all">Všechny</option>
                                    <option value="different">Rozdílné adresy</option>
                                    <option value="matched">Propojené</option>
                                    <option value="unmatched">Nepropojené</option>
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={selectAllVisible}
                                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                >
                                    Vybrat vše
                                </button>
                                <button
                                    onClick={clearSelections}
                                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                >
                                    Zrušit výběr
                                </button>
                                <button
                                    onClick={applySelectedAddresses}
                                    disabled={applyingAddresses || Object.keys(selectedAddresses).length === 0}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {applyingAddresses ? 'Aplikuji...' : `Aplikovat (${Object.keys(selectedAddresses).length})`}
                                </button>
                            </div>
                        </div>

                        {addressData.stats.scraped_at && (
                            <div className="mt-3 text-xs text-gray-400">
                                Data z Cehupo stažena: {new Date(addressData.stats.scraped_at).toLocaleString('cs-CZ')}
                            </div>
                        )}
                    </div>

                    {/* Address List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="text-lg font-medium text-gray-900">
                                Adresy ({addressData.pagination.total || 0})
                            </h2>
                            {addressData.pagination.totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setAddressPage(p => Math.max(1, p - 1))}
                                        disabled={addressPage <= 1}
                                        className="px-3 py-1 rounded border disabled:opacity-50"
                                    >
                                        ←
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Strana {addressPage} z {addressData.pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setAddressPage(p => Math.min(addressData.pagination.totalPages, p + 1))}
                                        disabled={addressPage >= addressData.pagination.totalPages}
                                        className="px-3 py-1 rounded border disabled:opacity-50"
                                    >
                                        →
                                    </button>
                                </div>
                            )}
                        </div>

                        {addressLoading ? (
                            <div className="p-8 text-center text-gray-500">Načítání adres...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => e.target.checked ? selectAllVisible() : clearSelections()}
                                                    checked={
                                                        addressData.addresses &&
                                                        addressData.addresses.length > 0 &&
                                                        addressData.addresses.filter(i => i.local_client_id && i.address_differs).length > 0 &&
                                                        addressData.addresses.filter(i => i.local_client_id && i.address_differs).every(i => selectedAddresses[i.local_client_id])
                                                    }
                                                    className="rounded border-gray-300"
                                                />
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Klient</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktuální adresa (DB)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresa z Cehupo</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stav</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {addressData.addresses?.map((item) => (
                                            <tr
                                                key={item.cehupo_id}
                                                className={`hover:bg-gray-50 ${selectedAddresses[item.local_client_id] ? 'bg-blue-50' : ''}`}
                                            >
                                                <td className="px-4 py-3">
                                                    {item.local_client_id && item.address_differs && (
                                                        <input
                                                            type="checkbox"
                                                            checked={!!selectedAddresses[item.local_client_id]}
                                                            onChange={() => toggleAddressSelection(item)}
                                                            className="rounded border-gray-300"
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {item.local_first_name || item.scraped_first_name} {item.local_last_name || item.scraped_last_name}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        Cehupo ID: {item.cehupo_id}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.has_match ? (
                                                        <div className="text-sm text-gray-600">
                                                            {item.local_address || <span className="text-gray-400 italic">Bez adresy</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-sm">Nepropojeno</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className={`text-sm ${item.address_differs ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                                                        {item.scraped_address || <span className="text-gray-400 italic">Bez adresy</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {!item.has_match ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                            Nepropojeno
                                                        </span>
                                                    ) : item.address_differs ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                                            Rozdílná
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                            Shodná
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!addressData.addresses || addressData.addresses.length === 0) && (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                    Žádné záznamy k zobrazení.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {addressData.pagination.totalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button
                                onClick={() => setAddressPage(1)}
                                disabled={addressPage <= 1}
                                className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
                            >
                                První
                            </button>
                            <button
                                onClick={() => setAddressPage(p => Math.max(1, p - 1))}
                                disabled={addressPage <= 1}
                                className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
                            >
                                ← Předchozí
                            </button>
                            <span className="px-4 py-2 text-gray-600">
                                Strana {addressPage} z {addressData.pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setAddressPage(p => Math.min(addressData.pagination.totalPages, p + 1))}
                                disabled={addressPage >= addressData.pagination.totalPages}
                                className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
                            >
                                Další →
                            </button>
                            <button
                                onClick={() => setAddressPage(addressData.pagination.totalPages)}
                                disabled={addressPage >= addressData.pagination.totalPages}
                                className="px-3 py-2 rounded-lg border disabled:opacity-50 hover:bg-gray-50"
                            >
                                Poslední
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Map Repair Tab */}
            {activeTab === 'map' && <MapRepairTab />}
        </div>
    );
};

export default DataRepair;
