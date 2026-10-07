import { DEFAULT_SERVER_LANGUAGE, SERVER_LANGUAGE_CODES, isServerLanguage, serverLanguageLabel, type ServerLanguage } from './languages.js';

export const MESSAGE_UPLOAD_ROOTS = { server: 'server-messages', global: 'global-messages' } as const;
export const MESSAGE_CUSTOM_ID_PREFIXES = { server: 'msg', global: 'gmsg' } as const;
export const MESSAGE_SCOPES = ['server', 'global'] as const;
export const MESSAGE_LANGUAGE_PART = '@lang';
export const MESSAGE_LANGUAGE_EMOJI = '\u{1F310}';
export const MAX_SAVED_MESSAGES = 100;

export const MESSAGE_LIMITS = {
	name: 100,
	text: 2000,
	attachments: 10,
	embeds: 10,
	title: 256,
	description: 4096,
	fields: 25,
	fieldName: 256,
	fieldValue: 1024,
	footer: 2048,
	author: 256,
	embedTotal: 6000,
	rows: 5,
	buttons: 5,
	options: 25,
	label: 80,
	placeholder: 150,
	optionLabel: 100,
	optionDescription: 100,
	url: 512,
	image: 2000,
	emoji: 64,
	actions: 5,
	blocks: 25,
	innerBlocks: 20,
	components: 40,
	blockText: 4000,
	galleryItems: 10,
	caption: 1024
} as const;

export const MESSAGE_IMAGE_EXTENSIONS = ['png', 'jpg', 'gif', 'webp'] as const;
export const MESSAGE_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'] as const;
export const MESSAGE_VIDEO_TYPES: Record<string, (typeof MESSAGE_VIDEO_EXTENSIONS)[number]> = {
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov'
};
export const MESSAGE_VIDEO_ACCEPT = Object.keys(MESSAGE_VIDEO_TYPES).join(',');
export const MESSAGE_VIDEO_FORMATS_LABEL = 'MP4, WEBM, MOV';
export const MESSAGE_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

const MB = 1024 * 1024;

const UNSAFE_ROLE_PERMISSION_BITS = {
	kickMembers: 1,
	banMembers: 2,
	administrator: 3,
	manageChannels: 4,
	manageGuild: 5,
	viewAuditLog: 7,
	manageMessages: 13,
	mentionEveryone: 17,
	muteMembers: 22,
	deafenMembers: 23,
	moveMembers: 24,
	manageNicknames: 27,
	manageRoles: 28,
	manageWebhooks: 29,
	manageExpressions: 30,
	manageEvents: 33,
	manageThreads: 34,
	moderateMembers: 40
} as const;
const UNSAFE_ROLE_PERMISSIONS = Object.values(UNSAFE_ROLE_PERMISSION_BITS).reduce((mask, bit) => mask | (1n << BigInt(bit)), 0n);

export function isSelfAssignableRole(permissions: unknown): boolean {
	try {
		return (BigInt(String(permissions ?? '0') || '0') & UNSAFE_ROLE_PERMISSIONS) === 0n;
	} catch {
		return false;
	}
}

export function messageUploadLimit(boostLevel: unknown): number {
	const level = Number(boostLevel) || 0;
	return (level >= 3 ? 100 : level >= 2 ? 50 : 20) * MB;
}

export const MESSAGE_PLACEHOLDERS = [
	{ token: '{server}', label: 'Server name' },
	{ token: '{year}', label: 'Current year' }
] as const;

export const MESSAGE_BUTTON_STYLES = [
	{ id: 'secondary', label: 'Grey', hint: 'Everyday action' },
	{ id: 'primary', label: 'Blue', hint: 'The one main action' },
	{ id: 'success', label: 'Green', hint: 'The yes of a yes/no pair' },
	{ id: 'danger', label: 'Red', hint: 'Something that cannot be undone' },
	{ id: 'link', label: 'Link', hint: 'Opens a website' }
] as const;

export const MESSAGE_ROLE_MODES = [
	{ id: 'toggle', label: 'Give or take away role' },
	{ id: 'add', label: 'Give role' },
	{ id: 'remove', label: 'Take away role' }
] as const;

export const MESSAGE_BLOCK_TYPES = [
	{ id: 'container', label: 'Container', icon: 'fa-square', hint: 'A box with a colored edge that holds other blocks' },
	{ id: 'text', label: 'Text', icon: 'fa-align-left', hint: 'Markdown text' },
	{ id: 'section', label: 'Section', icon: 'fa-table-columns', hint: 'Text with a small image or a button beside it' },
	{ id: 'gallery', label: 'Media', icon: 'fa-images', hint: 'One to ten images or videos' },
	{ id: 'separator', label: 'Divider', icon: 'fa-minus', hint: 'A line or a gap' },
	{ id: 'buttons', label: 'Buttons', icon: 'fa-hand-pointer', hint: 'Up to five buttons in a row' },
	{ id: 'select', label: 'Dropdown', icon: 'fa-list', hint: 'A menu with up to 25 choices' }
] as const;

export type MessageScope = (typeof MESSAGE_SCOPES)[number];
export type MessageOwner = { scope: MessageScope; id: number | string };
export type Localized = Partial<Record<ServerLanguage, string>>;
export type MessageLayout = 'standard' | 'components';
export type MessageButtonStyle = (typeof MESSAGE_BUTTON_STYLES)[number]['id'];
export type MessageRoleMode = (typeof MESSAGE_ROLE_MODES)[number]['id'];
export type MessageBlockType = (typeof MESSAGE_BLOCK_TYPES)[number]['id'];

