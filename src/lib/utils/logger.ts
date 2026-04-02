function buildPayload(level: string, message: string, meta?: object) {
	const payload: Record<string, unknown> = {
		level,
		message,
		time: new Date().toISOString()
	};
	if (meta && typeof meta === 'object') {
		payload.meta = meta;
	}
	return JSON.stringify(payload);
}

function info(message: string, meta?: object) {
	console.log(buildPayload('info', message, meta));
}

function debug(message: string, meta?: object) {
	console.log(buildPayload('debug', message, meta));
}

function warn(message: string, meta?: object) {
	console.warn(buildPayload('warn', message, meta));
}

function error(message: string, meta?: object) {
	console.error(buildPayload('error', message, meta));
}

function log(message: string, meta?: object) {
	info(message, meta);
}

function init(_client: unknown) {
	void _client;
}

export default { init, log, info, debug, warn, error };
