import { PencilIcon, TrashIcon, ClockIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline';

/**
 * ActivityCard - A single activity block in the weekly planner grid
 */
function ActivityCard({ activity, onEdit, onDelete }) {
    const formatTime = (time) => {
        if (!time) return '';
        return time.substring(0, 5); // "09:00:00" -> "09:00"
    };

    // Get background color from activity type or default
    const bgColor = activity.activity_type_color || '#6366f1';

    // Calculate duration in minutes for dynamic sizing
    const start = activity.start_time ? new Date(`1970-01-01T${activity.start_time}`) : new Date();
    const end = activity.end_time ? new Date(`1970-01-01T${activity.end_time}`) : new Date();
    const durationMinutes = (end - start) / 60000;

    // Determine text sizes based on duration
    let titleSize = 'text-sm';
    let detailSize = 'text-xs';
    let iconSize = 'w-3 h-3';

    if (durationMinutes >= 120) { // 2+ hours
        titleSize = 'text-lg';
        detailSize = 'text-sm';
        iconSize = 'w-4 h-4';
    } else if (durationMinutes >= 60) { // 1-2 hours
        titleSize = 'text-base';
        detailSize = 'text-xs';
        iconSize = 'w-3.5 h-3.5';
    }

    return (
        <div
            className="group relative rounded-lg p-2.5 text-white shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full overflow-hidden flex flex-col justify-center border-2 border-white"
            style={{ backgroundColor: bgColor }}
            onClick={() => onEdit(activity)}
        >
            {/* Title */}
            <h4 className={`font-semibold truncate pr-8 ${titleSize} leading-tight`}>{activity.title}</h4>

            <div className="flex flex-col gap-0.5 mt-1">
                {/* Time */}
                <div className={`flex items-center gap-1 opacity-90 ${detailSize}`}>
                    <ClockIcon className={iconSize} />
                    <span>{formatTime(activity.start_time)} - {formatTime(activity.end_time)}</span>
                </div>

                {/* Room */}
                {activity.room_name && (
                    <div className={`flex items-center gap-1 opacity-80 ${detailSize}`}>
                        <MapPinIcon className={iconSize} />
                        <span className="truncate">{activity.room_name}</span>
                    </div>
                )}

                {/* Assigned Worker */}
                {activity.worker_first_name && (
                    <div className={`flex items-center gap-1 opacity-80 ${detailSize}`}>
                        <UserIcon className={iconSize} />
                        <span className="truncate">{activity.worker_first_name} {activity.worker_last_name?.charAt(0)}.</span>
                    </div>
                )}
            </div>

            {/* Action buttons (visible on hover) */}
            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded p-0.5 backdrop-blur-sm">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(activity); }}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="Upravit"
                >
                    <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(activity.id); }}
                    className="p-1 hover:bg-red-500/80 rounded transition-colors"
                    title="Smazat"
                >
                    <TrashIcon className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export default ActivityCard;