export type MessageAction =
	| { type: 'text'; text: Localized }
	| { type: 'attachment'; file: string }
	| { type: 'show'; message_id: number }
	| { type: 'role'; mode: MessageRoleMode; role_id: string };

export type MessageButton = { id: string; style: MessageButtonStyle; label: Localized; emoji: string; url: string; actions: MessageAction[] };
export type MessageOption = { id: string; label: Localized; description: Localized; emoji: string; actions: MessageAction[] };

export type ButtonsBlock = { id: string; type: 'buttons'; buttons: MessageButton[] };
export type SelectBlock = { id: string; type: 'select'; placeholder: Localized; multiple: boolean; options: MessageOption[] };
export type TextBlock = { id: string; type: 'text'; text: Localized };
export type SectionBlock = { id: string; type: 'section'; text: Localized; accessory: 'thumbnail' | 'button'; image: string; button: MessageButton };
export type GalleryItem = { id: string; media: string; caption: Localized };
export type GalleryBlock = { id: string; type: 'gallery'; items: GalleryItem[] };
export type SeparatorBlock = { id: string; type: 'separator'; line: boolean; large: boolean };
export type RowBlock = ButtonsBlock | SelectBlock;
export type InnerBlock = TextBlock | SectionBlock | GalleryBlock | SeparatorBlock | RowBlock;
export type ContainerBlock = { id: string; type: 'container'; color: string; blocks: InnerBlock[] };
export type MessageBlock = InnerBlock | ContainerBlock;

export type MessageField = { id: string; name: Localized; value: Localized; inline: boolean };
export type MessageEmbed = {
	id: string;
	color: string;
	author: Localized;
	author_icon: string;
	author_url: string;
	title: Localized;
	url: string;
	description: Localized;
	fields: MessageField[];
	thumbnail: string;
	image: string;
	footer: Localized;
	footer_icon: string;
	timestamp: boolean;
};

export type MessageAttachment = { id: string; file: string; spoiler: boolean };
export type MessageFile = { key: string; name: string };

export type MessageDoc = {
	layout: MessageLayout;
	language: ServerLanguage;
	languages: ServerLanguage[];
	language_switch: boolean;
	text: Localized;
	attachments: MessageAttachment[];
	embeds: MessageEmbed[];
	rows: RowBlock[];
	blocks: MessageBlock[];
};

export type MessageComponent = { kind: 'button'; button: MessageButton } | { kind: 'select'; select: SelectBlock };

export type MessagePayload = { v2: boolean; content: string | null; embeds: any[]; components: any[]; files: MessageFile[]; empty: boolean };

export type MessageRenderOptions = {
	scope?: MessageScope;
	defaultColor?: number | null;
	messageId: number;
	lang: ServerLanguage;
	server: string;
	image: (value: string) => string;
	interactive?: boolean;
	pinned?: boolean;
	prefix?: string;
	media?: boolean;
	post?: number | null;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const HTTP_URL = /^https?:\/\/\S+$/i;
const ROLE_ID = /^\d{5,25}$/;
const CUSTOM_EMOJI = /^<?(a)?:?([A-Za-z0-9_]{2,32}):(\d{5,25})>?$/;
const UNICODE_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3)/u;
const UPLOAD_KEY = new RegExp(
	`^(${Object.values(MESSAGE_UPLOAD_ROOTS).join('|')})/([1-9]\\d*)/\\d+-[a-z0-9]+\\.(?:${[...MESSAGE_IMAGE_EXTENSIONS, ...MESSAGE_VIDEO_EXTENSIONS].join('|')})$`
);

