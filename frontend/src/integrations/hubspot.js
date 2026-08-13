// hubspot.js

import { useState, useEffect } from 'react';
import {
    Box,
    Button,
    CircularProgress
} from '@mui/material';
import axios from 'axios';

export const HubSpotIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnectClick = async () => {
        try {
            setIsConnecting(true);

            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);

            const response = await axios.post(
                'http://localhost:8000/integrations/hubspot/authorize',
                formData
            );

            const authURL = response?.data;
            const newWindow = window.open(
                authURL,
                'HubSpot Authorization',
                'width=600,height=600'
            );

            if (!newWindow) {
                setIsConnecting(false);
                alert('Please allow pop-ups for localhost:3000 to connect HubSpot.');
                return;
            }

            const pollTimer = window.setInterval(() => {
                if (newWindow.closed) {
                    window.clearInterval(pollTimer);
                    handleWindowClosed();
                }
            }, 200);
        } catch (e) {
            setIsConnecting(false);
            alert(e?.response?.data?.detail || 'Unable to start HubSpot authorization.');
        }
    };

    const handleWindowClosed = async () => {
        try {
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);

            const response = await axios.post(
                'http://localhost:8000/integrations/hubspot/credentials',
                formData
            );

            const credentials = response.data;

            if (credentials) {
                setIsConnecting(false);
                setIsConnected(true);
                setIntegrationParams(prev => ({
                    ...prev,
                    credentials,
                    type: 'HubSpot'
                }));
            } else {
                setIsConnecting(false);
            }
        } catch (e) {
            setIsConnecting(false);
            alert(
                e?.response?.data?.detail ||
                'HubSpot authorization did not return credentials.'
            );
        }
    };

    useEffect(() => {
        setIsConnected(Boolean(integrationParams?.credentials));
    }, [integrationParams?.credentials]);

    return (
        <Box
            sx={{
                mt: 2,
                p: 3,
                backgroundColor: '#f8f9fa',
                borderRadius: 2,
                border: '1px solid #e9ecef'
            }}
        >
            <Box sx={{ mb: 2, fontWeight: 'bold', fontSize: '16px', color: '#495057' }}>
                HubSpot Integration
            </Box>

            <Box display="flex" alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
                <Button
                    variant="contained"
                    onClick={isConnected ? undefined : handleConnectClick}
                    color={isConnected ? 'success' : 'primary'}
                    disabled={isConnecting}
                    size="large"
                    sx={{
                        minWidth: 200,
                        pointerEvents: isConnected ? 'none' : 'auto',
                        cursor: isConnected ? 'default' : 'pointer',
                        opacity: isConnected ? 1 : undefined
                    }}
                >
                    {isConnected
                        ? 'HubSpot Connected'
                        : isConnecting
                            ? <CircularProgress size={20} />
                            : 'Connect to HubSpot'}
                </Button>
            </Box>
        </Box>
    );
};
