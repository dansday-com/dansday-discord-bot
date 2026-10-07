import { CheckboxBuilder, FileUploadBuilder, LabelBuilder, TextInputBuilder } from 'discord.js';

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
