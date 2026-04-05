import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { publicServerOverviewUrl, publicWebLeaderboardUrl } from '../publicSiteUrls.js';

export function actionRowWebStatisticsLink(publicServerSlug: string, label: string): ActionRowBuilder | null {
	const url = publicServerOverviewUrl(publicServerSlug);
	if (!url) return null;
	return new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link));
}

export function actionRowWebLeaderboardLink(publicServerSlug: string, label: string): ActionRowBuilder | null {
	const url = publicWebLeaderboardUrl(publicServerSlug);
	if (!url) return null;
	return new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link));
}
