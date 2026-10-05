import { LabelBuilder, StringSelectMenuBuilder, TextInputBuilder } from 'discord.js';
import type { Translator } from '../../i18n.js';

export function textField(label: string, input: TextInputBuilder) {
	return new LabelBuilder().setLabel(label.slice(0, 45)).setTextInputComponent(input);
}

export function yesNoField(tr: Translator, label: string, customId: string, defaultYes: boolean) {
	return new LabelBuilder()
		.setLabel(label.slice(0, 45))
		.setStringSelectMenuComponent(
			new StringSelectMenuBuilder()
				.setCustomId(customId)
				.addOptions({ label: tr('common.yes'), value: 'yes', default: defaultYes }, { label: tr('common.no'), value: 'no', default: !defaultYes })
		);
}

export function yesNoValue(fields: any, customId: string, fallback: boolean): boolean {
	try {
		const [value] = fields.getStringSelectValues(customId);
		return value ? value === 'yes' : fallback;
	} catch {
		return fallback;
	}
}
