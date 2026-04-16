import { normalizeMainConfigForPanel } from './mainConfigSettings.js';

const MAIN = 'Configuration → Main';

export function collectMainAppearanceIssues(mainSettingsRaw: unknown): string[] {
	const { color, footer } = normalizeMainConfigForPanel(mainSettingsRaw);
	const issues: string[] = [];
	const colorOk = color.replace(/#/g, '').trim().length > 0;
	if (!colorOk) {
		issues.push(`Set a default embed color under ${MAIN} (bot appearance).`);
	}
	const footerOk = footer.trim().length > 0;
	if (!footerOk) {
		issues.push(`Set a default embed footer under ${MAIN} (bot appearance).`);
	}
	return issues;
}

export function mainAppearanceBlockingMessage(mainSettingsRaw: unknown): string | null {
	const issues = collectMainAppearanceIssues(mainSettingsRaw);
	if (issues.length === 0) return null;
	if (issues.length === 1) return issues[0];
	return `Complete bot appearance under ${MAIN}: set default embed color and footer.`;
}

export function humanizeConfigPrerequisiteMessage(source: string | undefined | null): string {
	if (source == null || source === '') return '';
	const t = source.trim();
	if (/default footer not configured/i.test(t)) {
		return `Set a default embed footer under ${MAIN} (bot appearance).`;
	}
	if (/default color not configured/i.test(t)) {
		return `Set a default embed color under ${MAIN} (bot appearance).`;
	}
	if (/permissions not configured/i.test(t)) {
		return 'Configure role permissions under Configuration → Permissions.';
	}
	if (/leveling settings not configured/i.test(t)) {
		return 'Configure leveling under Configuration → Leveling.';
	}
	if (/server settings not found for guild/i.test(t)) {
		return `Save your server settings under ${MAIN} first.`;
	}
	if (/guild not found/i.test(t)) {
		return 'Bot could not find this Discord server. Check that the bot is in the server and try again.';
	}
	if (/channel not found or not text-based/i.test(t)) {
		return 'Pick a valid text channel the bot can post in.';
	}
	return '';
}

export function messageFromBotWebhookPayload(body: unknown): string {
	if (!body || typeof body !== 'object') {
		return 'Request failed. Check that the bot is running and try again.';
	}
	const b = body as Record<string, unknown>;
	const err = typeof b.error === 'string' ? b.error.trim() : '';
	const det = typeof b.details === 'string' ? b.details.trim() : '';
	const humanDet = humanizeConfigPrerequisiteMessage(det);
	const humanErr = humanizeConfigPrerequisiteMessage(err);
	if (humanDet) return humanDet;
	if (humanErr) return humanErr;
	if (det && err) return `${err}: ${det}`;
	if (det) return det;
	if (err) return err;
	return 'Request failed. Check that the bot is running and try again.';
}
