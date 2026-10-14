import '../console-instrumentation.js';
import { redirect, type Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getSession, getSessionIdFromCookie, type SessionData } from '$lib/utils/index.js';
import db, { initializeDatabase } from '$lib/database.js';
import { runsBotsInProcess } from '$lib/botControl.js';
import { startRunner } from '$lib/botProcesses.js';
import { startDemoSessionExpiryListener } from '$lib/backend/demo/demoSessionExpiry.js';
import { guardApiRoute } from '$lib/backend/panelServer.js';
import { apexHome, isPublicServerSubpath, publicServerSlugFromHost, publicSiteOrigin } from '$lib/url.js';
import { HTTP } from '$lib/http.js';

export const init = async () => {
	if (!building) {
		await initializeDatabase();
		if (runsBotsInProcess()) {
			startRunner();
		}
	}
	await startDemoSessionExpiryListener();
};

function detectDevice(ua: string): string {
	const v = ua.toLowerCase();
	if (!v) {
		return 'unknown';
	}
	if (/(bot|crawler|spider)/i.test(v)) {
		return 'bot';
	}
	if (/(ipad|tablet)/i.test(v)) {
		return 'tablet';
	}
	if (/(mobi|iphone|android)/i.test(v)) {
		return 'mobile';
	}
	return 'desktop';
}

function detectBrowser(ua: string): string {
	if (!ua) {
		return 'unknown';
	}
	if (/Edg\//.test(ua)) {
		return 'edge';
	}
	if (/OPR\//.test(ua) || /Opera/.test(ua)) {
		return 'opera';
	}
	if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) {
		return 'chrome';
	}
	if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
		return 'safari';
	}
	if (/Firefox\//.test(ua)) {
		return 'firefox';
	}
	return 'unknown';
}

function detectOs(ua: string): string {
	if (!ua) {
		return 'unknown';
	}
	if (/Windows NT/.test(ua)) {
		return 'windows';
	}
	if (/Android/.test(ua)) {
		return 'android';
	}
	if (/(iPhone|iPad|iPod)/.test(ua)) {
		return 'ios';
	}
	if (/Mac OS X/.test(ua)) {
		return 'macos';
	}
	if (/Linux/.test(ua)) {
		return 'linux';
	}
	return 'unknown';
}

function isFileLikePath(pathname: string): boolean {
	const last = pathname.slice(pathname.lastIndexOf('/') + 1);
	return last.includes('.') || pathname.startsWith('/.well-known/');
}

type LocalsUser = App.Locals['user'];

const ANONYMOUS_USER: LocalsUser = { authenticated: false, can_register: false };

async function anonymousUser(): Promise<LocalsUser> {
	return { authenticated: false, can_register: !(await db.hasAnyPanel()) };
}

async function serverAccountUser(session: SessionData & { account_id: number }): Promise<LocalsUser | null> {
	const account = await db.getServerAccountById(session.account_id);
	if (!account || account.is_frozen) {
		return null;
	}
	const server = await db.getServer(account.server_id);
	const panelBotId = await db.resolveOfficialBotIdForServer(server);
	return {
		authenticated: true,
		account_id: account.id,
		username: account.username,
		email: account.email,
		account_type: account.account_type,
		account_source: 'server_accounts',
		bot_id: panelBotId ?? 0,
		server_id: account.server_id,
		is_demo: session.is_demo === true,
		session_expires_at: session.expires_at
	};
}

async function panelAccountUser(session: SessionData & { account_id: number }): Promise<LocalsUser | null> {
	const account = await db.getAccountById(session.account_id);
	if (!account) {
		return null;
	}
	const accountPanel = await db.getPanel(account.id);
	return {
		authenticated: true,
		account_id: account.id,
		username: account.username,
		email: account.email,
		account_type: account.account_type,
		account_source: 'accounts',
		panel_id: accountPanel?.id ?? null,
		is_demo: session.is_demo === true,
		session_expires_at: session.expires_at
	};
}

async function sessionUser(sessionId: string): Promise<LocalsUser> {
	const session = await getSession(sessionId);
	if (!session) {
		return anonymousUser();
	}
	const accountId = session.account_id;
	if (!session.authenticated || !accountId) {
		return ANONYMOUS_USER;
	}
	const scoped = { ...session, account_id: accountId };
	const user = session.account_source === 'server_accounts' ? await serverAccountUser(scoped) : await panelAccountUser(scoped);
	return user ?? ANONYMOUS_USER;
}

async function resolveLocalsUser(sessionId: string | null): Promise<LocalsUser> {
	try {
		return sessionId ? await sessionUser(sessionId) : await anonymousUser();
	} catch (_) {
		return ANONYMOUS_USER;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();

	if (event.url.hostname.startsWith('www.')) {
		redirect(HTTP.MOVED_PERMANENTLY, publicSiteOrigin() + event.url.pathname + event.url.search);
	}

	if (
		publicServerSlugFromHost(event.url.hostname) &&
		!event.url.pathname.startsWith('/api/') &&
		!isFileLikePath(event.url.pathname) &&
		!isPublicServerSubpath(event.url.pathname)
	) {
		redirect(HTTP.FOUND, publicSiteOrigin() + event.url.pathname + event.url.search);
	}

	const cookieHeader = event.request.headers.get('cookie');
	const sessionId = getSessionIdFromCookie(cookieHeader);
	event.locals.sessionId = sessionId;

	event.locals.user = await resolveLocalsUser(sessionId);

	const guardResponse = await guardApiRoute(event.locals, event.url.pathname);
	if (guardResponse) {
		return guardResponse;
	}

	const response = await resolve(event, {
		preload: ({ type }) => type === 'css' || type === 'font'
	});

	if (event.url.pathname !== '/' && !event.url.pathname.startsWith('/api/') && !isFileLikePath(event.url.pathname)) {
		const contentType = response.headers.get('content-type') ?? '';
		const accept = event.request.headers.get('accept') ?? '';
		const secDest = event.request.headers.get('sec-fetch-dest');
		const secMode = event.request.headers.get('sec-fetch-mode');
		const doesLookLikePageNavigation = secDest === 'document' || (secMode === 'navigate' && event.request.method === 'GET');
		const isWantsHtml = doesLookLikePageNavigation || accept.includes('text/html') || contentType.includes('text/html');

		if (isWantsHtml && response.status === HTTP.NOT_FOUND) {
			return new Response(null, {
				status: HTTP.FOUND,
				headers: { Location: publicServerSlugFromHost(event.url.hostname) ? apexHome() : '/' }
			});
		}
	}

	const { headers } = event.request;
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

	return response;
};