export function newMessagePartId(): string {
	return Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

export function isMessageUploadKey(value: unknown, owner?: MessageOwner): boolean {
	const match = String(value ?? '').match(UPLOAD_KEY);
	if (!match) return false;
	return !owner || (match[1] === MESSAGE_UPLOAD_ROOTS[owner.scope] && match[2] === String(owner.id));
}

export function isMessageVideo(value: unknown): boolean {
	const path = String(value ?? '')
		.split(/[?#]/)[0]
		.toLowerCase();
	return MESSAGE_VIDEO_EXTENSIONS.some((ext) => path.endsWith(`.${ext}`));
}

export function messageFilePreviewUrl(value: string): string {
	return isMessageUploadKey(value) ? `/api/uploads/${value}` : value;
}

function uploadName(key: string, spoiler = false): string {
	return `${spoiler ? 'SPOILER_' : ''}${key.slice(key.lastIndexOf('/') + 1)}`;
}

export function pickText(value: Localized | undefined, lang: ServerLanguage, base: ServerLanguage): string {
	const own = value?.[lang];
	if (typeof own === 'string' && own.trim()) return own;
	const fallback = value?.[base];
	return typeof fallback === 'string' ? fallback : '';
}

export function applyMessagePlaceholders(text: string, server: string): string {
	return String(text ?? '')
		.replace(/{server}/g, server)
		.replace(/{year}/g, String(new Date().getFullYear()));
}

export function parseMessageEmoji(value: string): { id?: string; name: string; animated?: boolean } | null {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const custom = raw.match(CUSTOM_EMOJI);
	if (custom) return { id: custom[3], name: custom[2], animated: custom[1] === 'a' };
	return UNICODE_EMOJI.test(raw) ? { name: raw } : null;
}

export function messageCustomId(
	scope: MessageScope,
	messageId: number,
	partId: string,
	lang: ServerLanguage,
	pinned = false,
	post: number | null = null
): string {
	return `${MESSAGE_CUSTOM_ID_PREFIXES[scope]}|${messageId}|${partId}|${lang}${pinned ? '*' : ''}${post ? `|${post}` : ''}`;
}

export function parseMessageCustomId(
	customId: unknown
): { scope: MessageScope; messageId: number; partId: string; lang: ServerLanguage; pinned: boolean; post: number | null } | null {
	const parts = String(customId ?? '').split('|');
	const scope = MESSAGE_SCOPES.find((candidate) => MESSAGE_CUSTOM_ID_PREFIXES[candidate] === parts[0]);
	if ((parts.length !== 4 && parts.length !== 5) || !scope) return null;
	const messageId = Number(parts[1]);
	if (!Number.isInteger(messageId) || messageId <= 0 || !parts[2]) return null;
	const pinned = parts[3].endsWith('*');
	const lang = pinned ? parts[3].slice(0, -1) : parts[3];
	const post = Number(parts[4]);
	return {
		scope,
		messageId,
		partId: parts[2],
		lang: isServerLanguage(lang) ? lang : DEFAULT_SERVER_LANGUAGE,
		pinned,
		post: Number.isInteger(post) && post > 0 ? post : null
	};
}

export function messageLanguageChoices(doc: MessageDoc, lang: ServerLanguage): ServerLanguage[] {
	return doc.language_switch ? doc.languages.filter((code) => code !== lang) : [];
}

export function messageRowLimit(doc: MessageDoc): number {
	return MESSAGE_LIMITS.rows - (doc.language_switch && doc.languages.length > 1 ? 1 : 0);
}

export function newMessageButton(): MessageButton {
	return { id: newMessagePartId(), style: 'secondary', label: {}, emoji: '', url: '', actions: [] };
}

export function newMessageOption(): MessageOption {
	return { id: newMessagePartId(), label: {}, description: {}, emoji: '', actions: [] };
}

export function newMessageEmbed(color: string, footer: Localized = {}): MessageEmbed {
	return {
		id: newMessagePartId(),
		color,
		author: {},
		author_icon: '',
		author_url: '',
		title: {},
		url: '',
		description: {},
		fields: [],
		thumbnail: '',
		image: '',
		footer,
		footer_icon: '',
		timestamp: true
	};
}

export function newMessageBlock(type: MessageBlockType, color = ''): MessageBlock {
	const id = newMessagePartId();
	if (type === 'container') return { id, type, color, blocks: [{ id: newMessagePartId(), type: 'text', text: {} }] };
	if (type === 'text') return { id, type, text: {} };
	if (type === 'section') return { id, type, text: {}, accessory: 'thumbnail', image: '', button: newMessageButton() };
	if (type === 'gallery') return { id, type, items: [{ id: newMessagePartId(), media: '', caption: {} }] };
	if (type === 'separator') return { id, type, line: true, large: false };
	if (type === 'buttons') return { id, type, buttons: [newMessageButton()] };
	return { id, type: 'select', placeholder: {}, multiple: false, options: [newMessageOption()] };
}

export function newMessageDoc(language: ServerLanguage): MessageDoc {
	return {
		layout: 'standard',
		language,
		languages: [language],
		language_switch: true,
		text: {},
		attachments: [],
		embeds: [],
		rows: [],
		blocks: []
	};
}

function text(value: unknown, max: number): string {
	return typeof value === 'string' ? value.slice(0, max) : '';
}

function localized(value: unknown, max: number, languages: ServerLanguage[]): Localized {
	const out: Localized = {};
	if (!value || typeof value !== 'object') return out;
	for (const lang of languages) {
		const entry = text((value as Record<string, unknown>)[lang], max);
		if (entry.trim()) out[lang] = entry;
	}
	return out;
}

type NormalizeContext = { languages: ServerLanguage[]; ownsUpload: (key: string) => boolean; ids: Set<string>; roles: boolean };

function partId(value: unknown, ctx: NormalizeContext): string {
	let id = typeof value === 'string' && /^[a-z0-9]{4,16}$/.test(value) ? value : newMessagePartId();
	while (ctx.ids.has(id)) id = newMessagePartId();
	ctx.ids.add(id);
	return id;
}

function mediaValue(value: unknown, ctx: NormalizeContext): string {
	const raw = text(value, MESSAGE_LIMITS.image).trim();
	if (!raw) return '';
	if (HTTP_URL.test(raw)) return raw;
	return isMessageUploadKey(raw) && ctx.ownsUpload(raw) ? raw : '';
}

function imageValue(value: unknown, ctx: NormalizeContext): string {
	const raw = mediaValue(value, ctx);
	return isMessageUploadKey(raw) && isMessageVideo(raw) ? '' : raw;
}

function uploadValue(value: unknown, ctx: NormalizeContext): string {
	const raw = mediaValue(value, ctx);
	return isMessageUploadKey(raw) ? raw : '';
}

function linkValue(value: unknown): string {
	const raw = text(value, MESSAGE_LIMITS.url).trim();
	return HTTP_URL.test(raw) ? raw : '';
}

function colorValue(value: unknown): string {
	const raw = text(value, 7).trim();
	return HEX_COLOR.test(raw) ? raw.toLowerCase() : '';
}

function list(value: unknown, max: number): any[] {
	return Array.isArray(value) ? value.slice(0, max).filter((item) => item && typeof item === 'object') : [];
}

function normalizeActions(value: unknown, ctx: NormalizeContext): MessageAction[] {
	const out: MessageAction[] = [];
	const seen = new Set<string>();
	for (const raw of list(value, MESSAGE_LIMITS.actions)) {
		let action: MessageAction | null = null;
		if (raw.type === 'text') {
			action = { type: 'text', text: localized(raw.text, MESSAGE_LIMITS.text, ctx.languages) };
		} else if (raw.type === 'attachment') {
			action = { type: 'attachment', file: uploadValue(raw.file, ctx) };
		} else if (raw.type === 'show') {
			const messageId = Math.trunc(Number(raw.message_id));
			action = { type: 'show', message_id: Number.isFinite(messageId) && messageId > 0 ? messageId : 0 };
		} else if (raw.type === 'role' && ctx.roles) {
			const mode = MESSAGE_ROLE_MODES.some((m) => m.id === raw.mode) ? (raw.mode as MessageRoleMode) : 'toggle';
			const roleId = text(raw.role_id, 25);
			action = { type: 'role', mode, role_id: ROLE_ID.test(roleId) ? roleId : '' };
		}
		if (!action) continue;
		const key = action.type === 'role' ? `role:${action.role_id}` : action.type === 'attachment' ? `attachment:${action.file}` : action.type;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(action);
	}
	return out;
}

function normalizeButton(raw: any, ctx: NormalizeContext): MessageButton {
	const style = MESSAGE_BUTTON_STYLES.some((s) => s.id === raw?.style) ? (raw.style as MessageButtonStyle) : 'secondary';
	return {
		id: partId(raw?.id, ctx),
		style,
		label: localized(raw?.label, MESSAGE_LIMITS.label, ctx.languages),
		emoji: text(raw?.emoji, MESSAGE_LIMITS.emoji).trim(),
		url: style === 'link' ? linkValue(raw?.url) : '',
		actions: style === 'link' ? [] : normalizeActions(raw?.actions, ctx)
	};
}

function normalizeRow(raw: any, ctx: NormalizeContext): RowBlock | null {
	if (raw?.type === 'buttons') {
		return { id: partId(raw.id, ctx), type: 'buttons', buttons: list(raw.buttons, MESSAGE_LIMITS.buttons).map((b) => normalizeButton(b, ctx)) };
	}
	if (raw?.type === 'select') {
		return {
			id: partId(raw.id, ctx),
			type: 'select',
			placeholder: localized(raw.placeholder, MESSAGE_LIMITS.placeholder, ctx.languages),
			multiple: raw.multiple === true,
			options: list(raw.options, MESSAGE_LIMITS.options).map((o) => ({
				id: partId(o.id, ctx),
				label: localized(o.label, MESSAGE_LIMITS.optionLabel, ctx.languages),
				description: localized(o.description, MESSAGE_LIMITS.optionDescription, ctx.languages),
				emoji: text(o.emoji, MESSAGE_LIMITS.emoji).trim(),
				actions: normalizeActions(o.actions, ctx)
			}))
		};
	}
	return null;
}

function normalizeInner(raw: any, ctx: NormalizeContext): InnerBlock | null {
	if (raw?.type === 'text') return { id: partId(raw.id, ctx), type: 'text', text: localized(raw.text, MESSAGE_LIMITS.blockText, ctx.languages) };
	if (raw?.type === 'section') {
		return {
			id: partId(raw.id, ctx),
			type: 'section',
			text: localized(raw.text, MESSAGE_LIMITS.blockText, ctx.languages),
			accessory: raw.accessory === 'button' ? 'button' : 'thumbnail',
			image: imageValue(raw.image, ctx),
			button: normalizeButton(raw.button, ctx)
		};
	}
	if (raw?.type === 'gallery') {
		return {
			id: partId(raw.id, ctx),
			type: 'gallery',
			items: list(raw.items, MESSAGE_LIMITS.galleryItems).map((item) => ({
				id: partId(item.id, ctx),
				media: mediaValue(item.media, ctx),
				caption: localized(item.caption, MESSAGE_LIMITS.caption, ctx.languages)
			}))
		};
	}
	if (raw?.type === 'separator') return { id: partId(raw.id, ctx), type: 'separator', line: raw.line !== false, large: raw.large === true };
	return normalizeRow(raw, ctx);
}

function normalizeBlock(raw: any, ctx: NormalizeContext): MessageBlock | null {
	if (raw?.type !== 'container') return normalizeInner(raw, ctx);
	return {
		id: partId(raw.id, ctx),
		type: 'container',
		color: colorValue(raw.color),
		blocks: list(raw.blocks, MESSAGE_LIMITS.innerBlocks)
			.map((b) => normalizeInner(b, ctx))
			.filter((b): b is InnerBlock => b !== null)
	};
}

function normalizeEmbed(raw: any, ctx: NormalizeContext): MessageEmbed {
	return {
		id: partId(raw?.id, ctx),
		color: colorValue(raw?.color),
		author: localized(raw?.author, MESSAGE_LIMITS.author, ctx.languages),
		author_icon: imageValue(raw?.author_icon, ctx),
		author_url: linkValue(raw?.author_url),
		title: localized(raw?.title, MESSAGE_LIMITS.title, ctx.languages),
		url: linkValue(raw?.url),
		description: localized(raw?.description, MESSAGE_LIMITS.description, ctx.languages),
		fields: list(raw?.fields, MESSAGE_LIMITS.fields).map((f) => ({
			id: partId(f.id, ctx),
			name: localized(f.name, MESSAGE_LIMITS.fieldName, ctx.languages),
			value: localized(f.value, MESSAGE_LIMITS.fieldValue, ctx.languages),
			inline: f.inline === true
		})),
		thumbnail: imageValue(raw?.thumbnail, ctx),
		image: imageValue(raw?.image, ctx),
		footer: localized(raw?.footer, MESSAGE_LIMITS.footer, ctx.languages),
		footer_icon: imageValue(raw?.footer_icon, ctx),
		timestamp: raw?.timestamp === true
	};
}

export function normalizeMessageDoc(raw: unknown, ownsUpload: (key: string) => boolean = () => true, scope: MessageScope = 'server'): MessageDoc {
	const source = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
	const language = isServerLanguage(source.language) ? source.language : DEFAULT_SERVER_LANGUAGE;
	const extra = Array.isArray(source.languages) ? source.languages.filter((l: unknown): l is ServerLanguage => isServerLanguage(l) && l !== language) : [];
	const languages = [language, ...SERVER_LANGUAGE_CODES.filter((code) => extra.includes(code))];
	const ctx: NormalizeContext = { languages, ownsUpload, ids: new Set(), roles: scope === 'server' };
	const layout: MessageLayout = source.layout === 'components' ? 'components' : 'standard';

	if (layout === 'components') {
		return {
			layout,
			language,
			languages,
			language_switch: source.language_switch !== false,
			text: {},
			attachments: [],
			embeds: [],
			rows: [],
			blocks: list(source.blocks, MESSAGE_LIMITS.blocks)
				.map((b) => normalizeBlock(b, ctx))
				.filter((b): b is MessageBlock => b !== null)
		};
	}

	return {
		layout,
		language,
		languages,
		language_switch: source.language_switch !== false,
		text: localized(source.text, MESSAGE_LIMITS.text, languages),
		attachments: list(source.attachments, MESSAGE_LIMITS.attachments)
			.map((a) => ({ id: partId(a.id, ctx), file: uploadValue(a.file, ctx), spoiler: a.spoiler === true }))
			.filter((a) => a.file),
		embeds: list(source.embeds, MESSAGE_LIMITS.embeds).map((e) => normalizeEmbed(e, ctx)),
		rows: list(source.rows, MESSAGE_LIMITS.rows)
			.map((r) => normalizeRow(r, ctx))
			.filter((r): r is RowBlock => r !== null),
		blocks: []
	};
}

function innerBlocks(doc: MessageDoc): InnerBlock[] {
	if (doc.layout === 'standard') return doc.rows;
	return doc.blocks.flatMap((block) => (block.type === 'container' ? block.blocks : [block]));
}

export function messageButtons(doc: MessageDoc): MessageButton[] {
	return innerBlocks(doc).flatMap((block) =>
		block.type === 'buttons' ? block.buttons : block.type === 'section' && block.accessory === 'button' ? [block.button] : []
	);
}

export function messageSelects(doc: MessageDoc): SelectBlock[] {
	return innerBlocks(doc).filter((block): block is SelectBlock => block.type === 'select');
}

export function findMessageComponent(doc: MessageDoc, id: string): MessageComponent | null {
	const button = messageButtons(doc).find((b) => b.id === id);
	if (button) return { kind: 'button', button };
	const select = messageSelects(doc).find((s) => s.id === id);
	return select ? { kind: 'select', select } : null;
}

export function messageActions(doc: MessageDoc): MessageAction[] {
	return [...messageButtons(doc).flatMap((b) => b.actions), ...messageSelects(doc).flatMap((s) => s.options.flatMap((o) => o.actions))];
}

export function messageShownIds(doc: MessageDoc): number[] {
	return [...new Set(messageActions(doc).flatMap((a) => (a.type === 'show' && a.message_id > 0 ? [a.message_id] : [])))];
}

export function messageRoleIds(doc: MessageDoc): string[] {
	return [...new Set(messageActions(doc).flatMap((a) => (a.type === 'role' && a.role_id ? [a.role_id] : [])))];
}

export function messageReplyDoc(actions: MessageAction[], source: MessageDoc): MessageDoc | null {
	const written = actions.find((action): action is Extract<MessageAction, { type: 'text' }> => action.type === 'text')?.text ?? {};
	const worded = pickText(written, source.language, source.language).trim() !== '';
	const attachments = actions.flatMap((action, i) =>
		action.type === 'attachment' && action.file ? [{ id: `reply${i}`, file: action.file, spoiler: false }] : []
	);
	if (!worded && attachments.length === 0) return null;
	return { ...newMessageDoc(source.language), languages: source.languages, language_switch: false, text: worded ? written : {}, attachments };
}

export function messageUploadKeys(doc: MessageDoc): string[] {
	const values: string[] = [];
	for (const attachment of doc.attachments) values.push(attachment.file);
	for (const embed of doc.embeds) values.push(embed.author_icon, embed.thumbnail, embed.image, embed.footer_icon);
	for (const block of innerBlocks(doc)) {
		if (block.type === 'section') values.push(block.image);
		if (block.type === 'gallery') values.push(...block.items.map((item) => item.media));
	}
	for (const action of messageActions(doc)) if (action.type === 'attachment') values.push(action.file);
	return [...new Set(values.filter((value) => isMessageUploadKey(value)))];
}

export function removeMessageLanguage(doc: MessageDoc, lang: ServerLanguage, scope: MessageScope = 'server'): MessageDoc {
	if (lang === doc.language) return doc;
	return normalizeMessageDoc({ ...doc, languages: doc.languages.filter((l) => l !== lang) }, undefined, scope);
}

function embedHasContent(embed: MessageEmbed, lang: ServerLanguage, base: ServerLanguage, media = true): boolean {
	const has = (value: Localized) => pickText(value, lang, base).trim() !== '';
	const pictured = media && (!!embed.image || !!embed.thumbnail);
	return has(embed.title) || has(embed.description) || has(embed.author) || has(embed.footer) || embed.fields.length > 0 || pictured;
}

function renderButton(button: MessageButton, opts: MessageRenderOptions, base: ServerLanguage): any | null {
	const label = applyMessagePlaceholders(pickText(button.label, opts.lang, base), opts.server)
		.trim()
		.slice(0, MESSAGE_LIMITS.label);
	const emoji = parseMessageEmoji(button.emoji);
	if (!label && !emoji) return null;
	const shared = { type: 2, ...(label ? { label } : {}), ...(emoji ? { emoji } : {}) };
	if (button.style === 'link') return button.url ? { ...shared, style: 5, url: button.url } : null;
	if (opts.interactive === false) return null;
	const style = button.style === 'primary' ? 1 : button.style === 'success' ? 3 : button.style === 'danger' ? 4 : 2;
	return { ...shared, style, custom_id: messageCustomId(opts.scope ?? 'server', opts.messageId, button.id, opts.lang, opts.pinned, opts.post) };
}

function renderRow(block: RowBlock, opts: MessageRenderOptions, base: ServerLanguage): any | null {
	if (block.type === 'buttons') {
		const buttons = block.buttons.map((b) => renderButton(b, opts, base)).filter(Boolean);
		return buttons.length > 0 ? { type: 1, components: buttons } : null;
	}
	if (opts.interactive === false) return null;
	const options = block.options
		.map((option) => {
			const label = applyMessagePlaceholders(pickText(option.label, opts.lang, base), opts.server)
				.trim()
				.slice(0, MESSAGE_LIMITS.optionLabel);
			if (!label) return null;
			const description = applyMessagePlaceholders(pickText(option.description, opts.lang, base), opts.server)
				.trim()
				.slice(0, MESSAGE_LIMITS.optionDescription);
			const emoji = parseMessageEmoji(option.emoji);
			return { label, value: option.id, ...(description ? { description } : {}), ...(emoji ? { emoji } : {}) };
		})
		.filter(Boolean);
	if (options.length === 0) return null;
	const placeholder = applyMessagePlaceholders(pickText(block.placeholder, opts.lang, base), opts.server)
		.trim()
		.slice(0, MESSAGE_LIMITS.placeholder);
	return {
		type: 1,
		components: [
			{
				type: 3,
				custom_id: messageCustomId(opts.scope ?? 'server', opts.messageId, block.id, opts.lang, opts.pinned, opts.post),
				min_values: 1,
				max_values: block.multiple ? options.length : 1,
				options,
				...(placeholder ? { placeholder } : {})
			}
		]
	};
}

function renderInner(block: InnerBlock, opts: MessageRenderOptions, base: ServerLanguage, files: MessageFile[]): any | null {
	const resolve = (value: Localized) => applyMessagePlaceholders(pickText(value, opts.lang, base), opts.server);
	if (block.type === 'text') {
		const content = resolve(block.text);
		return content.trim() ? { type: 10, content } : null;
	}
	if (block.type === 'section') {
		const content = resolve(block.text);
		if (!content.trim()) return null;
		const display = { type: 10, content };
		const thumbnail = block.image && opts.media !== false ? { type: 11, media: { url: opts.image(block.image) } } : null;
		const accessory = block.accessory === 'button' ? renderButton(block.button, opts, base) : thumbnail;
		return accessory ? { type: 9, components: [display], accessory } : display;
	}
	if (block.type === 'gallery') {
		if (opts.media === false) return null;
		const items = block.items
			.filter((item) => item.media)
			.map((item) => {
				const description = resolve(item.caption).trim().slice(0, MESSAGE_LIMITS.caption);
				const attached = isMessageUploadKey(item.media) && isMessageVideo(item.media);
				if (attached && !files.some((file) => file.key === item.media)) files.push({ key: item.media, name: uploadName(item.media) });
				return { media: { url: attached ? `attachment://${uploadName(item.media)}` : opts.image(item.media) }, ...(description ? { description } : {}) };
			});
		return items.length > 0 ? { type: 12, items } : null;
	}
	if (block.type === 'separator') return { type: 14, divider: block.line, spacing: block.large ? 2 : 1 };
	return renderRow(block, opts, base);
}

function renderEmbed(embed: MessageEmbed, opts: MessageRenderOptions, base: ServerLanguage): any | null {
	const media = opts.media !== false;
	if (!embedHasContent(embed, opts.lang, base, media)) return null;
	const resolve = (value: Localized) => applyMessagePlaceholders(pickText(value, opts.lang, base), opts.server);
	const title = resolve(embed.title).trim().slice(0, MESSAGE_LIMITS.title);
	const description = resolve(embed.description).slice(0, MESSAGE_LIMITS.description);
	const author = resolve(embed.author).trim().slice(0, MESSAGE_LIMITS.author);
	const footer = resolve(embed.footer).trim().slice(0, MESSAGE_LIMITS.footer);
	const fields = embed.fields
		.map((field) => ({
			name: resolve(field.name).trim().slice(0, MESSAGE_LIMITS.fieldName),
			value: resolve(field.value).slice(0, MESSAGE_LIMITS.fieldValue),
			inline: field.inline
		}))
		.filter((field) => field.name && field.value.trim());
	return {
		...(embed.color ? { color: parseInt(embed.color.slice(1), 16) } : opts.defaultColor != null ? { color: opts.defaultColor } : {}),
		...(title ? { title } : {}),
		...(title && embed.url ? { url: embed.url } : {}),
		...(description.trim() ? { description } : {}),
		...(author
			? {
					author: {
						name: author,
						...(embed.author_url ? { url: embed.author_url } : {}),
						...(embed.author_icon ? { icon_url: opts.image(embed.author_icon) } : {})
					}
				}
			: {}),
		...(fields.length > 0 ? { fields } : {}),
		...(media && embed.thumbnail ? { thumbnail: { url: opts.image(embed.thumbnail) } } : {}),
		...(media && embed.image ? { image: { url: opts.image(embed.image) } } : {}),
		...(footer ? { footer: { text: footer, ...(embed.footer_icon ? { icon_url: opts.image(embed.footer_icon) } : {}) } } : {}),
		...(embed.timestamp ? { timestamp: new Date().toISOString() } : {})
	};
}

function renderLanguageRow(doc: MessageDoc, opts: MessageRenderOptions): any | null {
	if (opts.interactive === false) return null;
	const current = doc.languages.includes(opts.lang) ? opts.lang : doc.language;
	if (messageLanguageChoices(doc, current).length === 0) return null;
	const emoji = { name: MESSAGE_LANGUAGE_EMOJI };
	return {
		type: 1,
		components: [
			{
				type: 3,
				custom_id: messageCustomId(opts.scope ?? 'server', opts.messageId, MESSAGE_LANGUAGE_PART, current, opts.pinned, opts.post),
				min_values: 1,
				max_values: 1,
				options: doc.languages.map((code) => ({ label: serverLanguageLabel(code), value: code, emoji, default: code === current }))
			}
		]
	};
}

export function renderMessagePayload(doc: MessageDoc, opts: MessageRenderOptions): MessagePayload {
	const base = doc.language;
	const prefix = (opts.prefix ?? '').trim();
	const languageRow = renderLanguageRow(doc, opts);

	if (doc.layout === 'components') {
		const files: MessageFile[] = [];
		const components = doc.blocks
			.map((block) => {
				if (block.type !== 'container') return renderInner(block, opts, base, files);
				const inner = block.blocks.map((b) => renderInner(b, opts, base, files)).filter(Boolean);
				return inner.length > 0 ? { type: 17, ...(block.color ? { accent_color: parseInt(block.color.slice(1), 16) } : {}), components: inner } : null;
			})
			.filter(Boolean);
		const parts = languageRow && components.length > 0 ? [...components, languageRow] : components;
		return {
			v2: true,
			content: null,
			embeds: [],
			components: prefix && parts.length > 0 ? [{ type: 10, content: prefix }, ...parts] : parts,
			files,
			empty: components.length === 0
		};
	}

	const body = applyMessagePlaceholders(pickText(doc.text, opts.lang, base), opts.server).slice(0, MESSAGE_LIMITS.text);
	const embeds = doc.embeds.map((embed) => renderEmbed(embed, opts, base)).filter(Boolean);
	const components = doc.rows.map((row) => renderRow(row, opts, base)).filter(Boolean);
	const files =
		opts.media === false ? [] : doc.attachments.map((attachment) => ({ key: attachment.file, name: uploadName(attachment.file, attachment.spoiler) }));
	const content = [prefix, body.trim() ? body : ''].filter(Boolean).join('\n');
	const empty = !body.trim() && embeds.length === 0 && components.length === 0 && files.length === 0;
	return {
		v2: false,
		content: content || null,
		embeds,
		components: languageRow && !empty ? [...components, languageRow] : components,
		files,
		empty
	};
}

export function messagePayloadTextLength(payload: MessagePayload): number {
	const walk = (component: any): number =>
		(component?.type === 10 ? String(component.content ?? '').length : 0) +
		(Array.isArray(component?.components) ? component.components.reduce((sum: number, child: any) => sum + walk(child), 0) : 0);
	return payload.components.reduce((sum, component) => sum + walk(component), 0);
}

function countComponents(components: any[]): number {
	return components.reduce(
		(sum, component) => sum + 1 + (Array.isArray(component?.components) ? countComponents(component.components) : 0) + (component?.accessory ? 1 : 0),
		0
	);
}

function embedLength(embed: any): number {
	return (
		String(embed.title ?? '').length +
		String(embed.description ?? '').length +
		String(embed.footer?.text ?? '').length +
		String(embed.author?.name ?? '').length +
		(embed.fields ?? []).reduce((sum: number, field: any) => sum + String(field.name).length + String(field.value).length, 0)
	);
}

export type MessageIssue = { part: string | null; text: string };

function buttonIssues(button: MessageButton, where: string, base: ServerLanguage): MessageIssue[] {
	const out: MessageIssue[] = [];
	const add = (text: string) => out.push({ part: button.id, text });
	const label = pickText(button.label, base, base).trim();
	if (!label && !button.emoji) add(`${where} needs a label or an emoji.`);
	if (button.emoji && !parseMessageEmoji(button.emoji)) add(`${where}: "${button.emoji}" is not an emoji.`);
	if (button.style === 'link') {
		if (!button.url) add(`${where} needs a link that starts with https://.`);
	} else {
		for (const text of actionIssues(button.actions, where, base)) add(text);
	}
	return out;
}

function actionIssues(actions: MessageAction[], where: string, base: ServerLanguage): string[] {
	if (actions.length === 0) return [`${where}: pick what happens when it is clicked.`];
	const out: string[] = [];
	for (const action of actions) {
		if (action.type === 'text' && !pickText(action.text, base, base).trim()) out.push(`${where}: write the message it replies with, or remove it.`);
		if (action.type === 'attachment' && !action.file) out.push(`${where}: upload the attachment it replies with, or remove it.`);
		if (action.type === 'show' && !action.message_id) out.push(`${where}: pick which message to show.`);
		if (action.type === 'role' && !action.role_id) out.push(`${where}: pick a role.`);
	}
	return out;
}

function rowIssues(block: RowBlock, where: string, base: ServerLanguage): MessageIssue[] {
	if (block.type === 'buttons') {
		if (block.buttons.length === 0) return [{ part: block.id, text: `${where} has no buttons. Add one or remove the row.` }];
		return block.buttons.flatMap((button, i) => buttonIssues(button, `${where}, button ${i + 1}`, base));
	}
	if (block.options.length === 0) return [{ part: block.id, text: `${where} has no choices. Add one or remove the dropdown.` }];
	return block.options.flatMap((option, i) => {
		const at = `${where}, choice ${i + 1}`;
		const out: string[] = [];
		if (!pickText(option.label, base, base).trim()) out.push(`${at} needs a label.`);
		if (option.emoji && !parseMessageEmoji(option.emoji)) out.push(`${at}: "${option.emoji}" is not an emoji.`);
		out.push(...actionIssues(option.actions, at, base));
		return out.map((text) => ({ part: block.id, text }));
	});
}

function innerIssues(block: InnerBlock, where: string, base: ServerLanguage): MessageIssue[] {
	const at = (text: string): MessageIssue => ({ part: block.id, text });
	if (block.type === 'text') return pickText(block.text, base, base).trim() ? [] : [at(`${where} is empty. Write something or remove it.`)];
	if (block.type === 'section') {
		const out: MessageIssue[] = [];
		if (!pickText(block.text, base, base).trim()) out.push(at(`${where} needs text.`));
		if (block.accessory === 'thumbnail' && !block.image) out.push(at(`${where} needs an image, or switch it to a button.`));
		if (block.accessory === 'button') out.push(...buttonIssues(block.button, `${where}, button`, base).map((issue) => ({ ...issue, part: block.id })));
		return out;
	}
	if (block.type === 'gallery') {
		if (block.items.length === 0) return [at(`${where} is empty. Add an image or video, or remove it.`)];
		return block.items.flatMap((item, i) => (item.media ? [] : [at(`${where}, item ${i + 1} is missing. Upload an image or video, or paste a link.`)]));
	}
	if (block.type === 'separator') return [];
	return rowIssues(block, where, base);
}

export function messageDocIssues(doc: MessageDoc): MessageIssue[] {
	const out: MessageIssue[] = [];
	const base = doc.language;
	const dummy = { messageId: 1, server: '', image: (value: string) => value };

	if (doc.layout === 'components') {
		if (doc.blocks.length === 0) out.push({ part: null, text: 'Press + to add your first block.' });
		doc.blocks.forEach((block, i) => {
			const where = `Block ${i + 1}`;
			if (block.type !== 'container') return out.push(...innerIssues(block, where, base));
			if (block.blocks.length === 0) return out.push({ part: block.id, text: `${where} is an empty box. Add something inside or remove it.` });
			block.blocks.forEach((inner, j) => out.push(...innerIssues(inner, `${where}, part ${j + 1}`, base)));
		});
	} else {
		doc.embeds.forEach((embed, i) => {
			const where = `Embed ${i + 1}`;
			if (!embedHasContent(embed, base, base)) out.push({ part: embed.id, text: `${where} is empty. Give it a title or description, or remove it.` });
			embed.fields.forEach((field, j) => {
				if (!pickText(field.name, base, base).trim() || !pickText(field.value, base, base).trim()) {
					out.push({ part: embed.id, text: `${where}, field ${j + 1} needs a name and a value.` });
				}
			});
		});
		doc.rows.forEach((row, i) => out.push(...rowIssues(row, `Row ${i + 1}`, base)));
		if (doc.rows.length > messageRowLimit(doc)) {
			out.push({
				part: null,
				text: `The language selector needs a row of its own and Discord allows ${MESSAGE_LIMITS.rows}. Remove a row of buttons or a dropdown, or turn the language selector off in the language menu.`
			});
		}
		if (!pickText(doc.text, base, base).trim() && doc.embeds.length === 0 && doc.rows.length === 0 && doc.attachments.length === 0) {
			out.push({ part: null, text: 'Write something, or press + to add an embed, a photo or buttons.' });
		}
	}

	for (const lang of doc.languages) {
		const payload = renderMessagePayload(doc, { ...dummy, lang });
		const suffix = lang === base ? '' : ` in ${serverLanguageLabel(lang)}`;
		if (payload.v2) {
			const length = messagePayloadTextLength(payload);
			if (length > MESSAGE_LIMITS.blockText) {
				out.push({
					part: null,
					text: `All text together is ${length.toLocaleString()} characters${suffix}. Discord allows ${MESSAGE_LIMITS.blockText.toLocaleString()}.`
				});
			}
			const total = countComponents(payload.components);
			if (total > MESSAGE_LIMITS.components && lang === base) {
				out.push({ part: null, text: `This uses ${total} components. Discord allows ${MESSAGE_LIMITS.components} per message.` });
			}
		} else {
			const length = payload.embeds.reduce((sum, embed) => sum + embedLength(embed), 0);
			if (length > MESSAGE_LIMITS.embedTotal) {
				out.push({
					part: null,
					text: `The embeds add up to ${length.toLocaleString()} characters${suffix}. Discord allows ${MESSAGE_LIMITS.embedTotal.toLocaleString()}.`
				});
			}
		}
	}

	const seen = new Set<string>();
	return out.filter((issue) => !seen.has(issue.text) && seen.add(issue.text));
}

export function messageDocProblems(doc: MessageDoc): string[] {
	return messageDocIssues(doc).map((issue) => issue.text);
}

export function messageSummary(doc: MessageDoc): string {
	const base = doc.language;
	const first =
		doc.layout === 'components'
			? innerBlocks(doc)
					.map((block) => (block.type === 'text' || block.type === 'section' ? pickText(block.text, base, base) : ''))
					.find((value) => value.trim())
			: (doc.embeds.map((embed) => pickText(embed.title, base, base) || pickText(embed.description, base, base)).find((value) => value.trim()) ??
				pickText(doc.text, base, base));
	return String(first ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 140);
}
