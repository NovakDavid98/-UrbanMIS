import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * CityAutocomplete Component
 * A reusable autocomplete input for Czech cities/municipalities using Mapy.cz API
 * 
 * @param {string} value - Current input value
 * @param {function} onChange - Called when input changes (for controlled input)
 * @param {function} onSelect - Called when user selects a city
 * @param {string} placeholder - Input placeholder
 * @param {string} label - Label text
 * @param {string} className - Additional CSS classes
 * @param {boolean} disabled - Disable input
 */
function CityAutocomplete({
    value = '',
    onChange,
    onSelect,
    placeholder = 'Začněte psát město...',
    label,
    className = '',
    disabled = false
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

    // Sync with external value
    useEffect(() => {
        if (!isFocused && value !== inputValue) {
            setInputValue(value);
        }
    }, [value, isFocused]);

    // Fetch suggestions from API
    const fetchSuggestions = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Use the OSM-based geo/suggest endpoint with type=city for city-only results
            const response = await fetch(
                `${API_URL}/geo/suggest?query=${encodeURIComponent(query)}&type=city&limit=7`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch city suggestions');
            }

            const data = await response.json();
            // Backend now returns clean format with city, region, zip
            const items = (data.items || []).map(item => ({
                city: item.city || '',
                region: item.region || '',
                zip: item.zip || ''
            })).filter(item => item.city);

            setSuggestions(items);
            setIsOpen(items.length > 0);
            setHighlightedIndex(-1);
        } catch (err) {
            console.error('City autocomplete error:', err);
            setError('Nepodařilo se načíst návrhy');
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Debounced search
    const handleInputChange = useCallback((e) => {
        const newValue = e.target.value;
        setInputValue(newValue);

        // Call external onChange
        if (onChange) {
            onChange(newValue);
        }

        // Clear previous timeout
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Debounce API call
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(newValue);
        }, 300);
    }, [onChange, fetchSuggestions]);

    // Handle suggestion selection
    const handleSelect = useCallback((suggestion) => {
        setInputValue(suggestion.city);
        setSuggestions([]);
        setIsOpen(false);

        // Call external onChange with city name
        if (onChange) {
            onChange(suggestion.city);
        }

        // Call onSelect with full data
        if (onSelect) {
            onSelect({
                city: suggestion.city,
                region: suggestion.region,
                zip: suggestion.zip
            });
        }
    }, [onChange, onSelect]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e) => {
        if (!isOpen || suggestions.length === 0) return;

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
                if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                    handleSelect(suggestions[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    }, [isOpen, suggestions, highlightedIndex, handleSelect]);

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

    // Clear input
    const handleClear = () => {
        setInputValue('');
        setSuggestions([]);
        setIsOpen(false);
        if (onChange) {
            onChange('');
        }
        inputRef.current?.focus();
    };

    return (
        <div className={`relative ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPinIcon className="h-5 w-5 text-gray-400" />
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={() => {
                        setIsFocused(false);
                        // Ensure parent state is updated on blur
                        if (onChange) onChange(inputValue);
                        setTimeout(() => setIsOpen(false), 200);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        setIsFocused(true);
                        if (suggestions.length > 0) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />

                {/* Loading indicator */}
                {isLoading && (
                    <div className="absolute inset-y-0 right-10 flex items-center">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                    </div>
                )}

                {/* Clear button */}
                {inputValue && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                        <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    </button>
                )}
            </div>

            {/* Error message */}
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}

            {/* Suggestions dropdown */}
            {isOpen && suggestions.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleSelect(suggestion)}
                            className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3 ${index === highlightedIndex ? 'bg-blue-50' : ''
                                } ${index !== suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <MapPinIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-gray-900">
                                    {suggestion.city}
                                </p>
                                {suggestion.region && (
                                    <p className="text-sm text-gray-500">
                                        {suggestion.region}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CityAutocomplete;
