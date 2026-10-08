import { startRunner } from '../../botProcesses.js';
import { skipDatabaseSetup } from '../../database.js';
import { logger } from '../../utils/index.js';

skipDatabaseSetup();

startRunner().catch((err: Error) => {
	logger.error('Bot runner failed to start', { error: String(err?.message || err) });
	process.exit(1);
});
