import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing table column configuration
 * Saves to localStorage for persistence across sessions
 */
export function useTableConfig(pageKey, defaultColumns) {
    const storageKey = `tableConfig_${pageKey}`;

    // Initialize state from localStorage or defaults
    const [columnConfig, setColumnConfig] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate saved config has all required columns
                const hasAllRequired = defaultColumns
                    .filter(col => col.required)
                    .every(col => parsed.order.includes(col.key));

                if (hasAllRequired && parsed.version === 1) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to load table config:', e);
        }

        // Return default config
        return {
            order: defaultColumns.filter(col => col.defaultVisible).map(col => col.key),
            hidden: defaultColumns.filter(col => !col.defaultVisible).map(col => col.key),
            version: 1
        };
    });

    // Save to localStorage whenever config changes
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(columnConfig));
        } catch (e) {
            console.warn('Failed to save table config:', e);
        }
    }, [columnConfig, storageKey]);

    // Get visible columns in order
    const visibleColumns = useCallback(() => {
        return columnConfig.order
            .filter(key => !columnConfig.hidden.includes(key))
            .map(key => defaultColumns.find(col => col.key === key))
            .filter(Boolean);
    }, [columnConfig, defaultColumns]);

    // Toggle column visibility
    const toggleColumn = useCallback((columnKey) => {
        const column = defaultColumns.find(col => col.key === columnKey);
        if (column?.required) return; // Can't hide required columns

        setColumnConfig(prev => {
            const isHidden = prev.hidden.includes(columnKey);
            if (isHidden) {
                // Show column - add to order if not present
                const newOrder = prev.order.includes(columnKey)
                    ? prev.order
                    : [...prev.order, columnKey];
                return {
                    ...prev,
                    order: newOrder,
                    hidden: prev.hidden.filter(k => k !== columnKey)
                };
            } else {
                // Hide column
                return {
                    ...prev,
                    hidden: [...prev.hidden, columnKey]
                };
            }
        });
    }, [defaultColumns]);

    // Reorder columns (move from one index to another)
    const reorderColumns = useCallback((fromIndex, toIndex) => {
        setColumnConfig(prev => {
            const newOrder = [...prev.order];
            const [moved] = newOrder.splice(fromIndex, 1);
            newOrder.splice(toIndex, 0, moved);
            return { ...prev, order: newOrder };
        });
    }, []);

    // Reset to default configuration
    const resetToDefault = useCallback(() => {
        setColumnConfig({
            order: defaultColumns.filter(col => col.defaultVisible).map(col => col.key),
            hidden: defaultColumns.filter(col => !col.defaultVisible).map(col => col.key),
            version: 1
        });
    }, [defaultColumns]);

    // Check if a column is visible
    const isColumnVisible = useCallback((columnKey) => {
        return !columnConfig.hidden.includes(columnKey);
    }, [columnConfig]);

    // Get all columns with their visibility state
    const getAllColumns = useCallback(() => {
        return defaultColumns.map(col => ({
            ...col,
            visible: !columnConfig.hidden.includes(col.key),
            order: columnConfig.order.indexOf(col.key)
        })).sort((a, b) => {
            // Sort by order, putting unordered items at the end
            if (a.order === -1) return 1;
            if (b.order === -1) return -1;
            return a.order - b.order;
        });
    }, [columnConfig, defaultColumns]);

    return {
        visibleColumns,
        toggleColumn,
        reorderColumns,
        resetToDefault,
        isColumnVisible,
        getAllColumns,
        columnConfig
    };
}

// Column definitions for Visits page
export const VISITS_COLUMNS = [
    { key: 'date', label: 'Datum', defaultVisible: true, required: true },
    { key: 'client', label: 'Klient', defaultVisible: true, required: true },
    { key: 'reasons', label: 'Důvody', defaultVisible: true, required: false },
    { key: 'cityAddress', label: 'Město & Adresa', defaultVisible: true, required: false },
    { key: 'worker', label: 'Pracovník', defaultVisible: true, required: false },
    { key: 'time', label: 'Čas', defaultVisible: true, required: false },
    { key: 'notes', label: 'Poznámky', defaultVisible: false, required: false },
    { key: 'clientAge', label: 'Věk klienta', defaultVisible: false, required: false },
];

// Column definitions for Clients page
export const CLIENTS_COLUMNS = [
    { key: 'name', label: 'Jméno', defaultVisible: true, required: true },
    { key: 'ageGender', label: 'Věk/Pohlaví', defaultVisible: true, required: false },
    { key: 'city', label: 'Město', defaultVisible: true, required: false },
    { key: 'address', label: 'Adresa', defaultVisible: true, required: false },
    { key: 'insurance', label: 'Pojišťovna', defaultVisible: true, required: false },
    { key: 'services', label: 'Výkony', defaultVisible: true, required: false },
    { key: 'status', label: 'Stav', defaultVisible: true, required: false },
    { key: 'phone', label: 'Telefon', defaultVisible: false, required: false },
    { key: 'ukrainianRegion', label: 'Ukrajinský region', defaultVisible: false, required: false },
];

export default useTableConfig;
