import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { BrainIcon } from '../components/icons/BrainIcon';

function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await login(credentials);

    if (result.success) {
      toast.success('Přihlášení úspěšné!');
      navigate('/');
    } else {
      toast.error(result.error || 'Přihlášení selhalo');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Side - Form */}
      <div className="flex flex-col justify-center items-center p-8 bg-white lg:p-16 xl:p-24 relative overflow-hidden">
        {/* Mobile Background Blob - Decoration */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500 lg:hidden"></div>

        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-6 transform rotate-3 hover:rotate-6 transition-transform duration-300">
              <BrainIcon className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Vítejte zpět
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Centrální Mozek CEHUPO
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Uživatelské jméno
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    className="block w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20 transition-all outline-none bg-gray-50 focus:bg-white"
                    placeholder="Např. admin"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Heslo
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="block w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-20 transition-all outline-none bg-gray-50 focus:bg-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Přihlašování...
                  </span>
                ) : (
                  'Přihlásit se'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {/* Hidden by default, visible on hover for dev convenience if needed */}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 w-full text-center">
          <a
            href="https://digitalharbour.cz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors font-medium flex items-center justify-center gap-1 group"
          >
            <span>Made by</span>
            <span className="text-gray-900 group-hover:text-indigo-600 font-bold">Digitalharbour.cz</span>
          </a>
        </div>
      </div>

      {/* Right Side - Artistic Background */}
      <div className="hidden lg:flex relative bg-slate-900 overflow-hidden items-center justify-center">
        {/* Abstract Shapes */}
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900 z-0"></div>

        <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] rounded-full bg-indigo-600/20 blur-3xl filter mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-[40%] -left-[10%] w-[600px] h-[600px] rounded-full bg-purple-600/20 blur-3xl filter mix-blend-screen animate-pulse" style={{ animationDuration: '6s' }}></div>
        <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-3xl filter mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>

        {/* Pattern Grid Overlay */}
        <div className="absolute inset-0 z-10 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}>
        </div>

        {/* Content Overlay */}
        <div className="relative z-20 text-center px-12 max-w-2xl backdrop-blur-sm bg-white/5 rounded-3xl p-12 border border-white/10 shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-12 mb-4">
              <BrainIcon className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            Efektivní správa klientů <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
              na jednom místě
            </span>
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed">
            Moderní systém pro centrální evidenci, hlášení a analýzu dat pro CEHUPO.
            Bezpečné, rychlé a přehledné.
          </p>

          {/* Avatar section removed as per user request */}
        </div>
      </div>
    </div>
  );
}

export default Login;
