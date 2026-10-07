import { ComponentType, MessageFlags, MessageFlagsBitField } from 'discord.js';

const TEXT_LIMIT = 4000;

const toJSON = (x: any) => (typeof x?.toJSON === 'function' ? x.toJSON() : x);

export function isComponentsV2(message: any): boolean {
	return message?.flags?.has?.(MessageFlags.IsComponentsV2) === true;
}

function hasV2Flag(flags: any): boolean {
	return flags != null && new MessageFlagsBitField(flags).has(MessageFlags.IsComponentsV2);
}

export function v2Message(components: any[], editing?: any) {
	const clear = editing && !isComponentsV2(editing) ? { content: null, embeds: [] } : {};
	return { ...clear, components, flags: MessageFlags.IsComponentsV2 };
}

function fieldsText(fields: any[] = []): string {
	const blocks: string[] = [];
	let inline: string[] = [];
	const flush = () => {
		if (inline.length) blocks.push(inline.join(' · '));
		inline = [];
	};
	for (const f of fields) {
		if (f.inline) {
			inline.push(`**${f.name}:** ${String(f.value).replace(/\n+/g, ' ')}`);
		} else {
			flush();
			blocks.push(`**${f.name}**\n${f.value}`);
		}
	}
	flush();
	return blocks.join('\n\n');
}

export function toComponentsV2(options: any) {
	if (typeof options === 'string') options = { content: options };
	if (!options || hasV2Flag(options.flags)) return options;
	const { content, embeds, components, flags: _flags, ...rest } = options;

	let budget = TEXT_LIMIT;
	const text = (s: string) => {
		const content = String(s).slice(0, Math.max(0, budget));
		budget -= content.length;
		return content ? [{ type: ComponentType.TextDisplay, content }] : [];
	};

	const rows = (components ?? []).map(toJSON);
	const list = (embeds ?? []).map(toJSON);
	const out: any[] = content ? text(content) : [];

	list.forEach((e: any, i: number) => {
		const inner: any[] = [];
		const title = e.title && `### ${e.url ? `[${e.title}](${e.url})` : e.title}`;
		const head = [e.author?.name && `-# ${e.author.name}`, title, e.description].filter(Boolean).join('\n');
		const headText = head ? text(head) : [];
		if (headText.length && e.thumbnail?.url) {
			inner.push({ type: ComponentType.Section, components: headText, accessory: { type: ComponentType.Thumbnail, media: { url: e.thumbnail.url } } });
		} else {
			inner.push(...headText);
		}
		inner.push(...text(fieldsText(e.fields)));
		if (e.image?.url) inner.push({ type: ComponentType.MediaGallery, items: [{ media: { url: e.image.url } }] });
		if (i === list.length - 1 && rows.length) inner.push({ type: ComponentType.Separator }, ...rows);
		const foot = [e.footer?.text, e.timestamp && `<t:${Math.floor(Date.parse(e.timestamp) / 1000)}:f>`].filter(Boolean).join(' · ');
		if (foot) inner.push(...text(`-# ${foot}`));
		if (inner.length) out.push({ type: ComponentType.Container, ...(e.color != null ? { accent_color: e.color } : {}), components: inner });
	});
	if (!list.length) out.push(...rows);
	if (!out.length) out.push({ type: ComponentType.TextDisplay, content: '\u200b' });

	return { ...rest, components: out, flags: MessageFlags.IsComponentsV2 };
}

export function keepComponentsV2(interaction: any) {
	if (!isComponentsV2(interaction.message) || typeof interaction.update !== 'function') return;
	let editsMessage = false;
	const update = interaction.update.bind(interaction);
	const deferUpdate = interaction.deferUpdate.bind(interaction);
	const editReply = interaction.editReply.bind(interaction);
	interaction.update = (options: any) => {
		editsMessage = true;
		return update(toComponentsV2(options));
	};
	interaction.deferUpdate = (options: any) => {
		editsMessage = true;
		return deferUpdate(options);
	};
	interaction.editReply = (options: any) => editReply(editsMessage ? toComponentsV2(options) : options);
}
