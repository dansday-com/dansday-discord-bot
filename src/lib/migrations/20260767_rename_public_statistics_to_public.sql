UPDATE server_settings SET component_name = 'public' WHERE component_name = 'public_statistics';

UPDATE server_panel_logs SET action = 'public' WHERE action = 'public_statistics';
