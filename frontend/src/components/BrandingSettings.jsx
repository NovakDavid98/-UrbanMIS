import { useState, useRef } from 'react';
import { useBranding } from '../contexts/BrandingContext';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const BrandingSettings = () => {
    const { organization, terminology, updateBranding } = useBranding();
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        orgName: organization.name,
        primaryColor: organization.primaryColor,
        clientTerm: terminology.client,
        workerTerm: terminology.worker,
        visitTerm: terminology.visit
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        const result = await updateBranding({
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

        if (result.success) {
            toast.success('Branding updated successfully');
        } else {
            toast.error('Failed to update branding');
        }
        setLoading(false);
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/branding/logo', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });
            await updateBranding({}); // Refresh context
            toast.success('Logo uploaded successfully');
        } catch (error) {
            toast.error('Failed to upload logo');
        }
    };

    const handleDeleteLogo = async () => {
        if (!confirm('Are you sure you want to delete the logo?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete('/api/branding/logo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            await updateBranding({}); // Refresh context
            toast.success('Logo deleted');
        } catch (error) {
            toast.error('Failed to delete logo');
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Organization & Brand</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                        <input
                            type="text"
                            value={formData.orgName}
                            onChange={(e) => handleChange('orgName', e.target.value)}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                        <div className="flex items-center gap-4">
                            {organization.logo ? (
                                <div className="relative group">
                                    <img
                                        src={organization.logo}
                                        alt="Logo"
                                        className="h-16 w-auto rounded-lg border border-gray-200"
                                    />
                                    <button
                                        onClick={handleDeleteLogo}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 text-gray-400">
                                    No Logo
                                </div>
                            )}
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleLogoUpload}
                                    accept="image/png,image/jpeg,image/svg+xml"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Upload Logo
                                </button>
                                <p className="text-xs text-gray-500 mt-1">PNG, JPG or SVG (max 2MB)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Terminology</h3>
                <p className="text-sm text-gray-500 mb-4">Customize how entities are referred to in the system.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client Term</label>
                        <select
                            value={formData.clientTerm}
                            onChange={(e) => handleChange('clientTerm', e.target.value)}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                            <option value="Client">Client</option>
                            <option value="Beneficiary">Beneficiary</option>
                            <option value="Patient">Patient</option>
                            <option value="Refugee">Refugee</option>
                            <option value="Participant">Participant</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Worker Term</label>
                        <select
                            value={formData.workerTerm}
                            onChange={(e) => handleChange('workerTerm', e.target.value)}
                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        >
                            <option value="Worker">Worker</option>
                            <option value="Staff">Staff</option>
                            <option value="Counselor">Counselor</option>
                            <option value="Case Manager">Case Manager</option>
                            <option value="Volunteer">Volunteer</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Visit Term</label>
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
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default BrandingSettings;
