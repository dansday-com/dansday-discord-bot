// Frontend Control Panel Server
// Run this separately to always have control panel access, even when bot is stopped
// Usage: node main.js

import controlPanel from './frontend/index.js';

console.log('🎛️ Starting Control Panel Server...');
controlPanel.init().catch(err => {
    console.error('Failed to start control panel:', err);
    process.exit(1);
});

// Keep the process alive
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down control panel...');
    controlPanel.stop();
    process.exit(0);
});
