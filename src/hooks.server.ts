import '../console-instrumentation.js';
import type { Handle } from '@sveltejs/kit';
import { getSession, getSessionIdFromCookie } from '$lib/server/session';
import db from '$lib/server/db';
import { verifyBotStatuses } from '$lib/server/botProcesses';

export const init = async () => {
	await verifyBotStatuses();
};

function detectDevice(ua: string): string {
	const v = ua.toLowerCase();
	if (!v) return 'unknown';
	if (/(bot|crawler|spider)/i.test(v)) return 'bot';
	if (/(ipad|tablet)/i.test(v)) return 'tablet';
	if (/(mobi|iphone|android)/i.test(v)) return 'mobile';
	return 'desktop';
}

function detectBrowser(ua: string): string {
	if (!ua) return 'unknown';
	if (/Edg\//.test(ua)) return 'edge';
	if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'opera';
	if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) return 'chrome';
	if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
	if (/Firefox\//.test(ua)) return 'firefox';
	return 'unknown';
}

function detectOs(ua: string): string {
	if (!ua) return 'unknown';
	if (/Windows NT/.test(ua)) return 'windows';
	if (/Android/.test(ua)) return 'android';
	if (/(iPhone|iPad|iPod)/.test(ua)) return 'ios';
	if (/Mac OS X/.test(ua)) return 'macos';
	if (/Linux/.test(ua)) return 'linux';
	return 'unknown';
}

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();

	const cookieHeader = event.request.headers.get('cookie');
	const sessionId = getSessionIdFromCookie(cookieHeader);
	event.locals.sessionId = sessionId;

	event.locals.user = { authenticated: false, can_register: false };

	if (sessionId) {
		try {
			const session = await getSession(sessionId);
			if (session?.authenticated && session.account_id) {
				if (session.account_source === 'server_accounts') {
					const account = await db.getServerAccountById(session.account_id);
					if (account && !account.is_frozen) {
						const server = await db.getServer(account.server_id);
						event.locals.user = {
							authenticated: true,
							account_id: account.id,
							username: account.username,
							email: account.email,
							account_type: account.account_type,
							account_source: 'server_accounts',
							bot_id: server?.bot_id ?? 0,
							server_id: account.server_id
						};
					}
				} else {
					const account = await db.getAccountById(session.account_id);
					if (account) {
						event.locals.user = {
							authenticated: true,
							account_id: account.id,
							username: account.username,
							email: account.email,
							account_type: account.account_type,
							account_source: 'accounts'
						};
					}
				}
			} else if (!session) {
				const panel = await db.getPanel();
				event.locals.user = { authenticated: false, can_register: !panel };
			}
		} catch (_) {
			event.locals.user = { authenticated: false, can_register: false };
		}
	} else {
		try {
			const panel = await db.getPanel();
			event.locals.user = { authenticated: false, can_register: !panel };
		} catch (_) {
			event.locals.user = { authenticated: false, can_register: false };
		}
	}

	const response = await resolve(event, {
		preload: ({ type }) => type === 'js' || type === 'css' || type === 'font'
	});

	const headers = event.request.headers;
	const ua = headers.get('user-agent') ?? '';
	const rawIp =
		headers.get('cf-connecting-ip') || headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || event.getClientAddress();
	const isSuperadmin = event.locals.user.authenticated && event.locals.user.account_source === 'accounts';
	const ip = isSuperadmin ? rawIp : undefined;

	console.info(
		JSON.stringify({
			level: 'info',
			message: '[request]',
			...(ip !== undefined ? { ip } : {}),
			device: detectDevice(ua),
			browser: detectBrowser(ua),
			os: detectOs(ua),
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			duration_ms: Date.now() - start
		})
	);

	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('text/html') || contentType.includes('application/json')) {
		response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
	}

	return response;
};
