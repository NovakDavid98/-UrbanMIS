import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BrandingContext = createContext(null);

export const useBranding = () => {
    const context = useContext(BrandingContext);
    if (!context) {
        throw new Error('useBranding must be used within a BrandingProvider');
    }
    return context;
};

export const BrandingProvider = ({ children }) => {
    const [branding, setBranding] = useState({
        organization: {
            name: 'UrbanMIS',
            primaryColor: '#4F46E5',
            logo: null
        },
        terminology: {
            client: 'Client',
            worker: 'Worker',
            visit: 'Visit'
        },
        loaded: false
    });

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const response = await axios.get('/api/branding');
                setBranding({
                    organization: response.data.organization || branding.organization,
                    terminology: response.data.terminology || branding.terminology,
                    loaded: true
                });

                // Apply primary color as CSS variable
                if (response.data.organization?.primaryColor) {
                    document.documentElement.style.setProperty(
                        '--color-primary',
                        response.data.organization.primaryColor
                    );
                }
            } catch (error) {
                console.log('Using default branding');
                setBranding(prev => ({ ...prev, loaded: true }));
            }
        };

        fetchBranding();
    }, []);

    // Helper functions for terminology
    const t = (term) => {
        const map = {
            'client': branding.terminology.client,
            'clients': `${branding.terminology.client}s`,
            'worker': branding.terminology.worker,
            'workers': `${branding.terminology.worker}s`,
            'visit': branding.terminology.visit,
            'visits': `${branding.terminology.visit}s`,
        };
        return map[term.toLowerCase()] || term;
    };

    const updateBranding = async (updates) => {
        try {
            if (updates.organization) {
                await axios.put('/api/branding/organization', updates.organization, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
            }
            if (updates.terminology) {
                await axios.put('/api/branding/terminology', updates.terminology, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
            }

            // Refresh branding
            const response = await axios.get('/api/branding');
            setBranding({
                organization: response.data.organization,
                terminology: response.data.terminology,
                loaded: true
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    return (
        <BrandingContext.Provider value={{
            ...branding,
            t,
            updateBranding,
            orgName: branding.organization.name,
            primaryColor: branding.organization.primaryColor,
            logo: branding.organization.logo
        }}>
            {children}
        </BrandingContext.Provider>
    );
};

export default BrandingProvider;
