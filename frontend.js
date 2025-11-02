// Frontend Control Panel Server
// Run this separately to always have control panel access, even when bot is stopped
// Usage: node frontend.js

import controlPanel from './frontend/index.js';

console.log('🎛️ Starting Control Panel Server...');
controlPanel.init();

// Keep the process alive
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down control panel...');
    controlPanel.stop();
    process.exit(0);
});



