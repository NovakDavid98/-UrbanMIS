import { useState, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format, addMonths, subMonths, isSameMonth, startOfMonth, setMonth, setYear } from 'date-fns';
import { cs } from 'date-fns/locale';

/**
 * MonthPicker Component
 * Allows selecting a specific month and year.
 * 
 * @param {Date|null} selectedDate - Currently selected date (only month/year matters)
 * @param {Function} onChange - Callback (date) => {}
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Additional classes
 */
const MonthPicker = ({ selectedDate, onChange, placeholder = "Vybrat měsíc", className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(selectedDate || new Date());
    // Mode: 'months' (select month in year) or 'years' (select year)
    const [viewMode, setViewMode] = useState('months');
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setViewMode('months'); // Reset view mode on close
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (selectedDate) {
            setViewDate(selectedDate);
        }
    }, [selectedDate]);

    const handleMonthSelect = (monthIndex) => {
        const newDate = setMonth(viewDate, monthIndex);
        onChange(startOfMonth(newDate));
        setIsOpen(false);
    };

    const handleYearSelect = (year) => {
        const newDate = setYear(viewDate, year);
        setViewDate(newDate);
        setViewMode('months'); // Go back to month selection
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange(null);
    };

    const nextYear = () => setViewDate(prev => addMonths(prev, 12));
    const prevYear = () => setViewDate(prev => subMonths(prev, 12));

    // Generate years for year view (e.g., 12 years window)
    const generateYears = () => {
        const currentYear = viewDate.getFullYear();
        const startYear = currentYear - 5;
        const years = [];
        for (let i = 0; i < 12; i++) {
            years.push(startYear + i);
        }
        return years;
    };

    const months = [
        'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ];

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
          flex items-center justify-between
          w-full px-4 py-2 bg-white border rounded-lg shadow-sm cursor-pointer
          transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
          ${selectedDate ? 'border-blue-500 text-blue-700 font-medium' : 'border-gray-300 text-gray-500'}
        `}
            >
                <div className="flex items-center gap-2">
                    <CalendarIcon className={`w-5 h-5 ${selectedDate ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span>
                        {selectedDate
                            ? format(selectedDate, 'LLLL yyyy', { locale: cs })
                            : placeholder
                        }
                    </span>
                </div>
                {selectedDate && (
                    <button
                        onClick={handleClear}
                        className="p-1 hover:bg-blue-100 rounded-full text-blue-400 hover:text-blue-600 transition-colors"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-fadeIn">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
                        <button
                            onClick={viewMode === 'months' ? prevYear : () => setViewDate(d => setYear(d, d.getFullYear() - 10))}
                            className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode(viewMode === 'months' ? 'years' : 'months')}
                            className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-gray-200"
                        >
                            {viewMode === 'months' ? format(viewDate, 'yyyy') : 'Vyberte rok'}
                        </button>
                        <button
                            onClick={viewMode === 'months' ? nextYear : () => setViewDate(d => setYear(d, d.getFullYear() + 10))}
                            className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-3">
                        {viewMode === 'months' ? (
                            <div className="grid grid-cols-3 gap-2">
                                {months.map((month, index) => {
                                    const isSelected = selectedDate && selectedDate.getMonth() === index && selectedDate.getFullYear() === viewDate.getFullYear();
                                    const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === viewDate.getFullYear();

                                    return (
                                        <button
                                            key={month}
                                            onClick={() => handleMonthSelect(index)}
                                            className={`
                        py-2 text-sm rounded-lg transition-colors
                        ${isSelected
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : isCurrentMonth
                                                        ? 'bg-blue-50 text-blue-700 font-medium hover:bg-blue-100'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                                }
                      `}
                                        >
                                            {month.substring(0, 3)}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {generateYears().map((year) => {
                                    const isSelected = selectedDate && selectedDate.getFullYear() === year;
                                    const isCurrentYear = new Date().getFullYear() === year;

                                    return (
                                        <button
                                            key={year}
                                            onClick={() => handleYearSelect(year)}
                                            className={`
                        py-2 text-sm rounded-lg transition-colors
                        ${isSelected
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : isCurrentYear
                                                        ? 'bg-blue-50 text-blue-700 font-medium hover:bg-blue-100'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                                }
                      `}
                                        >
                                            {year}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthPicker;
