import { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { clientsAPI, workersAPI } from '../../services/api';

/**
 * NewActivityModal - Modal for creating or editing activities
 */
function NewActivityModal({
    isOpen,
    onClose,
    onSubmit,
    activity = null,
    activityTypes = [],
    rooms = [],
    dayNames = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'],
}) {
    const isEditing = !!activity?.id;

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        activityTypeId: '',
        roomId: '',
        assignedWorkerId: '',
        clientId: '',
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:00',
        notes: '',
    });

    const [workers, setWorkers] = useState([]);
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load workers and clients on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [workersRes, clientsRes] = await Promise.all([
                    workersAPI.getAll({ limit: 100 }),
                    clientsAPI.getAll({ limit: 200, is_active: true }),
                ]);
                setWorkers(workersRes.data.workers || []);
                setClients(clientsRes.data.clients || []);
            } catch (error) {
                console.error('Error fetching reference data:', error);
            }
        };
        if (isOpen) fetchData();
    }, [isOpen]);

    // Populate form when editing
    useEffect(() => {
        if (activity) {
            setFormData({
                title: activity.title || '',
                description: activity.description || '',
                activityTypeId: activity.activity_type_id || '',
                roomId: activity.room_id || '',
                assignedWorkerId: activity.assigned_worker_id || '',
                clientId: activity.client_id || '',
                dayOfWeek: activity.day_of_week ?? 0,
                startTime: activity.start_time?.substring(0, 5) || '09:00',
                endTime: activity.end_time?.substring(0, 5) || '10:00',
                notes: activity.notes || '',
            });
        } else {
            // Reset to defaults for new activity, preserving clicked day if provided
            setFormData((prev) => ({
                title: '',
                description: '',
                activityTypeId: '',
                roomId: '',
                assignedWorkerId: '',
                clientId: '',
                dayOfWeek: activity?.day_of_week ?? prev.dayOfWeek ?? 0,
                startTime: activity?.start_time || '09:00',
                endTime: '10:00',
                notes: '',
            }));
        }
    }, [activity, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.startTime || !formData.endTime) {
            return;
        }

        // Sanitize data: convert empty strings to null for UUID fields
        const sanitizedData = {
            ...formData,
            activityTypeId: formData.activityTypeId || null,
            roomId: formData.roomId || null,
            assignedWorkerId: formData.assignedWorkerId || null,
            clientId: formData.clientId || null,
        };

        setIsLoading(true);
        try {
            await onSubmit(sanitizedData);
            onClose();
        } catch (error) {
            console.error('Error submitting activity:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Generate time options from 06:00 to 22:00
    const timeOptions = [];
    for (let h = 6; h <= 22; h++) {
        for (let m = 0; m < 60; m += 30) {
            const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            timeOptions.push(time);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <PlusIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {isEditing ? 'Upravit aktivitu' : 'Nová aktivita'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Název *</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Např. Ranní porada"
                            required
                        />
                    </div>

                    {/* Day and Times (row) */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Den *</label>
                            <select
                                name="dayOfWeek"
                                value={formData.dayOfWeek}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {dayNames.map((day, idx) => (
                                    <option key={idx} value={idx}>{day}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Od *</label>
                            <select
                                name="startTime"
                                value={formData.startTime}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {timeOptions.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Do *</label>
                            <select
                                name="endTime"
                                value={formData.endTime}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                {timeOptions.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Activity Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Typ aktivity</label>
                        <select
                            name="activityTypeId"
                            value={formData.activityTypeId}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Vyberte typ...</option>
                            {activityTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name_cs || type.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Room */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Místnost</label>
                        <select
                            name="roomId"
                            value={formData.roomId}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Vyberte místnost...</option>
                            {rooms.map((room) => (
                                <option key={room.id} value={room.id}>
                                    {room.name} {room.capacity ? `(${room.capacity} míst)` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Assigned Worker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Zodpovědný pracovník</label>
                        <select
                            name="assignedWorkerId"
                            value={formData.assignedWorkerId}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Vyberte pracovníka...</option>
                            {workers.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.first_name} {w.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Client (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Klient (volitelné)</label>
                        <select
                            name="clientId"
                            value={formData.clientId}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">Bez klienta</option>
                            {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.first_name} {c.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Poznámky</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                            placeholder="Další informace..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
                        >
                            Zrušit
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !formData.title.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm shadow-sm"
                        >
                            {isLoading ? 'Ukládání...' : isEditing ? 'Uložit změny' : 'Vytvořit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default NewActivityModal;
