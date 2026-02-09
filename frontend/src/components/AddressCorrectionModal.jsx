import { useState, useEffect } from 'react';
import { XMarkIcon, MapPinIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { clientsAPI } from '../services/api';
import CityAutocomplete from './CityAutocomplete';
import AddressAutocomplete from './AddressAutocomplete';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * AddressCorrectionModal Component
 * Modal for correcting address typos using Mapy.cz suggestions
 * 
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Called when modal is closed
 * @param {object} client - Client data with current address
 * @param {function} onAddressUpdated - Called after address is updated
 */
function AddressCorrectionModal({ isOpen, onClose, client, onAddressUpdated }) {
    const [suggestion, setSuggestion] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCity, setEditedCity] = useState('');
    const [editedAddress, setEditedAddress] = useState('');
    const [error, setError] = useState(null);

    const currentCity = client?.czech_city || '';
    const currentAddress = client?.czech_address || '';
    const fullCurrentAddress = [currentAddress, currentCity].filter(Boolean).join(', ');

    // Fetch suggestion when modal opens
    useEffect(() => {
        if (isOpen && client) {
            fetchSuggestion();
            setEditedCity(currentCity);
            setEditedAddress(currentAddress);
            setIsEditing(false);
        }
    }, [isOpen, client]);

    const fetchSuggestion = async () => {
        if (!fullCurrentAddress) {
            setSuggestion(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {

            // Use our new Geo API
            const response = await fetch(
                `${API_URL}/geo/suggest?query=${encodeURIComponent(fullCurrentAddress)}&limit=1`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch suggestion');
            }

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                // Geo API returns normalized items
                setSuggestion({
                    city: data.items[0].city,
                    street: data.items[0].street,
                    zip: data.items[0].zip,
                    fullAddress: data.items[0].label
                });
            } else {
                setSuggestion(null);
            }

        } catch (err) {
            console.error('Address suggestion error:', err);
            setError('Nepodařilo se načíst návrh adresy');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplySuggestion = async () => {
        if (!suggestion || !client) return;

        setIsUpdating(true);
        try {
            await clientsAPI.update(client.id, {
                czechCity: suggestion.city,
                czechAddress: suggestion.street
            });

            toast.success('Adresa byla úspěšně aktualizována');
            onAddressUpdated?.({
                ...client,
                czech_city: suggestion.city,
                czech_address: suggestion.street
            });
            onClose();
        } catch (err) {
            console.error('Error updating address:', err);
            toast.error('Nepodařilo se aktualizovat adresu');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSaveManual = async () => {
        if (!client) return;

        setIsUpdating(true);
        try {
            await clientsAPI.update(client.id, {
                czechCity: editedCity,
                czechAddress: editedAddress
            });

            toast.success('Adresa byla úspěšně aktualizována');
            onAddressUpdated?.({
                ...client,
                czech_city: editedCity,
                czech_address: editedAddress
            });
            onClose();
        } catch (err) {
            console.error('Error updating address:', err);
            toast.error('Nepodařilo se aktualizovat adresu');
        } finally {
            setIsUpdating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all">
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <MapPinIcon className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Opravit adresu</h2>
                                    <p className="text-sm text-gray-500">
                                        {client?.first_name} {client?.last_name}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-5 space-y-4">
                        {/* Current Address */}
                        <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                                Aktuální adresa
                            </label>
                            <div className="p-3 bg-gray-100 rounded-lg text-gray-700">
                                {currentAddress && <div className="font-medium">{currentAddress}</div>}
                                {currentCity && <div className="text-sm text-gray-500">{currentCity}</div>}
                                {!currentAddress && !currentCity && (
                                    <span className="text-gray-400 italic">Adresa není vyplněna</span>
                                )}
                            </div>
                        </div>

                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <span className="ml-3 text-gray-500">Hledám správnou adresu...</span>
                            </div>
                        )}

                        {/* Error State */}
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                                {error}
                            </div>
                        )}

                        {/* Suggestion */}
                        {!isLoading && suggestion && !isEditing && (
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-1">
                                    Navrhovaná oprava
                                </label>
                                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-medium text-green-800">
                                                {suggestion.street}
                                            </div>
                                            <div className="text-sm text-green-600">
                                                {suggestion.zip && `${suggestion.zip} `}{suggestion.city}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* No Suggestion Found */}
                        {!isLoading && !suggestion && !error && fullCurrentAddress && !isEditing && (
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="text-yellow-800">
                                    Pro tuto adresu nebyl nalezen žádný návrh.
                                    Můžete ji upravit ručně.
                                </div>
                            </div>
                        )}

                        {/* Manual Edit Mode */}
                        {isEditing && (
                            <div className="space-y-4">
                                <CityAutocomplete
                                    value={editedCity}
                                    onChange={(value) => setEditedCity(value)}
                                    onSelect={(data) => {
                                        setEditedCity(data.city);
                                    }}
                                    label="Město"
                                    placeholder="Začněte psát město..."
                                />
                                <AddressAutocomplete
                                    value={editedAddress}
                                    onChange={(value) => setEditedAddress(value)}
                                    onSelect={(data) => {
                                        setEditedAddress(data.street);
                                        if (data.city) setEditedCity(data.city);
                                    }}
                                    cityValue={editedCity}
                                    onCityChange={(city) => setEditedCity(city)}
                                    label="Ulice a číslo"
                                    placeholder="Začněte psát adresu..."
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-between">
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            <PencilIcon className="w-4 h-4" />
                            {isEditing ? 'Zrušit úpravy' : 'Upravit ručně'}
                        </button>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="btn btn-secondary"
                                disabled={isUpdating}
                            >
                                Zavřít
                            </button>

                            {isEditing ? (
                                <button
                                    onClick={handleSaveManual}
                                    disabled={isUpdating}
                                    className="btn btn-primary"
                                >
                                    {isUpdating ? 'Ukládám...' : 'Uložit změny'}
                                </button>
                            ) : suggestion ? (
                                <button
                                    onClick={handleApplySuggestion}
                                    disabled={isUpdating}
                                    className="btn btn-primary"
                                >
                                    {isUpdating ? 'Ukládám...' : 'Použít návrh'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AddressCorrectionModal;
