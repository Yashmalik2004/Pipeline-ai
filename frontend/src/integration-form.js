import { useState } from 'react';
import {
    Box,
    Autocomplete,
    TextField,
} from '@mui/material';
import { AirtableIntegration } from './integrations/airtable';
import { NotionIntegration } from './integrations/notion';
import { HubSpotIntegration } from './integrations/hubspot';
import { DataForm } from './data-form';

const integrationMapping = {
    'Notion': NotionIntegration,
    'Airtable': AirtableIntegration,
    'HubSpot': HubSpotIntegration,
};

export const IntegrationForm = () => {
    const [integrationParams, setIntegrationParams] = useState({});
    const [user, setUser] = useState('');
    const [org, setOrg] = useState('');
    const [currType, setCurrType] = useState(null);
    const CurrIntegration = integrationMapping[currType];

    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            flexDirection="column"
            sx={{ width: '100%', px: 2, pt: 4 }}
        >
            {/* Input fields — the actual data source for user and org */}
            <Box width="100%" maxWidth="560px" sx={{ mb: 3 }}>
                <TextField
                    label="User"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    sx={{ mb: 2 }}
                    fullWidth
                />
                <TextField
                    label="Organization"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    sx={{ mb: 2 }}
                    fullWidth
                />
                <Autocomplete
                    id="integration-type"
                    options={Object.keys(integrationMapping)}
                    sx={{ width: '100%' }}
                    renderInput={(params) => (
                        <TextField {...params} label="Integration Type" />
                    )}
                    onChange={(e, value) => setCurrType(value)}
                />
            </Box>

            {/* Summary table — reads live from the same state as the inputs above */}
            <div className="integration-info-table-wrapper">
                <table className="integration-info-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Organization</th>
                            <th>Integration Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{user || '—'}</td>
                            <td>{org || '—'}</td>
                            <td>{currType || '—'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {currType && CurrIntegration && (
                <Box width="100%" maxWidth="1200px">
                    <CurrIntegration
                        user={user}
                        org={org}
                        integrationParams={integrationParams}
                        setIntegrationParams={setIntegrationParams}
                    />
                </Box>
            )}

            {integrationParams?.credentials && (
                <Box sx={{ mt: 3, width: '100%' }}>
                    <DataForm
                        integrationType={integrationParams.type}
                        credentials={integrationParams.credentials}
                    />
                </Box>
            )}
        </Box>
    );
};
