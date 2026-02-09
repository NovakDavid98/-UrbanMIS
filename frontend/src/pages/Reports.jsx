import { useEffect, useState } from 'react';
import { reportsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// High-contrast vibrant color palette for charts
const COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#0891B2', '#4F46E5', '#0D9488'];

function Reports() {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [servicesAnalytics, setServicesAnalytics] = useState(null);
  const [clientTimeline, setClientTimeline] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [engagement, setEngagement] = useState(null);

  // DEFAULT TO THIS YEAR (January 1st to today)
  const [dateRange, setDateRange] = useState({
    start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchAllReports();
  }, [dateRange]);

  const fetchAllReports = async () => {
    setIsLoading(true);
    try {
      const [dashRes, demoRes, servRes, timelineRes, alertRes, engRes] = await Promise.all([
        reportsAPI.getExecutiveDashboard(),  // No date filter - shows all-time totals
        reportsAPI.getDemographics(),
        reportsAPI.getServicesAnalytics({ groupBy: 'month' }),  // No date filter - shows all-time data
        reportsAPI.getClientTimeline(),
        reportsAPI.getAlerts(),
        reportsAPI.getEngagement()
      ]);

      setDashboardData(dashRes.data.data);
      setDemographics(demoRes.data.data);
      setServicesAnalytics(servRes.data.data);
      setClientTimeline(timelineRes.data.data);
      setAlerts(alertRes.data.data);
      setEngagement(engRes.data.data);
    } catch (error) {
      toast.error('Nepodařilo se načíst data přehledů');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick date range presets
  const setPreset = (preset) => {
    const now = new Date();
    let start, end;
    switch (preset) {
      case 'thisMonth':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'lastMonth':
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      case 'last3Months':
        start = startOfMonth(subMonths(now, 2));
        end = endOfMonth(now);
        break;
      case 'last6Months':
        start = startOfMonth(subMonths(now, 5));
        end = endOfMonth(now);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = endOfMonth(now);
        break;
      default:
        return;
    }
    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-indigo-200 rounded-full"></div>
            <div className="w-20 h-20 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-xl font-medium text-gray-700">Načítání analytiky...</p>
          <p className="mt-2 text-sm text-gray-500">Agregujeme data z databáze</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGM5Ljk0MSAwIDE4LTguMDU5IDE4LTE4cy04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNHMxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-20"></div>
        <div className="relative px-6 py-12 sm:px-8 lg:px-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                <span className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">📊</span>
                Analytický Dashboard
              </h1>
              <p className="mt-3 text-lg text-white/80 max-w-2xl">
                Komplexní přehled výkonnosti organizace v reálném čase
              </p>
            </div>

            {/* Date Range Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'thisMonth', label: 'Tento měsíc' },
                  { key: 'lastMonth', label: 'Minulý měsíc' },
                  { key: 'last3Months', label: '3 měsíce' },
                  { key: 'thisYear', label: 'Letos' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setPreset(key)}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200 hover:scale-105"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20">
                <input
                  type="date"
                  className="bg-transparent text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-white/50"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
                <span className="text-white/60">→</span>
                <input
                  type="date"
                  className="bg-transparent text-white text-sm px-3 py-2 rounded-lg border-0 focus:ring-2 focus:ring-white/50"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8 sm:px-8 lg:px-12 space-y-8">

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Clients Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-500/10 border border-gray-100 hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                  {dashboardData?.clients.active} aktivních
                </span>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Celkem klientů</p>
              <p className="text-4xl font-bold text-gray-900">{dashboardData?.clients.total?.toLocaleString()}</p>
              <p className="mt-2 text-sm text-gray-500">⌀ věk: <span className="font-semibold text-gray-700">{dashboardData?.clients.avgAge} let</span></p>
            </div>
          </div>

          {/* Total Services Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg shadow-emerald-500/10 border border-gray-100 hover:shadow-xl hover:shadow-emerald-500/20 transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${dashboardData?.services.trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  <svg className={`w-4 h-4 ${dashboardData?.services.trend >= 0 ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {Math.abs(dashboardData?.services.trend || 0)}%
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Celkem výkonů <span className="text-xs text-gray-400">(z evidence)</span></p>
              <p className="text-4xl font-bold text-gray-900">{dashboardData?.services.total?.toLocaleString()}</p>
              <p className="mt-2 text-sm text-gray-500">Data do 08/2025</p>
            </div>
          </div>

          {/* Service Hours Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg shadow-violet-500/10 border border-gray-100 hover:shadow-xl hover:shadow-violet-500/20 transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Odpracované hodiny <span className="text-xs text-gray-400">(z evidence)</span></p>
              <p className="text-4xl font-bold text-gray-900">{dashboardData?.services.totalHours?.toLocaleString()}</p>
              <p className="mt-2 text-sm text-gray-500">Data do 08/2025</p>
            </div>
          </div>

          {/* Alerts Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg shadow-amber-500/10 border border-gray-100 hover:shadow-xl hover:shadow-amber-500/20 transition-all duration-300 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                {(alerts?.expiringContracts?.length || 0) > 0 && (
                  <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 animate-pulse">
                    Vyžaduje pozornost
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">Upozornění</p>
              <p className="text-4xl font-bold text-gray-900">{alerts?.expiringContracts?.length || 0}</p>
              <p className="mt-2 text-sm text-gray-500">Končící smlouvy</p>
            </div>
          </div>
        </div>

        {/* Charts Row 1: Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Client Arrival Timeline */}
          <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Příchody klientů v čase</h2>
                <p className="text-sm text-gray-500">Datum příchodu do ČR</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={clientTimeline?.arrivalTimeline || []}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="period"
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px' }}
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${month}/${year.slice(2)}`;
                  }}
                />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                  labelFormatter={(value) => {
                    const [year, month] = value.split('-');
                    const months = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
                    return `${months[parseInt(month) - 1]} ${year}`;
                  }}
                  formatter={(value) => [value, 'Nových klientů']}
                />
                <Bar dataKey="count" name="Klienti" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative Client Growth */}
          <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Kumulativní růst</h2>
                <p className="text-sm text-gray-500">Celkem obsloužených klientů</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={clientTimeline?.cumulativeGrowth || []}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="period"
                  stroke="#9CA3AF"
                  style={{ fontSize: '11px' }}
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${month}/${year.slice(2)}`;
                  }}
                />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                  labelFormatter={(value) => {
                    const [year, month] = value.split('-');
                    const months = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
                    return `${months[parseInt(month) - 1]} ${year}`;
                  }}
                  formatter={(value, name) => {
                    if (name === 'cumulative_total') return [value, 'Celkem klientů'];
                    return [value, 'Nových tento měsíc'];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative_total"
                  name="cumulative_total"
                  stroke="#10B981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#areaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2: Demographics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gender Distribution */}
          <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Rozdělení podle pohlaví</h2>
                <p className="text-sm text-gray-500">Poměr mužů a žen</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <defs>
                  <linearGradient id="pieGradient1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                  <linearGradient id="pieGradient2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#F43F5E" />
                  </linearGradient>
                </defs>
                <Pie
                  data={demographics?.gender || []}
                  dataKey="count"
                  nameKey="gender"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  label={({ gender, percent }) => percent > 0.05 ? `${gender} ${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {demographics?.gender?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#pieGradient1)' : 'url(#pieGradient2)'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                  formatter={(value, name) => [value, name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Age Distribution */}
          <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Věkové skupiny</h2>
                <p className="text-sm text-gray-500">Rozložení podle věku</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={demographics?.ageGroups || []}>
                <defs>
                  <linearGradient id="ageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14B8A6" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="age_group" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="url(#ageGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 3: Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Services by Type */}
          <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nejčastější typy výkonů</h2>
                <p className="text-sm text-gray-500">Top 8 typů služeb</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={servicesAnalytics?.byType?.slice(0, 8) || []} layout="vertical">
                <defs>
                  <linearGradient id="serviceGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#A78BFA" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis type="number" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <YAxis dataKey="type" type="category" width={140} stroke="#9CA3AF" style={{ fontSize: '11px' }} tick={{ fill: '#4B5563' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="count" fill="url(#serviceGradient)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Services by Location */}
          <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Místa poskytování služeb</h2>
                <p className="text-sm text-gray-500">Rozdělení podle lokace</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={servicesAnalytics?.byLocation || []}
                  dataKey="count"
                  nameKey="location"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  label={({ location, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                >
                  {servicesAnalytics?.byLocation?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                  formatter={(value) => [value, 'Výkonů']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Regions */}
        <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Nejčastější oblasti původu</h2>
              <p className="text-sm text-gray-500">Ukrajinské regiony</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={demographics?.regions || []}>
              <defs>
                <linearGradient id="regionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14B8A6" />
                  <stop offset="100%" stopColor="#0D9488" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} stroke="#9CA3AF" style={{ fontSize: '10px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
              />
              <Bar dataKey="count" fill="url(#regionGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Worker Performance */}
        <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Výkonnost pracovníků</h2>
              <p className="text-sm text-gray-500">Počet výkonů + návštěv na osobu</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={servicesAnalytics?.workerPerformance || []}>
              <defs>
                <linearGradient id="workerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="worker_name" angle={-25} textAnchor="end" height={80} stroke="#9CA3AF" style={{ fontSize: '11px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="service_count" name="Počet výkonů" fill="url(#workerGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client Engagement */}
        <div className="rounded-2xl bg-white shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Zapojení klientů</h2>
              <p className="text-sm text-gray-500">Počet výkonů + návštěv na klienta</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={engagement?.servicesPerClient || []}>
              <defs>
                <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="range" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
              />
              <Bar dataKey="client_count" name="Počet klientů" fill="url(#engagementGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Reports;
