import { useState } from 'react';
import {
    Box,
    TextField,
    Button,
} from '@mui/material';
import axios from 'axios';

const endpointMapping = {
    'Notion': 'notion',
    'Airtable': 'airtable',
    'HubSpot': 'hubspot',
};

export const DataForm = ({ integrationType, credentials }) => {
    const [loadedData, setLoadedData] = useState(null);
    const endpoint = endpointMapping[integrationType];

    const handleLoad = async () => {
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentials));

            const response = await axios.post(
                `http://localhost:8000/integrations/${endpoint}/load`,
                formData
            );

            setLoadedData(JSON.stringify(response.data, null, 2));
        } catch (e) {
            alert(e?.response?.data?.detail || 'Unable to load integration data.');
        }
    };

    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            flexDirection="column"
            width="100%"
            sx={{ px: 2 }}
        >
            <Box display="flex" flexDirection="column" width="100%" maxWidth="1200px">
                <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                    <TextField
                        label={`${integrationType} Data`}
                        value={loadedData || ''}
                        InputLabelProps={{ shrink: true }}
                        disabled
                        multiline
                        rows={15}
                        variant="outlined"
                        fullWidth
                        sx={{
                            '& .MuiInputBase-input': {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                lineHeight: 1.4,
                            },
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: '#ffffff',
                            }
                        }}
                    />
                </Box>

                <Box display="flex" gap={2} justifyContent="center">
                    <Button
                        onClick={handleLoad}
                        variant="contained"
                        size="large"
                        sx={{ minWidth: 120 }}
                    >
                        Load Data
                    </Button>

                    <Button
                        onClick={() => setLoadedData(null)}
                        variant="outlined"
                        size="large"
                        sx={{ minWidth: 120 }}
                    >
                        Clear Data
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};
