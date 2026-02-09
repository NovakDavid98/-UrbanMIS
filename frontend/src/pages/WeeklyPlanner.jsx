import { useState, useEffect } from 'react';
import { plannerAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, addWeeks, subWeeks, getWeek, getYear } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  CalendarIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

import ActivityCard from '../components/planner/ActivityCard';
import NewActivityModal from '../components/planner/NewActivityModal';

// Time slots from 6:00 to 21:00
const TIME_SLOTS = [];
for (let h = 6; h <= 21; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
}

const DAY_NAMES = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const ROW_HEIGHT = 64; // pixels per hour slot

function WeeklyPlanner() {
  const { user } = useAuthStore();
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [activities, setActivities] = useState([]);
  const [plannerId, setPlannerId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Reference data
  const [activityTypes, setActivityTypes] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  // Fetch or create planner for current week
  useEffect(() => {
    if (user?.id) {
      fetchWeekData();
      fetchReferenceData();
    }
  }, [currentWeek, user?.id]);

  const fetchWeekData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const weekNumber = getWeek(currentWeek, { weekStartsOn: 1 });
      const year = getYear(currentWeek);

      const response = await plannerAPI.getAll({ year, week: weekNumber, user_id: user.id });
      const planners = response.data.planners || [];

      if (planners.length > 0) {
        const planner = planners[0];
        setPlannerId(planner.id);
        const details = await plannerAPI.getById(planner.id);
        setActivities(details.data.activities || []);
      } else {
        const newPlanner = await plannerAPI.create({
          title: `Týden ${weekNumber}`,
          description: `Plán pro týden ${weekNumber}/${year}`,
          weekStartDate: format(currentWeek, 'yyyy-MM-dd'),
          isShared: true,
        });
        setPlannerId(newPlanner.data.id);
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching week data:', error);
      toast.error('Nepodařilo se načíst data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [typesRes, roomsRes] = await Promise.all([
        plannerAPI.getActivityTypes().catch(() => ({ data: { activityTypes: [] } })),
        plannerAPI.getRooms().catch(() => ({ data: { rooms: [] } })),
      ]);
      setActivityTypes(typesRes.data.activityTypes || []);
      setRooms(roomsRes.data.rooms || []);
    } catch (error) {
      console.error('Error fetching reference data:', error);
    }
  };

  // Calculate activity position and height
  const getActivityStyle = (activity) => {
    const startHour = parseInt(activity.start_time?.substring(0, 2), 10) || 6;
    const startMin = parseInt(activity.start_time?.substring(3, 5), 10) || 0;
    const endHour = parseInt(activity.end_time?.substring(0, 2), 10) || startHour + 1;
    const endMin = parseInt(activity.end_time?.substring(3, 5), 10) || 0;

    const startOffset = (startHour - 6) * ROW_HEIGHT + (startMin / 60) * ROW_HEIGHT;
    const endOffset = (endHour - 6) * ROW_HEIGHT + (endMin / 60) * ROW_HEIGHT;
    const height = endOffset - startOffset;

    return {
      top: `${startOffset}px`,
      height: `${Math.max(height, 24)}px`,
    };
  };

  // Get activities for a specific day
  const getActivitiesForDay = (dayIndex) => {
    return activities.filter((act) => act.day_of_week === dayIndex);
  };

  // Handlers
  const handleCreateActivity = async (formData) => {
    if (!plannerId) return;

    try {
      await plannerAPI.createActivity(plannerId, formData);
      await fetchWeekData();
      toast.success('Aktivita vytvořena');
    } catch (error) {
      console.error('Error creating activity:', error);
      toast.error(error.response?.data?.error || 'Nepodařilo se vytvořit aktivitu');
      throw error;
    }
  };

  const handleUpdateActivity = async (formData) => {
    if (!plannerId || !editingActivity?.id) return;

    try {
      await plannerAPI.updateActivity(plannerId, editingActivity.id, formData);
      await fetchWeekData();
      toast.success('Aktivita aktualizována');
    } catch (error) {
      console.error('Error updating activity:', error);
      toast.error('Nepodařilo se aktualizovat aktivitu');
      throw error;
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!plannerId) return;
    if (!confirm('Opravdu chcete smazat tuto aktivitu?')) return;

    try {
      await plannerAPI.deleteActivity(plannerId, activityId);
      await fetchWeekData();
      toast.success('Aktivita smazána');
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Nepodařilo se smazat aktivitu');
    }
  };

  const openModalForNew = (dayIndex = 0, time = '09:00') => {
    setEditingActivity({ day_of_week: dayIndex, start_time: time });
    setShowModal(true);
  };

  const openModalForEdit = (activity) => {
    setEditingActivity(activity);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingActivity(null);
  };

  // Week navigation
  const goToPreviousWeek = () => setCurrentWeek((prev) => subWeeks(prev, 1));
  const goToNextWeek = () => setCurrentWeek((prev) => addWeeks(prev, 1));
  const goToToday = () => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Generate week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-500">Načítání plánovače...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-indigo-600" />
            Týdenní plánovač
          </h1>
          <p className="text-gray-500 text-sm mt-1">Koordinace aktivit a plánování místností</p>
        </div>

        <button
          onClick={() => openModalForNew()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Nová aktivita
        </button>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-indigo-600"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Týden {getWeek(currentWeek, { weekStartsOn: 1 })} / {getYear(currentWeek)}
            </h2>
            <p className="text-sm text-gray-500">
              {format(currentWeek, 'd. MMMM', { locale: cs })} – {format(addDays(currentWeek, 6), 'd. MMMM yyyy', { locale: cs })}
            </p>
          </div>

          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-indigo-600"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            onClick={goToToday}
            className="px-4 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-sm font-medium"
          >
            Dnes
          </button>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header Row */}
            <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-200">
              <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Čas
              </div>
              {weekDates.map((date, idx) => {
                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div
                    key={idx}
                    className={`p-3 text-center ${isToday ? 'bg-indigo-50' : ''}`}
                  >
                    <div className={`text-sm font-semibold ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {DAY_NAMES[idx]}
                    </div>
                    <div className={`text-xs ${isToday ? 'text-indigo-500' : 'text-gray-400'}`}>
                      {format(date, 'd.M.')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid Body */}
            <div className="grid grid-cols-8">
              {/* Time Column */}
              <div className="border-r border-gray-100">
                {TIME_SLOTS.map((time) => (
                  <div
                    key={time}
                    className="h-16 p-2 text-xs font-medium text-gray-400 text-right pr-3 border-b border-gray-100"
                  >
                    {time}
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              {weekDates.map((date, dayIndex) => {
                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const dayActivities = getActivitiesForDay(dayIndex);

                return (
                  <div
                    key={dayIndex}
                    className={`relative border-r border-gray-100 ${isToday ? 'bg-indigo-50/20' : ''}`}
                  >
                    {/* Background grid lines */}
                    {TIME_SLOTS.map((time, slotIdx) => (
                      <div
                        key={time}
                        className="h-16 border-b border-gray-100 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                        onClick={() => openModalForNew(dayIndex, time)}
                      />
                    ))}

                    {/* Activities (absolutely positioned) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {dayActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className="absolute left-1 right-1 pointer-events-auto"
                          style={getActivityStyle(activity)}
                        >
                          <ActivityCard
                            activity={activity}
                            onEdit={openModalForEdit}
                            onDelete={handleDeleteActivity}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <NewActivityModal
        isOpen={showModal}
        onClose={closeModal}
        onSubmit={editingActivity?.id ? handleUpdateActivity : handleCreateActivity}
        activity={editingActivity}
        activityTypes={activityTypes}
        rooms={rooms}
        dayNames={DAY_NAMES}
      />
    </div>
  );
}

export default WeeklyPlanner;
