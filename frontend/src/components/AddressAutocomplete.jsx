
import { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * AddressAutocomplete Component - OpenStreetMap Version
 * A reusable autocomplete input for addresses.
 */
function AddressAutocomplete({
    value = '',
    onChange,
    onSelect,
    placeholder = 'Začněte psát adresu...',
    label,
    className = '',
    disabled = false,
    cityValue = '',
    onCityChange
}) {
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [error, setError] = useState(null);
    const [isFocused, setIsFocused] = useState(false);

    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const debounceRef = useRef(null);
    const justSelectedRef = useRef(false); // Track if we just selected to prevent onBlur overwrite

    // Sync with external value
    useEffect(() => {
        if (!isFocused && value !== inputValue) {
            setInputValue(value);
        }
    }, [value, isFocused]);

    // Fetch suggestions from Backend Proxy
    const fetchSuggestions = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Call our own backend, which talks to Nominatim
            // This avoids CORS issues and hides tokens if we had them
            const response = await axios.get(`${API_URL}/geo/suggest`, {
                params: {
                    query: query,
                    city: cityValue,
                    limit: 5
                }
            });

            const items = response.data.items || [];
            setSuggestions(items);
            setIsOpen(items.length > 0);
            setHighlightedIndex(-1);
        } catch (err) {
            console.error('Address autocomplete error:', err);
            // Don't show error to user for every typo, just log it
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, [cityValue]);

    // Debounced input handler
    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange?.(newValue);

        // Debounce API calls (Nominatim requires 1s, our backend handles it but let's be nice)
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(newValue);
        }, 500);
    };

    // Handle suggestion selection
    const handleSelect = (suggestion) => {
        console.log('🏠 Address suggestion selected:', suggestion);

        // Use the street field which includes the house number (e.g., "K. J. Erbena 1097/8")
        // Fall back to label's first part if street is empty
        const streetWithNumber = suggestion.street || suggestion.label?.split(',')[0]?.trim() || suggestion.name || '';

        const selectedData = {
            city: suggestion.city,
            street: streetWithNumber,
            zip: suggestion.zip,
            fullAddress: suggestion.label,
            lat: suggestion.lat,
            lon: suggestion.lon
        };

        console.log('📍 Selected data to save:', selectedData);

        // Mark that we just selected - prevents onBlur from overwriting
        justSelectedRef.current = true;

        setInputValue(streetWithNumber);
        setSuggestions([]);
        setIsOpen(false);

        // Call onSelect with full data
        onSelect?.(selectedData);

        // Also call onChange with just the street value
        onChange?.(streetWithNumber);

        // Update city if callback provided
        if (onCityChange && selectedData.city) {
            onCityChange(selectedData.city);
        }
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                    handleSelect(suggestions[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target) &&
                inputRef.current &&
                !inputRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return (
        <div className={`relative ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {isLoading ? (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <MapPinIcon className="h-5 w-5 text-gray-400" />
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={() => {
                        setIsFocused(false);
                        // Only call onChange if we didn't just select from dropdown
                        if (!justSelectedRef.current) {
                            onChange?.(inputValue);
                        }
                        justSelectedRef.current = false;
                        setTimeout(() => setIsOpen(false), 200);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        setIsFocused(true);
                        if (suggestions.length > 0) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="input pl-10 pr-8 w-full"
                    autoComplete="off"
                />

                {inputValue && !disabled && (
                    <button
                        type="button"
                        onClick={() => {
                            setInputValue('');
                            onChange?.('');
                            setSuggestions([]);
                            setIsOpen(false);
                            inputRef.current?.focus();
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                        <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && suggestions.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto"
                >
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleSelect(suggestion)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`w-full px-4 py-3 text-left flex items-start gap-3 transition-colors ${index === highlightedIndex
                                ? 'bg-blue-50 text-blue-700'
                                : 'hover:bg-gray-50'
                                }`}
                        >
                            <MapPinIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-medium text-gray-900 line-clamp-1">
                                    {suggestion.label}
                                </div>
                                <div className="text-xs text-gray-500 flex gap-2">
                                    {suggestion.city && <span>{suggestion.city}</span>}
                                    {suggestion.zip && <span>{suggestion.zip}</span>}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AddressAutocomplete;
