import dotenv from 'dotenv';

dotenv.config();

export const CONTROL_PANEL = {
    PORT: parseInt(process.env.CONTROL_PANEL_PORT)
};

if (!CONTROL_PANEL.PORT || isNaN(CONTROL_PANEL.PORT)) {
    throw new Error('Missing or invalid CONTROL_PANEL_PORT environment variable');
}