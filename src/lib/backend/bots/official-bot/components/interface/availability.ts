import {
	CONTENT_CREATOR,
	FEEDBACK,
	GIVEAWAY,
	NOTIFICATIONS,
	PERMISSIONS,
	STAFF_RATING,
	isComponentFeatureEnabled,
	serverSettingsComponent
} from '../../../../config.js';

const READY: Record<string, (guildId: string) => Promise<boolean>> = {
	[serverSettingsComponent.giveaway]: async (guildId) => !!(await GIVEAWAY.getChannel(guildId)),
	[serverSettingsComponent.feedback]: async (guildId) => !!(await FEEDBACK.getChannel(guildId)),
	[serverSettingsComponent.notifications]: async (guildId) => (await NOTIFICATIONS.getNotificationChannels(guildId)).length > 0,
	[serverSettingsComponent.staff_rating]: async (guildId) =>
		!!(await STAFF_RATING.getConfig(guildId)) && ((await PERMISSIONS.getPermissions(guildId))?.STAFF_ROLES?.filter(Boolean).length ?? 0) > 0,
	[serverSettingsComponent.content_creator]: async (guildId) =>
		!!(await CONTENT_CREATOR.getAdmissionChannel(guildId)) && !!(await CONTENT_CREATOR.getContentCreatorRole(guildId))
};

export async function featureAvailable(guildId: string, feature: string): Promise<boolean> {
	try {
		if (!(await isComponentFeatureEnabled(guildId, feature))) return false;
		const ready = READY[feature];
		return ready ? await ready(guildId) : true;
	} catch {
		return false;
	}
}
