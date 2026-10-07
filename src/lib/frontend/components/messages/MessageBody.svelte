<script lang="ts">
	import type { ServerLanguage } from '$lib/languages.js';
	import {
		applyMessagePlaceholders,
		isMessageVideo,
		messageFilePreviewUrl,
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

	let {
		doc,
		lang,
		server,
		context,
		now,
		onpress
	}: {
		doc: MessageDoc;
		lang: ServerLanguage;
		server: string;
		context: MarkdownContext;
		now: string;
		onpress: (actions: MessageAction[]) => void;
	} = $props();

	let openSelect = $state<string | null>(null);
	let picked = $state<string[]>([]);
	let revealed = $state<string[]>([]);

	const text = (value: Localized) => applyMessagePlaceholders(pickText(value, lang, doc.language), server);
	const markdown = (value: Localized) => discordMarkdown(text(value), context);

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

{#snippet button(item: MessageButton)}
	{@const label = text(item.label).trim()}
	{#if item.style === 'link'}
		<a class="dc-button dc-button-secondary" href={item.url || undefined} target="_blank" rel="noreferrer">
			{@render emoji(item.emoji)}
			{#if label}<span>{label}</span>{/if}
			<i class="fas fa-arrow-up-right-from-square dc-button-link"></i>
		</a>
	{:else}
		<button type="button" class="dc-button dc-button-{item.style}" onclick={() => onpress(item.actions)}>
			{@render emoji(item.emoji)}
			{#if label}<span>{label}</span>{:else if !item.emoji}<span class="dc-ghost">Button</span>{/if}
		</button>
	{/if}
{/snippet}

{#snippet row(block: RowBlock)}
	{#if block.type === 'buttons'}
		{#if block.buttons.length > 0}
			<div class="dc-row">
				{#each block.buttons as item (item.id)}
					{@render button(item)}
				{/each}
			</div>
		{/if}
	{:else}
		<div class="dc-select-wrap">
			<button type="button" class="dc-select {openSelect === block.id ? 'dc-select-open' : ''}" onclick={() => toggleSelect(block)}>
				<span class="dc-select-placeholder">{text(block.placeholder).trim() || 'Make a selection'}</span>
				<i class="fas fa-chevron-down"></i>
			</button>
			{#if openSelect === block.id}
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

{#snippet media(value: string, id: string, spoiler: boolean, alt: string)}
	{@const hidden = spoiler && !revealed.includes(id)}
	<div class="dc-media {hidden ? 'dc-media-hidden' : ''}">
		{#if isMessageVideo(value)}
			<video src={messageFilePreviewUrl(value)} controls preload="metadata"><track kind="captions" /></video>
		{:else}
			<img src={messageFilePreviewUrl(value)} {alt} loading="lazy" />
		{/if}
		{#if hidden}
			<button type="button" class="dc-spoiler-cover" onclick={() => (revealed = [...revealed, id])}>SPOILER</button>
		{/if}
	</div>
{/snippet}

{#snippet inner(block: InnerBlock)}
	{#if block.type === 'text'}
		{#if text(block.text).trim()}
			<div class="dc-markdown">{@html markdown(block.text)}</div>
		{:else}
			<div class="dc-ghost">Text</div>
		{/if}
	{:else if block.type === 'section'}
		<div class="dc-section">
			<div class="dc-markdown dc-section-text">
				{#if text(block.text).trim()}{@html markdown(block.text)}{:else}<span class="dc-ghost">Section text</span>{/if}
			</div>
			{#if block.accessory === 'button'}
				{@render button(block.button)}
			{:else if block.image}
				<img class="dc-section-thumb" src={messageFilePreviewUrl(block.image)} alt="" loading="lazy" />
			{:else}
				<span class="dc-section-thumb dc-thumb-empty"><i class="fas fa-image"></i></span>
			{/if}
		</div>
	{:else if block.type === 'gallery'}
		{@const items = block.items.filter((item) => item.media)}
		{#if items.length > 0}
			<div class="dc-gallery dc-gallery-{Math.min(items.length, 3)}">
				{#each items as item (item.id)}
					{@render media(item.media, item.id, false, text(item.caption))}
				{/each}
			</div>
		{:else}
			<div class="dc-gallery-empty"><i class="fas fa-images"></i></div>
		{/if}
	{:else if block.type === 'separator'}
		<div class="dc-separator {block.large ? 'dc-separator-large' : ''} {block.line ? 'dc-separator-line' : ''}"></div>
	{:else}
		{@render row(block)}
	{/if}
{/snippet}

<div class="dc-body">
	{#if doc.layout === 'components'}
		{#each doc.blocks as block (block.id)}
			{#if block.type === 'container'}
				<div class="dc-container" style={block.color ? `border-left: 4px solid ${block.color}` : ''}>
					{#each block.blocks as child (child.id)}
						{@render inner(child)}
					{:else}
						<div class="dc-ghost">Empty container</div>
					{/each}
				</div>
			{:else}
				{@render inner(block)}
			{/if}
		{:else}
			<div class="dc-ghost">Add a block to see it here.</div>
		{/each}
	{:else}
		{#if text(doc.text).trim()}
			<div class="dc-markdown">{@html markdown(doc.text)}</div>
		{/if}
		{#if doc.attachments.length > 0}
			<div class="dc-gallery dc-gallery-{Math.min(doc.attachments.length, 2)} dc-attachments">
				{#each doc.attachments as attachment (attachment.id)}
					{@render media(attachment.file, attachment.id, attachment.spoiler, '')}
				{/each}
			</div>
		{/if}
		{#each doc.embeds as embed (embed.id)}
			{#if embedVisible(embed)}
				<div class="dc-embed" style="border-left-color: {embed.color || '#1e1f22'}">
					<div class="dc-embed-grid">
						<div class="dc-embed-main">
							{#if text(embed.author).trim()}
								<div class="dc-embed-author">
									{#if embed.author_icon}<img src={messageFilePreviewUrl(embed.author_icon)} alt="" />{/if}
									{#if embed.author_url}
										<a href={embed.author_url} target="_blank" rel="noreferrer">{text(embed.author)}</a>
									{:else}
										<span>{text(embed.author)}</span>
									{/if}
								</div>
							{/if}
							{#if text(embed.title).trim()}
								<div class="dc-embed-title dc-markdown">
									{#if embed.url}
										<a class="dc-link" href={embed.url} target="_blank" rel="noreferrer">{@html markdown(embed.title)}</a>
									{:else}
										{@html markdown(embed.title)}
									{/if}
								</div>
							{/if}
							{#if text(embed.description).trim()}
								<div class="dc-embed-description dc-markdown">{@html markdown(embed.description)}</div>
							{/if}
							{#if embed.fields.length > 0}
								<div class="dc-embed-fields">
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
							<img class="dc-embed-thumb" src={messageFilePreviewUrl(embed.thumbnail)} alt="" loading="lazy" />
						{/if}
					</div>
					{#if embed.image}
						<img class="dc-embed-image" src={messageFilePreviewUrl(embed.image)} alt="" loading="lazy" />
					{/if}
					{#if text(embed.footer).trim() || embed.timestamp}
						<div class="dc-embed-footer">
							{#if embed.footer_icon && text(embed.footer).trim()}<img src={messageFilePreviewUrl(embed.footer_icon)} alt="" />{/if}
							<span>{[text(embed.footer).trim(), embed.timestamp ? `Today at ${now}` : ''].filter(Boolean).join(' • ')}</span>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
		{#each doc.rows as block (block.id)}
			{@render row(block)}
		{/each}
		{#if !text(doc.text).trim() && doc.attachments.length === 0 && doc.rows.length === 0 && !doc.embeds.some(embedVisible)}
			<div class="dc-ghost">Start typing to see your message here.</div>
		{/if}
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

	.dc-ghost {
		color: #80848e;
		font-style: italic;
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
		font-size: 1.5em;
		font-weight: 700;
		line-height: 1.25;
	}

	.dc-markdown :global(.dc-h2) {
		margin: 6px 0 4px;
		color: #f2f3f5;
		font-size: 1.25em;
		font-weight: 700;
		line-height: 1.25;
	}

	.dc-markdown :global(.dc-h3) {
		margin: 6px 0 4px;
		color: #f2f3f5;
		font-size: 1em;
		font-weight: 700;
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
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.85em;
	}

	.dc-markdown :global(.dc-codeblock) {
		margin: 4px 0;
		border: 1px solid #1e1f22;
		border-radius: 4px;
		background: #1e1f22;
		padding: 8px;
		overflow-x: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.85em;
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
		width: 1.375em;
		height: 1.375em;
		vertical-align: bottom;
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

	.dc-thumb-empty,
	.dc-gallery-empty {
		display: grid;
		place-items: center;
		border: 1px dashed #4e5058;
		color: #80848e;
	}

	.dc-gallery-empty {
		border-radius: 8px;
		height: 96px;
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

	.dc-media-hidden img,
	.dc-media-hidden video {
		filter: blur(36px);
	}

	.dc-spoiler-cover {
		position: absolute;
		inset: 0;
		margin: auto;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.7);
		padding: 6px 12px;
		width: fit-content;
		height: fit-content;
		color: #fff;
		font-weight: 700;
		font-size: 13px;
		letter-spacing: 0.04em;
	}

	.dc-separator {
		margin: 0;
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
		transition: filter 120ms ease;
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
		border: 1px solid #3d3d45;
		border-radius: 8px;
		background: #2b2d31;
		padding: 4px;
		max-height: 240px;
		overflow-y: auto;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
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
