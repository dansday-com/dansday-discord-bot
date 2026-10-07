import type { ButtonsBlock, MessageDoc } from '$lib/messages.js';

export type Selection = { id: string; focus: string } | null;
export type PostedCopy = {
	id: number;
	guild_id: string;
	server_name: string | null;
	channel_id: string;
	channel_name: string;
	discord_message_id: string;
	language: string;
	created_at: string;
	outdated: boolean;
};
export type PartKind = 'attachment' | 'embed' | 'button' | 'select' | 'text' | 'section' | 'gallery' | 'separator' | 'container';

export type LocatedPart = {
	kind: PartKind;
	item: any;
	list: any[];
	index: number;
	sideways: boolean;
	row: { block: ButtonsBlock; list: any[] } | null;
};

export const PART_LABELS: Record<PartKind, { label: string; icon: string }> = {
	attachment: { label: 'Photo or video', icon: 'fa-photo-film' },
	embed: { label: 'Embed', icon: 'fa-window-maximize' },
	button: { label: 'Button', icon: 'fa-hand-pointer' },
	select: { label: 'Dropdown', icon: 'fa-list' },
	text: { label: 'Text', icon: 'fa-align-left' },
	section: { label: 'Text with image or button', icon: 'fa-table-columns' },
	gallery: { label: 'Images and videos', icon: 'fa-images' },
	separator: { label: 'Divider', icon: 'fa-minus' },
	container: { label: 'Box', icon: 'fa-square' }
};

function inRow(block: ButtonsBlock, list: any[], id: string): LocatedPart | null {
	const index = block.buttons.findIndex((button) => button.id === id);
	return index < 0 ? null : { kind: 'button', item: block.buttons[index], list: block.buttons, index, sideways: true, row: { block, list } };
}

function inBlocks(blocks: any[], id: string): LocatedPart | null {
	for (let index = 0; index < blocks.length; index++) {
		const block = blocks[index];
		if (block.id === id && block.type !== 'buttons') return { kind: block.type, item: block, list: blocks, index, sideways: false, row: null };
		if (block.type === 'buttons') {
			const found = inRow(block, blocks, id);
			if (found) return found;
		}
		if (block.type === 'container') {
			const found = inBlocks(block.blocks, id);
			if (found) return found;
		}
	}
	return null;
}

export function locatePart(doc: MessageDoc, id: string): LocatedPart | null {
	if (doc.layout === 'components') return inBlocks(doc.blocks, id);
	const attachment = doc.attachments.findIndex((item) => item.id === id);
	if (attachment >= 0) return { kind: 'attachment', item: doc.attachments[attachment], list: doc.attachments, index: attachment, sideways: true, row: null };
	const embed = doc.embeds.findIndex((item) => item.id === id);
	if (embed >= 0) return { kind: 'embed', item: doc.embeds[embed], list: doc.embeds, index: embed, sideways: false, row: null };
	return inBlocks(doc.rows, id);
}

export function removePart(part: LocatedPart) {
	part.list.splice(part.index, 1);
	if (part.row && part.row.block.buttons.length === 0) {
		const at = part.row.list.indexOf(part.row.block);
		if (at >= 0) part.row.list.splice(at, 1);
	}
}

export function containerOf(doc: MessageDoc, id: string): any | null {
	if (doc.layout !== 'components') return null;
	for (const block of doc.blocks) {
		if (block.type !== 'container') continue;
		if (block.id === id) return block;
		if (block.blocks.some((inner) => inner.id === id || (inner.type === 'buttons' && inner.buttons.some((button) => button.id === id)))) return block;
	}
	return null;
}
