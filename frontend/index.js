import express from 'express';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { CONTROL_PANEL } from './config.js';
import logger from '../backend/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

let app = null;
let server = null;
let botProcess = null;

// Store process info
let processInfo = {
    pid: null,
    startTime: null,
    status: 'stopped', // 'running', 'stopped', 'starting', 'stopping'
    mode: null // 'both', 'selfbot', 'official'
};

// Password authentication middleware
function authenticate(req, res, next) {
    const password = req.headers.authorization || req.body.password || req.query.password;
    
    if (password === CONTROL_PANEL.PASSWORD) {
        req.authenticated = true;
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid password' });
    }
}

// Get bot status
async function getBotStatus() {
    const isRunning = botProcess && !botProcess.killed && botProcess.exitCode === null;
    
    // Also check if bot process is actually running (in case it was started externally)
    let actualRunning = isRunning;
    if (processInfo.pid && !isRunning) {
        try {
            // Try to check if process still exists (Unix/Linux only)
            process.kill(processInfo.pid, 0); // Signal 0 doesn't kill, just checks if process exists
            actualRunning = true;
        } catch (err) {
            // Process doesn't exist
            actualRunning = false;
            processInfo.pid = null;
            processInfo.startTime = null;
            processInfo.status = 'stopped';
        }
    }
    
    let uptime = null;
    if (processInfo.startTime && actualRunning) {
        uptime = Math.floor((Date.now() - processInfo.startTime) / 1000);
    }

    return {
        status: actualRunning ? 'running' : 'stopped',
        pid: processInfo.pid,
        startTime: processInfo.startTime,
        uptime: uptime,
        mode: processInfo.mode
    };
}

// Kill all bot processes (including child processes)
async function killAllBotProcesses() {
    return new Promise((resolve) => {
        // Find processes by matching backend.js, officialbot.js, or selfbot.js
        exec(`pgrep -f "node.*(backend|officialbot|selfbot)\\.js" || true`, (error, stdout, stderr) => {
            let allPids = stdout.trim().split('\n').filter(pid => pid && !isNaN(pid));
            
            // Filter to only actual bot processes (not control panel)
            const botPids = [];
            const checkPromises = allPids.map(pid => {
                return new Promise((resolveCheck) => {
                    const pidNum = parseInt(pid);
                    
                    // Skip control panel process
                    if (pidNum === process.pid) {
                        resolveCheck(false);
                        return;
                    }
                    
                    // Check the process command line
                    try {
                        const cmdline = readFileSync(`/proc/${pidNum}/cmdline`, 'utf8').replace(/\0/g, ' ');
                        // Must include backend.js or officialbot.js or selfbot.js but NOT frontend.js
                        if ((cmdline.includes('backend.js') || cmdline.includes('officialbot.js') || cmdline.includes('selfbot.js')) && !cmdline.includes('frontend.js')) {
                            botPids.push(pidNum);
                            resolveCheck(true);
                        } else {
                            resolveCheck(false);
                        }
                    } catch (e) {
                        // Process might not exist or no permission - skip it
                        resolveCheck(false);
                    }
                });
            });
            
            Promise.all(checkPromises).then(() => {
                if (botPids.length === 0) {
                    resolve([]);
                    return;
                }

                console.log(`Found ${botPids.length} bot process(es) to kill: ${botPids.join(', ')}`);

                // Kill all found processes - use kill command for better reliability
                const killPromises = botPids.map(pid => {
                    return new Promise((resolveKill) => {
                        // Use kill command directly for more reliability
                        exec(`kill -INT ${pid} 2>/dev/null || kill -KILL ${pid} 2>/dev/null || true`, (killErr) => {
                            // Also try via process.kill as backup
                            try {
                                process.kill(pid, 'SIGINT');
                            } catch (e) {
                                // Ignore errors
                            }
                            
                            // Wait a moment, then force kill if still alive
                            setTimeout(() => {
                                try {
                                    // Check if still running
                                    process.kill(pid, 0); // Signal 0 checks if process exists
                                    // Still running, force kill
                                    exec(`kill -KILL ${pid} 2>/dev/null || true`);
                                    try {
                                        process.kill(pid, 'SIGKILL');
                                    } catch (e) {
                                        // Process might be dead now
                                    }
                                } catch (e) {
                                    // Process is dead
                                }
                                resolveKill();
                            }, 1500);
                        });
                    });
                });

                Promise.all(killPromises).then(() => {
                    // Verify all are dead
                    setTimeout(() => {
                        const stillAlive = [];
                        botPids.forEach(pid => {
                            try {
                                process.kill(pid, 0); // Check if still exists
                                stillAlive.push(pid);
                            } catch (e) {
                                // Process is dead, good
                            }
                        });
                        
                        if (stillAlive.length > 0) {
                            console.log(`Warning: Some processes still alive, force killing: ${stillAlive.join(', ')}`);
                            stillAlive.forEach(pid => {
                                exec(`kill -KILL ${pid} 2>/dev/null || true`);
                            });
                        }
                        
                        resolve(botPids);
                    }, 500);
                });
            });
        });
    });
}

