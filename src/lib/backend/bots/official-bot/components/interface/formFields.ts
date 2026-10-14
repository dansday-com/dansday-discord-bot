import { CheckboxBuilder, FileUploadBuilder, LabelBuilder, RadioGroupBuilder, TextInputBuilder } from 'discord.js';
import { DAYS_PER_WEEK, DAY_SECONDS, HOUR_SECONDS, MINUTE_SECONDS } from '../../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../../discordLimits.js';

type CheckboxFields = { getCheckbox(customId: string): unknown };
type RadioFields = { getRadioGroup(customId: string): unknown };
type SelectFields = { getStringSelectValues(customId: string): readonly string[] };
type UploadFields = { getUploadedFiles(customId: string): { values(): Iterable<{ url: string; name: string }> } | null };

export function textField(label: string, input: TextInputBuilder) {
	return new LabelBuilder().setLabel(label.slice(0, DISCORD_LIMITS.LABEL)).setTextInputComponent(input);
}

export function checkboxField(label: string, customId: string, isChecked: boolean) {
	return new LabelBuilder()
		.setLabel(label.slice(0, DISCORD_LIMITS.LABEL))
		.setCheckboxComponent(new CheckboxBuilder().setCustomId(customId).setDefault(isChecked));
}

export function checkboxValue(fields: CheckboxFields, customId: string, isFallbackChecked: boolean): boolean {
	try {
		return fields.getCheckbox(customId) === true;
	} catch {
		return isFallbackChecked;
	}
}

export function imageUploadField(label: string, customId: string, max: number) {
	return new LabelBuilder()
		.setLabel(label.slice(0, DISCORD_LIMITS.LABEL))
		.setFileUploadComponent(new FileUploadBuilder({ custom_id: customId, file_types: ['image'] }).setMinValues(0).setMaxValues(max).setRequired(false));
}

export function uploadedFiles(fields: UploadFields, customId: string): { attachment: string; name: string }[] {
	try {
		const files = fields.getUploadedFiles(customId);
		return files ? [...files.values()].map((a) => ({ attachment: a.url, name: a.name })) : [];
	} catch {
		return [];
	}
}

export function radioField(label: string, customId: string, options: { label: string; value: string }[]) {
	return new LabelBuilder()
		.setLabel(label.slice(0, DISCORD_LIMITS.LABEL))
		.setRadioGroupComponent(new RadioGroupBuilder().setCustomId(customId).addOptions(options));
}

export function selectValue(fields: SelectFields, customId: string): string | null {
	try {
		return fields.getStringSelectValues(customId)?.[0] ?? null;
	} catch {
		return null;
	}
}

export function radioValue(fields: RadioFields, customId: string): string | null {
	try {
		const value = fields.getRadioGroup(customId);
		return typeof value === 'string' ? value : null;
	} catch {
		return null;
	}
}

const UNIT_SECONDS = { second: 1, minute: MINUTE_SECONDS, hour: HOUR_SECONDS, day: DAY_SECONDS, week: DAYS_PER_WEEK * DAY_SECONDS };

export type DurationPreset = { amount: number; unit: keyof typeof UNIT_SECONDS };

const presetSeconds = ({ amount, unit }: DurationPreset) => amount * UNIT_SECONDS[unit];

type DurationChoices = { lang: string; presets: DurationPreset[] };

export function durationField(label: string, customId: string, { lang, presets }: DurationChoices) {
	return radioField(
		label,
		customId,
		presets.map((p) => ({
			label: new Intl.NumberFormat(lang, { style: 'unit', unit: p.unit, unitDisplay: 'long' }).format(p.amount),
			value: String(presetSeconds(p))
		}))
	);
}

export function durationValue(fields: RadioFields, customId: string, presets: DurationPreset[]): number | null {
	const picked = Number(radioValue(fields, customId));
	return presets.some((p) => presetSeconds(p) === picked) ? picked : null;
}
