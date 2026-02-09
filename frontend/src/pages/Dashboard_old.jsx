import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

function Dashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await dashboardAPI.getData();
      setData(response.data);
    } catch (error) {
      toast.error('Nepodařilo se načíst data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Načítání...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nástěnka</h1>
          <p className="mt-1 text-gray-600">Přehled aktuálních informací</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Dnešní datum</p>
          <p className="text-lg font-semibold text-gray-900">
            {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: cs })}
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Celkem klientů"
          value={data?.clientStats?.total_clients || 0}
          subtitle={`${data?.clientStats?.active_clients || 0} aktivních`}
          icon="👥"
          color="bg-blue-500"
        />
        <StatCard
          title="Výkony (30 dní)"
          value={data?.serviceStats?.total_services || 0}
          subtitle={`${data?.serviceStats?.last_week || 0} tento týden`}
          icon="📋"
          color="bg-green-500"
        />
        <StatCard
          title="Muži / Ženy"
          value={`${data?.clientStats?.men || 0} / ${data?.clientStats?.women || 0}`}
          subtitle="Klienti podle pohlaví"
          icon="👤"
          color="bg-purple-500"
        />
        <StatCard
          title="Celkové minuty"
          value={Math.round((data?.serviceStats?.total_minutes || 0) / 60)}
          subtitle="hodin výkonů (30 dní)"
          icon="⏱️"
          color="bg-orange-500"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Key Clients */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Moji klíčoví klienti</h2>
            <Link to="/clients" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Zobrazit vše →
            </Link>
          </div>
          <div className="space-y-3">
            {data?.myClients?.length > 0 ? (
              data.myClients.slice(0, 5).map((client) => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {client.first_name} {client.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {client.service_count} výkonů
                        {client.last_service && ` • Poslední: ${format(new Date(client.last_service), 'd.M.yyyy')}`}
                      </p>
                    </div>
                    <span className={`badge ${
                      client.activity_status === 'active' ? 'badge-success' : 'badge-gray'
                    }`}>
                      {client.activity_status === 'active' ? 'Aktivní' : 'Neaktivní'}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Nemáte přiřazené žádné klíčové klienty</p>
            )}
          </div>
        </div>

        {/* Upcoming Revisions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Nadcházející revize</h2>
            <span className="badge badge-primary">{data?.upcomingRevisions?.length || 0}</span>
          </div>
          <div className="space-y-3">
            {data?.upcomingRevisions?.length > 0 ? (
              data.upcomingRevisions.slice(0, 5).map((revision) => (
                <Link
                  key={revision.id}
                  to={`/clients/${revision.client_id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {revision.first_name} {revision.last_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {revision.description || 'Revize individuálního plánu'}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-medium text-primary-600">
                        {format(new Date(revision.revision_date), 'd. MMM', { locale: cs })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Žádné nadcházející revize</p>
            )}
          </div>
        </div>

        {/* Expiring Contracts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Končící smlouvy</h2>
            <span className="badge badge-warning">{data?.expiringContracts?.length || 0}</span>
          </div>
          <div className="space-y-3">
            {data?.expiringContracts?.length > 0 ? (
              data.expiringContracts.slice(0, 5).map((contract) => (
                <Link
                  key={contract.id}
                  to={`/clients/${contract.client_id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {contract.first_name} {contract.last_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{contract.title}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-medium text-orange-600">
                        {format(new Date(contract.end_date), 'd. MMM', { locale: cs })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Žádné končící smlouvy</p>
            )}
          </div>
        </div>

        {/* Recent Notes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Poslední poznámky</h2>
            <span className="badge badge-primary">{data?.recentNotes?.length || 0}</span>
          </div>
          <div className="space-y-3">
            {data?.recentNotes?.length > 0 ? (
              data.recentNotes.slice(0, 5).map((note) => (
                <Link
                  key={note.id}
                  to={`/clients/${note.client_id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">
                          {note.first_name} {note.last_name}
                        </p>
                        {note.is_important && (
                          <span className="badge badge-danger text-xs">Důležité</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {note.title || note.content}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 ml-4">
                      {format(new Date(note.created_at), 'd.M.')}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Žádné poznámky</p>
            )}
          </div>
        </div>
      </div>

      {/* Services by Type Chart */}
      {data?.servicesByType?.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Výkony podle typu (30 dní)</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.servicesByType.map((item, index) => (
              <div key={index} className="text-center p-4 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold text-primary-600">{item.count}</p>
                <p className="text-sm text-gray-600 mt-1">{item.service_type}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, subtitle, icon, color }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-2">{subtitle}</p>
        </div>
        <div className={`${color} text-white w-12 h-12 rounded-xl flex items-center justify-center text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;