// Start the bot
async function startBot(mode = 'both') {
    // Check if already running by checking process
    if (botProcess && !botProcess.killed && botProcess.exitCode === null) {
        return { success: false, error: 'Bot is already running' };
    }

    // Also check if any bot processes are running
    return new Promise((resolve) => {
        const mainScriptPath = join(projectRoot, 'main.js');
        // Find all node processes
        exec(`pgrep -f "node" || true`, (error, stdout) => {
            const allPids = stdout.trim().split('\n').filter(pid => pid && !isNaN(pid));
            
            // Filter to only bot processes (main.js, not controlpanel-server)
            const botPids = [];
            const checkPromises = allPids.map(pid => {
                return new Promise((resolveCheck) => {
                    const pidNum = parseInt(pid);
                    
                    // Skip control panel process
                    if (pidNum === process.pid) {
                        resolveCheck(false);
                        return;
                    }
                    
                    // Check the process command line
                    try {
                        const cmdline = readFileSync(`/proc/${pidNum}/cmdline`, 'utf8').replace(/\0/g, ' ');
                        // Must include main.js but NOT controlpanel-server
                        if (cmdline.includes(mainScriptPath) && !cmdline.includes('controlpanel-server')) {
                            botPids.push(pidNum);
                            resolveCheck(true);
                        } else {
                            resolveCheck(false);
                        }
                    } catch (e) {
                        // Process doesn't exist or no permission - assume it's not a bot
                        resolveCheck(false);
                    }
                });
            });
            
            Promise.all(checkPromises).then(() => {
                if (botPids.length > 0) {
                    resolve({ success: false, error: `Bot processes are already running (PIDs: ${botPids.join(', ')}). Stop them first.` });
                    return;
                }
                
                // No bot processes running, continue with start
                processInfo.status = 'starting';
                processInfo.mode = mode;

                try {
                    const backendScript = join(projectRoot, 'backend.js');
                    botProcess = spawn('node', [backendScript, mode], {
                        cwd: projectRoot,
                        stdio: ['ignore', 'pipe', 'pipe'],
                        shell: true,
                        detached: false // Keep in same process group
                    });

                    processInfo.pid = botProcess.pid;
                    processInfo.startTime = Date.now();
                    processInfo.status = 'running';

                    // Handle output
                    botProcess.stdout.on('data', (data) => {
                        const output = data.toString();
                        console.log(`[Bot] ${output}`);
                    });

                    botProcess.stderr.on('data', (data) => {
                        const output = data.toString();
                        console.error(`[Bot Error] ${output}`);
                    });

                    // Handle process exit
                    botProcess.on('exit', (code, signal) => {
                        processInfo.status = 'stopped';
                        processInfo.pid = null;
                        processInfo.startTime = null;
                        botProcess = null;
                        logger.log(`Bot process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
                    });

                    botProcess.on('error', (err) => {
                        processInfo.status = 'stopped';
                        processInfo.pid = null;
                        processInfo.startTime = null;
                        botProcess = null;
                        logger.log(`Failed to start bot: ${err.message}`);
                    });

                    resolve({ success: true, pid: botProcess.pid });
                } catch (error) {
                    processInfo.status = 'stopped';
                    resolve({ success: false, error: error.message });
                }
            });
        });
    });
}

// Stop the bot
async function stopBot() {
    // Check if there's anything to stop
    const hadProcess = botProcess || processInfo.pid;
    
    if (!hadProcess) {
        // Also check if any bot processes are actually running
        const testKill = await killAllBotProcesses();
        if (testKill.length === 0) {
            return { success: false, error: 'Bot is not running' };
        }
        return { success: true, killed: testKill.length };
    }

    processInfo.status = 'stopping';

    // First, try to kill the tracked process
    if (botProcess && !botProcess.killed && botProcess.exitCode === null) {
        try {
            botProcess.kill('SIGINT');
        } catch (err) {
            // Process might already be dead
        }
    }

    // Kill all bot processes (including child processes)
    const killedPids = await killAllBotProcesses();
    
    // Clean up
    botProcess = null;
    processInfo.status = 'stopped';
    processInfo.pid = null;
    processInfo.startTime = null;

    if (killedPids.length > 0) {
        logger.log(`Stopped ${killedPids.length} bot process(es): ${killedPids.join(', ')}`);
        return { success: true, killed: killedPids.length };
    } else {
        return { success: true, message: 'No running processes found' };
    }
}

// Restart the bot
async function restartBot(mode = 'both') {
    const currentMode = processInfo.mode || mode;
    
    // Stop first and wait for it to complete
    const stopResult = await stopBot();
    
    if (!stopResult.success && stopResult.error !== 'Bot is not running') {
        return { success: false, error: `Failed to stop: ${stopResult.error}` };
    }
    
    // Wait a moment for all processes to fully stop
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Now start
    const startResult = await startBot(currentMode);
    return startResult;
}

// Initialize control panel
export function init() {
    if (!CONTROL_PANEL.ENABLED) {
        logger.log('Control panel is disabled in config');
        return;
    }

    app = express();
    app.use(express.json());
    app.use(express.static(__dirname));

    // API Routes
    // Status endpoint (no auth needed for basic status)
    app.get('/api/status', async (req, res) => {
        const status = await getBotStatus();
        res.json(status);
    });

    // Control endpoints (require authentication)
    app.post('/api/start', authenticate, async (req, res) => {
        const mode = req.body.mode || 'both';
        const result = await startBot(mode);
        res.json(result);
    });

    app.post('/api/stop', authenticate, async (req, res) => {
        const result = await stopBot();
        res.json(result);
    });

    app.post('/api/restart', authenticate, async (req, res) => {
        const mode = req.body.mode || 'both';
        const result = await restartBot(mode);
        res.json(result);
    });

    // Serve the control panel HTML
    app.get('/', (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });

    // Start server
    const port = CONTROL_PANEL.PORT;
    server = app.listen(port, '0.0.0.0', () => {
        logger.log(`🎛️ Control panel started on http://0.0.0.0:${port}`);
        logger.log(`📱 Access the control panel at http://localhost:${port}`);
        logger.log(`🔒 Password: ${CONTROL_PANEL.PASSWORD}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.log(`❌ Port ${port} is already in use. Control panel cannot start.`);
        } else {
            logger.log(`❌ Control panel error: ${err.message}`);
        }
    });
}

// Stop control panel
export function stop() {
    if (server) {
        server.close();
        server = null;
        logger.log('🛑 Control panel stopped');
    }
}

export default { init, stop };
