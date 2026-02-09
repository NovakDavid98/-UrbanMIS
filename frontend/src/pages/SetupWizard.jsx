import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const SetupWizard = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null);

    const [formData, setFormData] = useState({
        // Step 1: Database
        dbHost: 'localhost',
        dbPort: '5432',
        dbName: 'urbanmis',
        dbUser: '',
        dbPassword: '',
        // Step 2: Admin Account
        adminUsername: 'admin',
        adminEmail: '',
        adminPassword: '',
        adminPasswordConfirm: '',
        adminFirstName: '',
        adminLastName: '',
        // Step 3: Organization
        orgName: '',
        orgLogo: null,
        primaryColor: '#4F46E5',
        // Step 4: Terminology
        clientTerm: 'Client',
        workerTerm: 'Worker',
        visitTerm: 'Visit'
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const testDatabaseConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus(null);
        try {
            const response = await axios.post('/api/setup/test-db', {
                host: formData.dbHost,
                port: formData.dbPort,
                database: formData.dbName,
                user: formData.dbUser,
                password: formData.dbPassword
            });
            setConnectionStatus({ success: true, message: response.data.message });
        } catch (error) {
            setConnectionStatus({
                success: false,
                message: error.response?.data?.error || 'Connection failed'
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSubmit = async () => {
        if (formData.adminPassword !== formData.adminPasswordConfirm) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/setup/initialize', {
                database: {
                    host: formData.dbHost,
                    port: formData.dbPort,
                    name: formData.dbName,
                    user: formData.dbUser,
                    password: formData.dbPassword
                },
                admin: {
                    username: formData.adminUsername,
                    email: formData.adminEmail,
                    password: formData.adminPassword,
                    firstName: formData.adminFirstName,
                    lastName: formData.adminLastName
                },
                organization: {
                    name: formData.orgName,
                    primaryColor: formData.primaryColor
                },
                terminology: {
                    client: formData.clientTerm,
                    worker: formData.workerTerm,
                    visit: formData.visitTerm
                }
            });

            toast.success('Setup complete');
            onComplete?.();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Setup failed');
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep(s => Math.min(s + 1, 4));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">UrbanMIS Setup</h1>
                    <p className="text-gray-500 mt-2">Configure your installation in a few steps</p>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center mb-8">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                                }`}>
                                {s}
                            </div>
                            {s < 4 && (
                                <div className={`w-12 h-1 ${step > s ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Database */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Database Connection</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                                <input
                                    type="text"
                                    value={formData.dbHost}
                                    onChange={(e) => handleChange('dbHost', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                                <input
                                    type="text"
                                    value={formData.dbPort}
                                    onChange={(e) => handleChange('dbPort', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Database Name</label>
                            <input
                                type="text"
                                value={formData.dbName}
                                onChange={(e) => handleChange('dbName', e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={formData.dbUser}
                                    onChange={(e) => handleChange('dbUser', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={formData.dbPassword}
                                    onChange={(e) => handleChange('dbPassword', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <button
                            onClick={testDatabaseConnection}
                            disabled={testingConnection}
                            className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            {testingConnection ? 'Testing...' : 'Test Connection'}
                        </button>
                        {connectionStatus && (
                            <div className={`p-3 rounded-lg text-sm ${connectionStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                }`}>
                                {connectionStatus.message}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Admin Account */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Administrator Account</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input
                                    type="text"
                                    value={formData.adminFirstName}
                                    onChange={(e) => handleChange('adminFirstName', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input
                                    type="text"
                                    value={formData.adminLastName}
                                    onChange={(e) => handleChange('adminLastName', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <input
                                type="text"
                                value={formData.adminUsername}
                                onChange={(e) => handleChange('adminUsername', e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={formData.adminEmail}
                                onChange={(e) => handleChange('adminEmail', e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={formData.adminPassword}
                                    onChange={(e) => handleChange('adminPassword', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value={formData.adminPasswordConfirm}
                                    onChange={(e) => handleChange('adminPasswordConfirm', e.target.value)}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Organization */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Organization Details</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                            <input
                                type="text"
                                value={formData.orgName}
                                onChange={(e) => handleChange('orgName', e.target.value)}
                                placeholder="Your NGO Name"
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Brand Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={formData.primaryColor}
                                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                                    className="w-12 h-10 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={formData.primaryColor}
                                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                                    className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="p-4 rounded-lg border-2 border-dashed border-gray-300 text-center">
                            <p className="text-sm text-gray-500">Logo upload available after setup</p>
                        </div>
                    </div>
                )}

                {/* Step 4: Terminology */}
                {step === 4 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Terminology</h2>
                        <p className="text-sm text-gray-500">Customize how entities are named in your system</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                What do you call the people you help?
                            </label>
                            <select
                                value={formData.clientTerm}
                                onChange={(e) => handleChange('clientTerm', e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="Client">Client</option>
                                <option value="Beneficiary">Beneficiary</option>
                                <option value="Patient">Patient</option>
                                <option value="Participant">Participant</option>
                                <option value="Refugee">Refugee</option>
                                <option value="Person">Person</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                What do you call your staff?
                            </label>
                            <select
                                value={formData.workerTerm}
                                onChange={(e) => handleChange('workerTerm', e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="Worker">Worker</option>
                                <option value="Staff">Staff</option>
                                <option value="Volunteer">Volunteer</option>
                                <option value="Counselor">Counselor</option>
                                <option value="Case Manager">Case Manager</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                What do you call interactions?
                            </label>
                            <select
                                value={formData.visitTerm}
                                onChange={(e) => handleChange('visitTerm', e.target.value)}
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="Visit">Visit</option>
                                <option value="Session">Session</option>
                                <option value="Encounter">Encounter</option>
                                <option value="Interaction">Interaction</option>
                                <option value="Service">Service</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-8">
                    <button
                        onClick={prevStep}
                        disabled={step === 1}
                        className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Back
                    </button>
                    {step < 4 ? (
                        <button
                            onClick={nextStep}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Setting up...' : 'Complete Setup'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SetupWizard;
