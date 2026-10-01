import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { translate } from '../../i18n.js';

export async function menuBackButton(guildId: string, userId: string, category: 'me' | 'community' | 'perks' | 'staff') {
	return new ButtonBuilder()
		.setCustomId(`menu_cat|${category}`)
		.setLabel(await translate('menu.back', guildId, userId))
		.setStyle(ButtonStyle.Secondary);
}
