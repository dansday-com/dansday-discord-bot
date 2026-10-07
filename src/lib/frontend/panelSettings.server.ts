import db from '$lib/database.js';
import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';

async function questSettings(panelId: number): Promise<Record<string, unknown>> {
	const row = await db.getPanelSettings(panelId, SERVER_SETTINGS.component.discord_quest_notifier).catch(() => null);
	const raw = row?.settings;
	return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export async function getAutoQuest(panelId: number): Promise<boolean> {
	return (await questSettings(panelId)).auto_quest === true;
}

export async function setAutoQuest(panelId: number, enabled: boolean): Promise<void> {
	await db.upsertPanelSettings(panelId, SERVER_SETTINGS.component.discord_quest_notifier, { ...(await questSettings(panelId)), auto_quest: enabled });
}
