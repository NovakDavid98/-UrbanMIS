import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * Context Menu Component
 * A reusable right-click context menu with submenu support
 */
function ContextMenu({ isOpen, position, onClose, children }) {
    const menuRef = useRef(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Adjust position to keep menu within viewport
    useEffect(() => {
        if (isOpen && menuRef.current) {
            const menu = menuRef.current;
            const rect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let x = position.x;
            let y = position.y;

            // Adjust horizontal position
            if (x + rect.width > viewportWidth - 10) {
                x = viewportWidth - rect.width - 10;
            }

            // Adjust vertical position
            if (y + rect.height > viewportHeight - 10) {
                y = viewportHeight - rect.height - 10;
            }

            setAdjustedPosition({ x: Math.max(10, x), y: Math.max(10, y) });
        }
    }, [isOpen, position]);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (isOpen) {
            // Use setTimeout to avoid immediate close from the same click
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[220px] bg-white rounded-xl shadow-2xl border border-gray-200 py-2 animate-contextMenuIn"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
            }}
        >
            {children}
        </div>
    );
}

/**
 * Context Menu Item
 */
function ContextMenuItem({
    icon: Icon,
    children,
    onClick,
    danger = false,
    disabled = false,
    submenu = null,
    onSubmenuOpen
}) {
    const [showSubmenu, setShowSubmenu] = useState(false);
    const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });
    const itemRef = useRef(null);

    const handleMouseEnter = () => {
        if (submenu && !disabled) {
            const rect = itemRef.current.getBoundingClientRect();
            setSubmenuPosition({
                x: rect.right - 5,
                y: rect.top
            });
            setShowSubmenu(true);
        }
    };

    const handleMouseLeave = (e) => {
        if (submenu) {
            // Check if mouse is moving to submenu
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && itemRef.current?.contains(relatedTarget)) return;
            setShowSubmenu(false);
        }
    };

    const handleClick = (e) => {
        if (disabled) return;
        if (submenu) {
            // Toggle submenu on click for mobile/touch
            if (!showSubmenu) {
                handleMouseEnter();
            }
            return;
        }
        onClick?.(e);
    };

    return (
        <div
            ref={itemRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                onClick={handleClick}
                disabled={disabled}
                className={`
          w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150
          ${disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : danger
                            ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                            : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
                    }
        `}
            >
                {Icon && (
                    <Icon className={`w-4 h-4 flex-shrink-0 ${danger ? 'text-red-500' : 'text-gray-400'}`} />
                )}
                <span className="flex-1 text-left">{children}</span>
                {submenu && (
                    <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                )}
            </button>

            {/* Submenu */}
            {showSubmenu && submenu && (
                <div
                    className="absolute left-full top-0 min-w-[180px] bg-white rounded-xl shadow-2xl border border-gray-200 py-2 animate-contextMenuIn"
                    style={{ marginLeft: '-5px' }}
                    onMouseEnter={() => setShowSubmenu(true)}
                    onMouseLeave={() => setShowSubmenu(false)}
                >
                    {submenu}
                </div>
            )}
        </div>
    );
}

/**
 * Context Menu Divider
 */
function ContextMenuDivider() {
    return <div className="my-1.5 mx-3 border-t border-gray-100" />;
}

/**
 * Context Menu Header (for grouping)
 */
function ContextMenuHeader({ children }) {
    return (
        <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {children}
        </div>
    );
}

// Export all components
export { ContextMenu, ContextMenuItem, ContextMenuDivider, ContextMenuHeader };
export default ContextMenu;
