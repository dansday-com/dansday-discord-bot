<script lang="ts">
	import { serverLanguageLabel, type ServerLanguage } from '$lib/languages.js';
	import {
		MESSAGE_LANGUAGE_EMOJI,
		MESSAGE_LIMITS,
		applyMessagePlaceholders,
		isMessageVideo,
		messageFilePreviewUrl,
		messageLanguageChoices,
		parseMessageEmoji,
		pickText,
		type InnerBlock,
		type Localized,
		type MessageAction,
		type MessageButton,
		type MessageDoc,
		type MessageEmbed,
		type RowBlock,
		type SelectBlock
	} from '$lib/messages.js';
	import { discordMarkdown, type MarkdownContext } from './discordMarkdown.js';

	const NOTHING = new Set<string>();

	let {
		doc,
		lang,
		server,
		context,
		now,
		editable = false,
		selected = null,
		flagged = NOTHING,
		onselect = () => {},
		onaddbutton = () => {},
		onaddinside = () => {},
		onlanguage = () => {},
		onpress
	}: {
		doc: MessageDoc;
		lang: ServerLanguage;
		server: string;
		context: MarkdownContext;
		now: string;
		editable?: boolean;
		selected?: string | null;
		flagged?: Set<string>;
		onselect?: (id: string, focus: string) => void;
		onaddbutton?: (rowId: string) => void;
		onaddinside?: (containerId: string) => void;
		onlanguage?: (code: ServerLanguage | null) => void;
		onpress: (actions: MessageAction[]) => void;
	} = $props();

	let openSelect = $state<string | null>(null);
	let picked = $state<string[]>([]);
	let revealed = $state<string[]>([]);

	const text = (value: Localized) => applyMessagePlaceholders(pickText(value, lang, doc.language), server);
	const markdown = (value: Localized) => discordMarkdown(text(value), context);
	const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined);
	const shownLanguage = $derived(doc.languages.includes(lang) ? lang : doc.language);
	const otherLanguages = $derived(messageLanguageChoices(doc, shownLanguage));
	const LANGUAGE_MENU = '@lang';
	const LANGUAGE_HINT = 'Added automatically because this message has translations. Members pick a language from it to read the message in that language.';

	function hit(id: string, focus = '') {
		if (!editable) return {};
		const choose = (event: Event) => {
			event.stopPropagation();
			event.preventDefault();
			onselect(id, focus);
		};
		return {
			role: 'button',
			tabindex: 0,
			onclick: choose,
			onkeydown: (event: KeyboardEvent) => {
				if (event.key === 'Enter' || event.key === ' ') choose(event);
			}
		};
	}

	function mark(id: string) {
		if (!editable) return '';
		return `dc-edit${selected === id ? ' dc-selected' : ''}${flagged.has(id) ? ' dc-flagged' : ''}`;
	}

	function embedVisible(embed: MessageEmbed) {
		return !!(
			text(embed.title).trim() ||
			text(embed.description).trim() ||
			text(embed.author).trim() ||
			text(embed.footer).trim() ||
			embed.fields.length ||
			embed.image ||
			embed.thumbnail
		);
	}

	function toggleSelect(select: SelectBlock) {
		if (openSelect === select.id) return closeSelect(select);
		openSelect = select.id;
		picked = [];
	}

	function closeSelect(select: SelectBlock) {
		const actions = select.options.filter((option) => picked.includes(option.id)).flatMap((option) => option.actions);
		const chose = picked.length > 0;
		openSelect = null;
		picked = [];
		if (chose) onpress(actions);
	}

	function choose(select: SelectBlock, optionId: string) {
		if (select.multiple) {
			picked = picked.includes(optionId) ? picked.filter((id) => id !== optionId) : [...picked, optionId];
			return;
		}
		picked = [optionId];
		closeSelect(select);
	}
</script>

