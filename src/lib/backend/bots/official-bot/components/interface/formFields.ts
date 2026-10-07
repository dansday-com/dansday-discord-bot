import { CheckboxBuilder, FileUploadBuilder, LabelBuilder, RadioGroupBuilder, TextInputBuilder } from 'discord.js';

export function textField(label: string, input: TextInputBuilder) {
	return new LabelBuilder().setLabel(label.slice(0, 45)).setTextInputComponent(input);
}

export function checkboxField(label: string, customId: string, checked: boolean) {
	return new LabelBuilder().setLabel(label.slice(0, 45)).setCheckboxComponent(new CheckboxBuilder().setCustomId(customId).setDefault(checked));
}

export function checkboxValue(fields: any, customId: string, fallback: boolean): boolean {
	try {
		return fields.getCheckbox(customId) === true;
	} catch {
		return fallback;
	}
}

export function imageUploadField(label: string, customId: string, max: number) {
	return new LabelBuilder()
		.setLabel(label.slice(0, 45))
		.setFileUploadComponent(new FileUploadBuilder({ custom_id: customId, file_types: ['image'] }).setMinValues(0).setMaxValues(max).setRequired(false));
}

export function uploadedFiles(fields: any, customId: string): { attachment: string; name: string }[] {
	try {
		const files = fields.getUploadedFiles(customId);
		return files ? [...files.values()].map((a: any) => ({ attachment: a.url, name: a.name })) : [];
	} catch {
		return [];
	}
}

export function radioField(label: string, customId: string, options: { label: string; value: string }[]) {
	return new LabelBuilder().setLabel(label.slice(0, 45)).setRadioGroupComponent(new RadioGroupBuilder().setCustomId(customId).addOptions(options));
}

export function selectValue(fields: any, customId: string): string | null {
	try {
		return fields.getStringSelectValues(customId)?.[0] ?? null;
	} catch {
		return null;
	}
}

export function radioValue(fields: any, customId: string): string | null {
	try {
		return fields.getRadioGroup(customId) ?? null;
	} catch {
		return null;
	}
}

const UNIT_SECONDS = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 };

export type DurationPreset = [number, keyof typeof UNIT_SECONDS];

const presetSeconds = ([amount, unit]: DurationPreset) => amount * UNIT_SECONDS[unit];

export function durationField(label: string, customId: string, lang: string, presets: DurationPreset[]) {
	return radioField(
		label,
		customId,
		presets.map((p) => ({
			label: new Intl.NumberFormat(lang, { style: 'unit', unit: p[1], unitDisplay: 'long' }).format(p[0]),
			value: String(presetSeconds(p))
		}))
	);
}

export function durationValue(fields: any, customId: string, presets: DurationPreset[]): number | null {
	const picked = Number(radioValue(fields, customId));
	return presets.some((p) => presetSeconds(p) === picked) ? picked : null;
}
