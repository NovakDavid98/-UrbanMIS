import { useState, useRef } from 'react';
import { XMarkIcon, Bars3Icon, ArrowPathIcon, EyeIcon, EyeSlashIcon, LockClosedIcon } from '@heroicons/react/24/outline';

/**
 * Column Configuration Panel
 * Slide-out panel for managing table column visibility and order
 */
function ColumnConfigPanel({
    isOpen,
    onClose,
    columns,
    onToggleColumn,
    onReorderColumns,
    onReset
}) {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dragNodeRef = useRef(null);

    if (!isOpen) return null;

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        dragNodeRef.current = e.target;
        e.target.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index);
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        setDragOverIndex(index);
    };

    const handleDrop = (e, toIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === toIndex) return;
        onReorderColumns(draggedIndex, toIndex);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    // Sort columns by their current order
    const sortedColumns = [...columns].sort((a, b) => {
        if (a.order === -1) return 1;
        if (b.order === -1) return -1;
        return a.order - b.order;
    });

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998] animate-fadeIn"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-[9999] animate-slideInRight flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-secondary-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Nastavení sloupců</h2>
                        <p className="text-xs text-gray-500">Přetáhněte pro změnu pořadí</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-colors"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Column List */}
                <div className="flex-1 overflow-y-auto py-3">
                    {sortedColumns.map((column, index) => (
                        <div
                            key={column.key}
                            draggable={!column.required}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`
                flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-150
                ${dragOverIndex === index ? 'bg-primary-100 border-2 border-primary-400 border-dashed' : ''}
                ${draggedIndex === index ? 'opacity-50' : ''}
                ${column.required ? 'bg-gray-50' : 'hover:bg-gray-50 cursor-grab active:cursor-grabbing'}
              `}
                        >
                            {/* Drag Handle */}
                            <div className={`flex-shrink-0 ${column.required ? 'text-gray-300' : 'text-gray-400'}`}>
                                {column.required ? (
                                    <LockClosedIcon className="w-4 h-4" />
                                ) : (
                                    <Bars3Icon className="w-4 h-4" />
                                )}
                            </div>

                            {/* Column Name */}
                            <span className={`flex-1 text-sm font-medium ${column.visible ? 'text-gray-900' : 'text-gray-400'}`}>
                                {column.label}
                                {column.required && (
                                    <span className="ml-2 text-xs text-gray-400">(povinný)</span>
                                )}
                            </span>

                            {/* Visibility Toggle */}
                            <button
                                onClick={() => onToggleColumn(column.key)}
                                disabled={column.required}
                                className={`
                  p-1.5 rounded-lg transition-colors
                  ${column.required
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : column.visible
                                            ? 'text-primary-600 hover:bg-primary-50'
                                            : 'text-gray-400 hover:bg-gray-100'
                                    }
                `}
                                title={column.required ? 'Tento sloupec nelze skrýt' : (column.visible ? 'Skrýt sloupec' : 'Zobrazit sloupec')}
                            >
                                {column.visible ? (
                                    <EyeIcon className="w-5 h-5" />
                                ) : (
                                    <EyeSlashIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onReset}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Obnovit výchozí zobrazení
                    </button>
                </div>
            </div>
        </>
    );
}

export default ColumnConfigPanel;
