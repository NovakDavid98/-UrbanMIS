import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import BrandingSettings from '../components/BrandingSettings';
import {
  UserIcon,
  KeyIcon,
  CogIcon,
  PaintBrushIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

function Settings() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    interface: {
      theme: 'light',
      language: 'cs',
      sidebarCollapsed: false
    }
  });

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const tabs = [
    { id: 'profile', name: 'Profil', icon: UserIcon },
    { id: 'security', name: 'Zabezpečení', icon: KeyIcon },
    { id: 'preferences', name: 'Preference', icon: CogIcon }
  ];

  if (user?.role === 'admin') {
    tabs.push({ id: 'branding', name: 'Branding', icon: PaintBrushIcon });
  }

  useEffect(() => {
    loadPreferences();
  }, []);

  // Update profile form when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const response = await authAPI.getPreferences();
      if (response.data.preferences) {
        setPreferences(response.data.preferences);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Submitting profile form:', profileForm);
      const response = await authAPI.updateProfile(profileForm);
      console.log('Profile update response:', response.data);
      setUser(response.data.user);
      toast.success('Profil byl úspěšně aktualizován');
    } catch (error) {
      console.error('Profile update error:', error);
      console.error('Error response:', error.response);
      toast.error(error.response?.data?.error || 'Nepodařilo se aktualizovat profil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Nová hesla se neshodují');
      return;
    }

    if (passwordForm.newPassword.length < 12) {
      toast.error('Heslo musí mít alespoň 12 znaků');
      return;
    }

    setLoading(true);

    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast.success('Heslo bylo úspěšně změněno');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Nepodařilo se změnit heslo');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (category, key, value) => {
    const newPreferences = {
      ...preferences,
      [category]: {
        ...preferences[category],
        [key]: value
      }
    };

    setPreferences(newPreferences);

    try {
      await authAPI.updatePreferences(newPreferences);
      toast.success('Preference byly uloženy');
    } catch (error) {
      toast.error('Nepodařilo se uložit preference');
      console.error('Failed to save preferences:', error);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nastavení</h1>
        <p className="mt-1 text-gray-600">Spravujte svůj účet, zabezpečení a preference aplikace</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'profile' && (
          <div className="card">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Informace o profilu</h2>
              <p className="text-gray-600">Aktualizujte své osobní údaje</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jméno *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="input"
                    placeholder="Vaše jméno"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Příjmení *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="input"
                    placeholder="Vaše příjmení"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mailová adresa *
                </label>
                <input
                  type="email"
                  required
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input"
                  placeholder="vas@email.cz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="input"
                  placeholder="+420 123 456 789"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Ukládám...' : 'Uložit změny'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="card">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Změna hesla</h2>
              <p className="text-gray-600">Aktualizujte své heslo pro lepší zabezpečení</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Současné heslo *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="input pr-10"
                    placeholder="Zadejte současné heslo"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPasswords.current ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nové heslo *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="input pr-10"
                    placeholder="Zadejte nové heslo"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPasswords.new ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Heslo musí mít alespoň 12 znaků a obsahovat velká i malá písmena, číslice a speciální znaky
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Potvrdit nové heslo *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="input pr-10"
                    placeholder="Potvrďte nové heslo"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPasswords.confirm ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Měním heslo...' : 'Změnit heslo'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6">
            {/* Interface Preferences */}
            <div className="card">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Rozhraní</h2>
                <p className="text-gray-600">Přizpůsobte si vzhled a chování aplikace</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Motiv
                  </label>
                  <div className="flex space-x-4">
                    {[
                      { value: 'light', label: 'Světlý' },
                      { value: 'dark', label: 'Tmavý' },
                      { value: 'auto', label: 'Automatický' }
                    ].map((theme) => (
                      <label key={theme.value} className="flex items-center">
                        <input
                          type="radio"
                          name="theme"
                          value={theme.value}
                          checked={preferences.interface?.theme === theme.value}
                          onChange={(e) => handlePreferenceChange('interface', 'theme', e.target.value)}
                          className="mr-2"
                        />
                        {theme.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Jazyk
                  </label>
                  <select
                    value={preferences.interface?.language || 'cs'}
                    onChange={(e) => handlePreferenceChange('interface', 'language', e.target.value)}
                    className="input max-w-xs"
                  >
                    <option value="cs">Čeština</option>
                    <option value="en">English</option>
                    <option value="uk">Українська</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.interface?.sidebarCollapsed || false}
                      onChange={(e) => handlePreferenceChange('interface', 'sidebarCollapsed', e.target.checked)}
                      className="mr-3"
                    // onChange={(e) => handlePreferenceChange('interface', 'sidebarCollapsed', e.target.checked)}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Sbalit postranní panel při načtení
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branding' && user?.role === 'admin' && (
          <BrandingSettings />
        )}
      </div>
    </div>
  );
}

export default Settings;