{#snippet emoji(value: string)}
	{@const parsed = parseMessageEmoji(value)}
	{#if parsed?.id}
		<img class="dc-button-emoji" src="https://cdn.discordapp.com/emojis/{parsed.id}.{parsed.animated ? 'gif' : 'webp'}?size=48" alt="" />
	{:else if parsed}
		<span class="dc-button-emoji-text">{parsed.name}</span>
	{/if}
{/snippet}

{#snippet button(item: MessageButton, id: string, focus: string)}
	{@const label = text(item.label).trim()}
	{#if item.style === 'link' && !editable}
		<a class="dc-button dc-button-secondary" href={safeUrl(item.url)} target="_blank" rel="noreferrer">
			{@render emoji(item.emoji)}
			{#if label}<span>{label}</span>{/if}
			<i class="fas fa-arrow-up-right-from-square dc-button-link"></i>
		</a>
	{:else}
		<button
			type="button"
			class="dc-button dc-button-{item.style === 'link' ? 'secondary' : item.style} {mark(id)}"
			onclick={(event) => {
				if (!editable) return onpress(item.actions);
				event.stopPropagation();
				onselect(id, focus);
			}}
		>
			{@render emoji(item.emoji)}
			{#if label}<span>{label}</span>{:else if !item.emoji}<span class="dc-ghost">Button</span>{/if}
			{#if item.style === 'link'}<i class="fas fa-arrow-up-right-from-square dc-button-link"></i>{/if}
		</button>
	{/if}
{/snippet}

{#snippet row(block: RowBlock)}
	{#if block.type === 'buttons'}
		{#if block.buttons.length > 0 || editable}
			<div class="dc-row">
				{#each block.buttons as item (item.id)}
					{@render button(item, item.id, '')}
				{/each}
				{#if editable && block.buttons.length < MESSAGE_LIMITS.buttons}
					<button
						type="button"
						class="dc-add"
						title="Add a button"
						aria-label="Add a button"
						onclick={(event) => {
							event.stopPropagation();
							onaddbutton(block.id);
						}}
					>
						<i class="fas fa-plus"></i>
					</button>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="dc-select-wrap">
			<button
				type="button"
				class="dc-select {openSelect === block.id ? 'dc-select-open' : ''} {mark(block.id)}"
				onclick={(event) => {
					if (!editable) return toggleSelect(block);
					event.stopPropagation();
					onselect(block.id, '');
				}}
			>
				<span class="dc-select-placeholder">{text(block.placeholder).trim() || 'Make a selection'}</span>
				<i class="fas fa-chevron-down"></i>
			</button>
			{#if openSelect === block.id && !editable}
				<ul class="dc-select-menu">
					{#each block.options as option (option.id)}
						<li>
							<button type="button" class="dc-select-option" onclick={() => choose(block, option.id)}>
								{@render emoji(option.emoji)}
								<span class="dc-select-text">
									<span>{text(option.label).trim() || 'Choice'}</span>
									{#if text(option.description).trim()}<small>{text(option.description)}</small>{/if}
								</span>
								{#if block.multiple}
									<i class="fa{picked.includes(option.id) ? 's fa-square-check dc-checked' : 'r fa-square'}"></i>
								{/if}
							</button>
						</li>
					{/each}
					{#if block.multiple}
						<li><button type="button" class="dc-select-done" onclick={() => closeSelect(block)}>Done</button></li>
					{/if}
				</ul>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet media(value: string, id: string, spoiler: boolean, alt: string, part: string)}
	{@const hidden = spoiler && !editable && !revealed.includes(id)}
	<div class="dc-media {hidden ? 'dc-media-hidden' : ''} {part ? mark(part) : ''}" {...part ? hit(part) : {}}>
		{#if !value}
			<div class="dc-media-empty"><i class="fas fa-photo-film"></i><span>Add an image or video</span></div>
		{:else if isMessageVideo(value)}
			<video src={messageFilePreviewUrl(value)} controls={!editable} preload="metadata"><track kind="captions" /></video>
		{:else}
			<img src={messageFilePreviewUrl(value)} {alt} loading="lazy" />
		{/if}
		{#if hidden}
			<button type="button" class="dc-spoiler-cover" onclick={() => (revealed = [...revealed, id])}>SPOILER</button>
		{:else if spoiler}
			<span class="dc-spoiler-tag">SPOILER</span>
		{/if}
	</div>
{/snippet}

{#snippet inner(block: InnerBlock)}
	{#if block.type === 'text'}
		<div class="dc-markdown {mark(block.id)}" {...hit(block.id)}>
			{#if text(block.text).trim()}{@html markdown(block.text)}{:else}<span class="dc-ghost">Text</span>{/if}
		</div>
	{:else if block.type === 'section'}
		<div class="dc-section {mark(block.id)}" {...hit(block.id)}>
			<div class="dc-markdown dc-section-text">
				{#if text(block.text).trim()}{@html markdown(block.text)}{:else}<span class="dc-ghost">Text</span>{/if}
			</div>
			{#if block.accessory === 'button'}
				{@render button(block.button, block.id, 'button')}
			{:else if block.image}
				<img class="dc-section-thumb" src={messageFilePreviewUrl(block.image)} alt="" loading="lazy" />
			{:else}
				<span class="dc-section-thumb dc-thumb-empty"><i class="fas fa-image"></i></span>
			{/if}
		</div>
	{:else if block.type === 'gallery'}
		{@const items = editable ? block.items : block.items.filter((item) => item.media)}
		<div class="dc-gallery dc-gallery-{Math.max(1, Math.min(items.length, 3))} {mark(block.id)}" {...hit(block.id)}>
			{#each items as item (item.id)}
				{@render media(item.media, item.id, false, text(item.caption), '')}
			{:else}
				{#if editable}<div class="dc-media-empty"><i class="fas fa-photo-film"></i><span>Add an image or video</span></div>{/if}
			{/each}
		</div>
	{:else if block.type === 'separator'}
		<div class="dc-separator-hit {mark(block.id)}" {...hit(block.id)}>
			<div class="dc-separator {block.large ? 'dc-separator-large' : ''} {block.line ? 'dc-separator-line' : ''}"></div>
		</div>
	{:else}
		{@render row(block)}
	{/if}
{/snippet}

{#snippet languageControl()}
	{#if otherLanguages.length > 0}
		<div class="dc-select-wrap">
			<button
				type="button"
				class="dc-select dc-select-chosen {openSelect === LANGUAGE_MENU ? 'dc-select-open' : ''}"
				title={editable ? LANGUAGE_HINT : undefined}
				onclick={(event) => {
					event.stopPropagation();
					if (editable) return onlanguage(null);
					openSelect = openSelect === LANGUAGE_MENU ? null : LANGUAGE_MENU;
				}}
			>
				<span class="dc-select-placeholder">{MESSAGE_LANGUAGE_EMOJI} {serverLanguageLabel(shownLanguage)}</span>
				<i class="fas fa-chevron-down"></i>
			</button>
			{#if openSelect === LANGUAGE_MENU && !editable}
				<ul class="dc-select-menu">
					{#each doc.languages as code (code)}
						<li>
							<button
								type="button"
								class="dc-select-option"
								onclick={() => {
									openSelect = null;
									if (code !== shownLanguage) onlanguage(code);
								}}
							>
								<span class="dc-button-emoji-text">{MESSAGE_LANGUAGE_EMOJI}</span>
								<span class="dc-select-text"><span>{serverLanguageLabel(code)}</span></span>
								{#if code === shownLanguage}<i class="fas fa-check dc-checked"></i>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
{/snippet}

<div
	class="dc-body {editable ? 'dc-editing' : ''}"
	role="presentation"
	onclickcapture={(event) => {
		if (editable && (event.target as HTMLElement).closest('a')) event.preventDefault();
	}}
>
	{#if doc.layout === 'components'}
		{#each doc.blocks as block (block.id)}
			{#if block.type === 'container'}
				<div class="dc-container {mark(block.id)}" style={block.color ? `border-left: 4px solid ${block.color}` : ''} {...hit(block.id)}>
					{#each block.blocks as child (child.id)}
						{@render inner(child)}
					{:else}
						<div class="dc-ghost">Empty box</div>
					{/each}
					{#if editable && block.blocks.length < MESSAGE_LIMITS.innerBlocks}
						<button
							type="button"
							class="dc-add dc-add-wide"
							onclick={(event) => {
								event.stopPropagation();
								onaddinside(block.id);
							}}
						>
							<i class="fas fa-plus"></i>Add inside this box
						</button>
					{/if}
				</div>
			{:else}
				{@render inner(block)}
			{/if}
		{/each}
		{@render languageControl()}
	{:else}
		{#if text(doc.text).trim()}
			<div class="dc-markdown {mark('text')}" {...hit('text')}>{@html markdown(doc.text)}</div>
		{/if}
		{#if doc.attachments.length > 0}
			<div class="dc-gallery dc-gallery-{Math.min(doc.attachments.length, 2)} dc-attachments">
				{#each doc.attachments as attachment (attachment.id)}
					{@render media(attachment.file, attachment.id, attachment.spoiler, '', attachment.id)}
				{/each}
			</div>
		{/if}
		{#each doc.embeds as embed (embed.id)}
			{#if editable || embedVisible(embed)}
				<div class="dc-embed {mark(embed.id)}" style="border-left-color: {embed.color || '#1e1f22'}" {...hit(embed.id)}>
					<div class="dc-embed-grid">
						<div class="dc-embed-main">
							{#if text(embed.author).trim()}
								<div class="dc-embed-author" {...hit(embed.id, 'author')}>
									{#if embed.author_icon}<img src={messageFilePreviewUrl(embed.author_icon)} alt="" />{/if}
									{#if safeUrl(embed.author_url)}
										<a href={safeUrl(embed.author_url)} target="_blank" rel="noreferrer">{text(embed.author)}</a>
									{:else}
										<span>{text(embed.author)}</span>
									{/if}
								</div>
							{/if}
							{#if text(embed.title).trim()}
								<div class="dc-embed-title dc-markdown" {...hit(embed.id, 'title')}>
									{#if safeUrl(embed.url)}
										<a class="dc-link" href={safeUrl(embed.url)} target="_blank" rel="noreferrer">{@html markdown(embed.title)}</a>
									{:else}
										{@html markdown(embed.title)}
									{/if}
								</div>
							{:else if editable}
								<div class="dc-embed-title dc-ghost" {...hit(embed.id, 'title')}>Title</div>
							{/if}
							{#if text(embed.description).trim()}
								<div class="dc-embed-description dc-markdown" {...hit(embed.id, 'description')}>{@html markdown(embed.description)}</div>
							{:else if editable}
								<div class="dc-ghost" {...hit(embed.id, 'description')}>Description</div>
							{/if}
							{#if embed.fields.length > 0}
								<div class="dc-embed-fields" {...hit(embed.id, 'fields')}>
									{#each embed.fields as field (field.id)}
										<div class={field.inline ? 'dc-field-inline' : 'dc-field'}>
											<div class="dc-field-name dc-markdown">{@html markdown(field.name)}</div>
											<div class="dc-field-value dc-markdown">{@html markdown(field.value)}</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
						{#if embed.thumbnail}
							<img class="dc-embed-thumb" src={messageFilePreviewUrl(embed.thumbnail)} alt="" loading="lazy" {...hit(embed.id, 'thumbnail')} />
						{/if}
					</div>
					{#if embed.image}
						<img class="dc-embed-image" src={messageFilePreviewUrl(embed.image)} alt="" loading="lazy" {...hit(embed.id, 'image')} />
					{/if}
					{#if text(embed.footer).trim() || embed.timestamp}
						<div class="dc-embed-footer" {...hit(embed.id, 'footer')}>
							{#if embed.footer_icon && text(embed.footer).trim()}<img src={messageFilePreviewUrl(embed.footer_icon)} alt="" />{/if}
							<span>{[text(embed.footer).trim(), embed.timestamp && now ? `Today at ${now}` : ''].filter(Boolean).join(' • ')}</span>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
		{#each doc.rows as block (block.id)}
			{@render row(block)}
		{/each}
		{@render languageControl()}
	{/if}
</div>

<style>
	.dc-body {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		color: #dbdee1;
		font-size: 15px;
		line-height: 1.375;
	}

	.dc-body :global(.dc-edit) {
		scroll-margin-top: 16px;
		cursor: pointer;
		outline: 1px dashed transparent;
		outline-offset: 3px;
		border-radius: 6px;
		transition: outline-color 120ms ease;
	}

	.dc-body :global(.dc-edit:hover) {
		outline-color: rgba(255, 255, 255, 0.35);
	}

	.dc-body :global(.dc-flagged) {
		outline: 1px dashed #f0b232;
	}

	.dc-body :global(.dc-selected),
	.dc-body :global(.dc-selected:hover) {
		outline: 2px solid #5865f2;
	}

	.dc-editing video {
		pointer-events: none;
	}

	.dc-editing .dc-embed-author,
	.dc-editing .dc-embed-title,
	.dc-editing .dc-embed-description,
	.dc-editing .dc-embed-fields,
	.dc-editing .dc-embed-footer,
	.dc-editing .dc-embed-thumb,
	.dc-editing .dc-embed-image {
		cursor: text;
		border-radius: 4px;
	}

	.dc-editing .dc-embed-title:hover,
	.dc-editing .dc-embed-description:hover,
	.dc-editing .dc-embed-author:hover,
	.dc-editing .dc-embed-fields:hover,
	.dc-editing .dc-embed-footer:hover,
	.dc-editing .dc-embed .dc-ghost:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.dc-ghost {
		color: #80848e;
		font-style: italic;
		font-size: 13px;
	}

	.dc-add {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: 6px;
		transition:
			color 120ms ease,
			border-color 120ms ease;
		border: 1px dashed #4e5058;
		border-radius: 8px;
		width: 32px;
		height: 32px;
		color: #949ba4;
		font-size: 12px;
	}

	.dc-add:hover {
		border-color: #5865f2;
		color: #fff;
	}

	.dc-add-wide {
		align-self: flex-start;
		padding: 0 12px;
		width: auto;
		font-size: 13px;
	}

	.dc-markdown {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.dc-markdown :global(.dc-line),
	.dc-markdown :global(.dc-quote),
	.dc-markdown :global(.dc-li) {
		white-space: pre-wrap;
	}

	.dc-markdown :global(.dc-blank) {
		height: 1.375em;
	}

	.dc-markdown :global(.dc-h1) {
		margin: 6px 0 4px;
		color: #f2f3f5;
		font-weight: 700;
		font-size: 1.5em;
		line-height: 1.25;
	}

	.dc-markdown :global(.dc-h2) {
		margin: 6px 0 4px;
		color: #f2f3f5;
		font-weight: 700;
		font-size: 1.25em;
		line-height: 1.25;
	}

	.dc-markdown :global(.dc-h3) {
		margin: 6px 0 4px;
		color: #f2f3f5;
		font-weight: 700;
		font-size: 1em;
	}

	.dc-markdown :global(.dc-subtext) {
		color: #949ba4;
		font-size: 0.8125em;
	}

	.dc-markdown :global(.dc-quote) {
		border-left: 4px solid #4e5058;
		padding-left: 12px;
	}

	.dc-markdown :global(.dc-li) {
		display: flex;
		gap: 8px;
		padding-left: 6px;
	}

	.dc-markdown :global(.dc-link) {
		color: #00a8fc;
		text-decoration: none;
	}

	.dc-markdown :global(.dc-link:hover) {
		text-decoration: underline;
	}

	.dc-markdown :global(.dc-mention) {
		border-radius: 3px;
		background: rgba(88, 101, 242, 0.3);
		padding: 0 2px;
		color: #c9cdfb;
		font-weight: 500;
	}

	.dc-markdown :global(.dc-time) {
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.06);
		padding: 0 2px;
	}

	.dc-markdown :global(.dc-code) {
		border-radius: 4px;
		background: #1e1f22;
		padding: 0.1em 0.3em;
		font-size: 0.85em;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	.dc-markdown :global(.dc-codeblock) {
		margin: 4px 0;
		border: 1px solid #1e1f22;
		border-radius: 4px;
		background: #1e1f22;
		padding: 8px;
		overflow-x: auto;
		font-size: 0.85em;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		white-space: pre;
	}

	.dc-markdown :global(.dc-spoiler) {
		border-radius: 3px;
		background: #1e1f22;
		color: transparent;
	}

	.dc-markdown :global(.dc-spoiler:hover) {
		background: #3f4147;
		color: inherit;
	}

	.dc-markdown :global(.dc-emoji) {
		display: inline-block;
		vertical-align: bottom;
		width: 1.375em;
		height: 1.375em;
		object-fit: contain;
	}

	.dc-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border: 1px solid #36363c;
		border-radius: 8px;
		background: #242429;
		padding: 16px;
		max-width: 600px;
	}

	.dc-section {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.dc-section-text {
		flex: 1;
	}

	.dc-section-thumb {
		flex-shrink: 0;
		border-radius: 8px;
		width: 80px;
		height: 80px;
		object-fit: cover;
	}

	.dc-thumb-empty {
		display: grid;
		place-items: center;
		border: 1px dashed #4e5058;
		color: #80848e;
	}

	.dc-gallery {
		display: grid;
		gap: 4px;
		border-radius: 8px;
		max-width: 520px;
		overflow: hidden;
	}

	.dc-gallery-1 {
		grid-template-columns: 1fr;
	}

	.dc-gallery-2 {
		grid-template-columns: repeat(2, 1fr);
	}

	.dc-gallery-3 {
		grid-template-columns: repeat(3, 1fr);
	}

	.dc-media {
		position: relative;
		background: #1e1f22;
		min-height: 64px;
		overflow: hidden;
	}

	.dc-media img,
	.dc-media video {
		display: block;
		width: 100%;
		height: 100%;
		max-height: 340px;
		object-fit: cover;
	}

	.dc-gallery-1 .dc-media img,
	.dc-gallery-1 .dc-media video {
		object-fit: contain;
	}

	.dc-media-empty {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 6px;
		border: 1px dashed #4e5058;
		border-radius: 8px;
		min-height: 96px;
		color: #80848e;
		font-size: 13px;
	}

	.dc-media-hidden img,
	.dc-media-hidden video {
		filter: blur(36px);
	}

	.dc-spoiler-cover,
	.dc-spoiler-tag {
		position: absolute;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.7);
		padding: 6px 12px;
		color: #fff;
		font-weight: 700;
		font-size: 13px;
		letter-spacing: 0.04em;
	}

	.dc-spoiler-cover {
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
	}

	.dc-spoiler-tag {
		top: 8px;
		left: 8px;
		padding: 3px 8px;
		font-size: 11px;
	}

	.dc-separator-hit {
		padding: 4px 0;
	}

	.dc-separator {
		height: 1px;
	}

	.dc-separator-line {
		background: #3a3a41;
	}

	.dc-separator-large {
		margin: 8px 0;
	}

	.dc-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.dc-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: filter 120ms ease;
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 0 14px;
		max-width: 100%;
		height: 32px;
		color: #fff;
		font-weight: 500;
		font-size: 14px;
		text-decoration: none;
		white-space: nowrap;
	}

	.dc-button:hover {
		filter: brightness(1.15);
	}

	.dc-button span {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dc-button-secondary {
		border-color: #3d3d45;
		background: #2e2e34;
	}

	.dc-button-primary {
		background: #5865f2;
	}

	.dc-button-success {
		background: #00863a;
	}

	.dc-button-danger {
		background: #d22d39;
	}

	.dc-button-link {
		opacity: 0.8;
		font-size: 11px;
	}

	.dc-button-emoji {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		object-fit: contain;
	}

	.dc-button-emoji-text {
		flex-shrink: 0;
		font-size: 16px;
		line-height: 1;
	}

	.dc-select-wrap {
		position: relative;
		max-width: 400px;
	}

	.dc-select {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		border: 1px solid #3d3d45;
		border-radius: 8px;
		background: #1e1f22;
		padding: 0 12px;
		width: 100%;
		height: 40px;
		color: #949ba4;
		font-size: 14px;
		text-align: left;
	}

	.dc-select-open {
		border-color: #5865f2;
	}

	.dc-select-chosen {
		color: #dbdee1;
	}

	.dc-select-placeholder {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dc-select-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		left: 0;
		z-index: 10;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
		border: 1px solid #3d3d45;
		border-radius: 8px;
		background: #2b2d31;
		padding: 4px;
		max-height: 240px;
		overflow-y: auto;
	}

	.dc-select-option {
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: 6px;
		padding: 6px 8px;
		width: 100%;
		color: #dbdee1;
		font-size: 14px;
		text-align: left;
	}

	.dc-select-option:hover {
		background: #3a3c43;
	}

	.dc-select-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.dc-select-text small {
		color: #949ba4;
		font-size: 12px;
	}

	.dc-checked {
		color: #5865f2;
	}

	.dc-select-done {
		margin-top: 4px;
		border-radius: 6px;
		background: #5865f2;
		padding: 6px;
		width: 100%;
		color: #fff;
		font-weight: 500;
		font-size: 13px;
	}

	.dc-attachments {
		max-width: 420px;
	}

	.dc-embed {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-left: 4px solid #1e1f22;
		border-radius: 4px;
		background: #242429;
		padding: 10px 14px 14px 12px;
		max-width: 520px;
		font-size: 14px;
	}

	.dc-embed-grid {
		display: flex;
		gap: 16px;
	}

	.dc-embed-main {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.dc-embed-author {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #f2f3f5;
		font-weight: 600;
		font-size: 13px;
	}

	.dc-embed-author img {
		border-radius: 50%;
		width: 24px;
		height: 24px;
		object-fit: cover;
	}

	.dc-embed-author a {
		color: inherit;
	}

	.dc-embed-title {
		color: #f2f3f5;
		font-weight: 700;
		font-size: 16px;
	}

	.dc-embed-title.dc-ghost {
		color: #80848e;
		font-style: italic;
		font-weight: 600;
	}

	.dc-embed-fields {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.dc-field {
		grid-column: 1 / -1;
	}

	.dc-field-name {
		margin-bottom: 2px;
		color: #f2f3f5;
		font-weight: 600;
		font-size: 13px;
	}

	.dc-embed-thumb {
		flex-shrink: 0;
		border-radius: 4px;
		width: 80px;
		height: 80px;
		object-fit: cover;
	}

	.dc-embed-image {
		border-radius: 4px;
		max-width: 100%;
		max-height: 340px;
		object-fit: contain;
		object-position: left;
	}

	.dc-embed-footer {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #b5bac1;
		font-size: 12px;
	}

	.dc-embed-footer img {
		border-radius: 50%;
		width: 20px;
		height: 20px;
		object-fit: cover;
	}
</style>
