<script lang="ts">
	import { IMAGE_ACCEPT } from '$lib/images.js';
	import { SERVER_LANGUAGES, serverLanguageLabel, type ServerLanguage } from '$lib/languages.js';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import {
		MESSAGE_LIMITS,
		MESSAGE_VIDEO_ACCEPT,
		messageReplyDoc,
		messageRowLimit,
		type MessageAction,
		type MessageBlockType,
		type MessageDoc
	} from '$lib/messages.js';
	import EmojiPicker from './EmojiPicker.svelte';
	import MessageBody from './MessageBody.svelte';
	import { clickOutside, messageEditor } from './editorContext.js';
	import { discordMarkdown, type MarkdownContext } from './discordMarkdown.js';
	import TagPicker from './TagPicker.svelte';

	type Reply = { key: number; doc: MessageDoc | null; lines: string[]; lang: ServerLanguage | null };
	type AddType = 'embed' | 'file' | MessageBlockType;
	type AddItem = { type: AddType; label: string; hint: string; icon: string; full: boolean };

	let {
		doc = $bindable(),
		lang = $bindable(),
		mode = $bindable('edit'),
		menuOpen = $bindable(false),
		channel,
		server,
		bot,
		context,
		resolve,
		selected,
		flagged,
		insideBox,
		uploading,
		onselect,
		onclear,
		onadd,
		onfile,
		onaddbutton,
		onaddinside,
		onremovelanguage
	}: {
		doc: MessageDoc;
		lang: ServerLanguage;
		mode: 'edit' | 'try';
		menuOpen: boolean;
		channel: string;
		server: string;
		bot: { name: string; avatar: string | null };
		context: MarkdownContext;
		resolve: (messageId: number) => MessageDoc | null;
		selected: string | null;
		flagged: Set<string>;
		insideBox: boolean;
		uploading: number | null;
		onselect: (id: string, focus: string) => void;
		onclear: () => void;
		onadd: (type: Exclude<AddType, 'file'>) => void;
		onfile: (file: File) => void;
		onaddbutton: (rowId: string) => void;
		onaddinside: (containerId: string) => void;
		onremovelanguage: (code: ServerLanguage) => void;
	} = $props();

	const editor = messageEditor();

	let replies = $state<Reply[]>([]);
	let held = $state<string[]>([]);
	let now = $state('');
	let nextKey = 0;
	let languageOpen = $state(false);
	let layoutOpen = $state(false);
	let emojiOpen = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let textInput = $state<HTMLTextAreaElement>();

	const LAYOUTS = [
		{ id: 'standard', label: 'Standard', hint: 'Text, photos, videos, embeds, buttons and dropdowns. Start here.' },
		{ id: 'components', label: 'Advanced layout', hint: 'Components V2: boxes with a colored edge, text beside an image, dividers and galleries.' }
	] as const;

	const editing = $derived(mode === 'edit');
	const standard = $derived(doc.layout === 'standard');
	const translating = $derived(lang !== doc.language);
	const messageText = $derived(doc.text[lang] ?? '');
	const hasContent = $derived(
		standard ? !!(doc.text[doc.language] ?? '').trim() || doc.attachments.length > 0 || doc.embeds.length > 0 || doc.rows.length > 0 : doc.blocks.length > 0
	);
	const otherLanguages = $derived(SERVER_LANGUAGES.filter((language) => !doc.languages.includes(language.code)));
	const rowsFull = $derived(doc.rows.length >= messageRowLimit(doc));
	const buttonRoom = $derived.by(() => {
		const last = doc.rows[doc.rows.length - 1];
		return last?.type === 'buttons' && last.buttons.length < MESSAGE_LIMITS.buttons;
	});
	const items = $derived<AddItem[]>(
		standard
			? [
					{
						type: 'embed',
						label: 'Embed',
						hint: 'A box with a title, text and an image',
						icon: 'fa-window-maximize',
						full: doc.embeds.length >= MESSAGE_LIMITS.embeds
					},
					{
						type: 'file',
						label: 'Photo or video',
						hint: 'Attached like a normal upload',
						icon: 'fa-photo-film',
						full: doc.attachments.length >= MESSAGE_LIMITS.attachments
					},
					{
						type: 'buttons',
						label: 'Button',
						hint: 'Replies privately, gives a role or links somewhere',
						icon: 'fa-hand-pointer',
						full: rowsFull && !buttonRoom
					},
					{ type: 'select', label: 'Dropdown', hint: 'A menu of choices, great for picking roles', icon: 'fa-list', full: rowsFull }
				]
			: [
					{ type: 'text', label: 'Text', hint: 'A paragraph or a heading', icon: 'fa-align-left', full: false },
					...(insideBox
						? []
						: [{ type: 'container' as const, label: 'Box', hint: 'A box with a colored edge that holds other parts', icon: 'fa-square', full: false }]),
					{
						type: 'section',
						label: 'Text with image or button',
						hint: 'Text on the left, a small image or a button on the right',
						icon: 'fa-table-columns',
						full: false
					},
					{ type: 'gallery', label: 'Images and videos', hint: 'One to ten, shown as a gallery', icon: 'fa-images', full: false },
					{ type: 'separator', label: 'Divider', hint: 'A line or a gap', icon: 'fa-minus', full: false },
					{ type: 'buttons', label: 'Button', hint: 'Replies privately, gives a role or links somewhere', icon: 'fa-hand-pointer', full: false },
					{ type: 'select', label: 'Dropdown', hint: 'A menu of choices, great for picking roles', icon: 'fa-list', full: false }
				]
	);

	$effect(() => {
		now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	});

	$effect(() => {
		if (selected === 'text') textInput?.focus();
	});

	function setText(next: string) {
		if (next) doc.text[lang] = next;
		else delete doc.text[lang];
	}

	function insertEmoji(value: string) {
		const start = textInput?.selectionStart ?? messageText.length;
		const end = textInput?.selectionEnd ?? start;
		setText((messageText.slice(0, start) + value + messageText.slice(end)).slice(0, MESSAGE_LIMITS.text));
		emojiOpen = false;
		textInput?.focus();
	}

	function add(item: AddItem) {
		if (item.full) return;
		menuOpen = false;
		if (item.type === 'file') fileInput?.click();
		else onadd(item.type);
	}

	function roleLines(actions: MessageAction[]): string[] {
		const lines: string[] = [];
		for (const action of actions) {
			if (action.type !== 'role') continue;
			if (!action.role_id) {
				lines.push('❌ No role is picked for this yet.');
				continue;
			}
			const mention = `<@&${action.role_id}>`;
			const has = held.includes(action.role_id);
			const give = action.mode === 'add' || (action.mode === 'toggle' && !has);
			if (give === has) lines.push(give ? `You already have ${mention}.` : `You don't have ${mention}.`);
			else if (give) {
				held = [...held, action.role_id];
				lines.push(`✅ You now have ${mention}.`);
			} else {
				held = held.filter((id) => id !== action.role_id);
				lines.push(`✅ ${mention} was removed from you.`);
			}
		}
		return lines;
	}

	function press(actions: MessageAction[], from: Reply | null) {
		const show = actions.find((action) => action.type === 'show');
		const target = show ? (show.message_id ? resolve(show.message_id) : null) : null;
		const written = messageReplyDoc(actions, from?.doc ?? doc);
		const lines = roleLines(actions);
		if (actions.length === 0) lines.push('Nothing happens yet. Switch to Edit, click it and pick what it does.');
		if (show && !target) lines.push(show.message_id ? '❌ The message this shows no longer exists.' : '❌ No message is picked for this yet.');
		if (!written && actions.some((action) => action.type === 'text' || action.type === 'attachment')) {
			lines.push('❌ The message or attachment for this is still empty.');
		}

		if (target) {
			const inPlace = from?.doc && (target.layout === 'components' || from.doc.layout !== 'components');
			if (from && inPlace) from.doc = target;
			else replies.push({ key: nextKey++, doc: target, lines: [], lang: from?.lang ?? null });
		}
		if (written) replies.push({ key: nextKey++, doc: written, lines: [], lang: from?.lang ?? null });
		if (lines.length > 0) replies.push({ key: nextKey++, doc: null, lines, lang: from?.lang ?? null });
	}

	function switchLanguage(code: ServerLanguage, from: Reply | null) {
		if (from) from.lang = code;
		else replies.push({ key: nextKey++, doc, lines: [], lang: code });
	}
</script>

{#snippet author()}
	<div class="dc-author">
		<span class="dc-name">{bot.name}</span>
		<span class="dc-tag">APP</span>
		<span class="dc-timestamp">{now}</span>
	</div>
{/snippet}

{#snippet avatar()}
	{#if bot.avatar}
		<img class="dc-avatar" src={bot.avatar} alt="" />
	{:else}
		<span class="dc-avatar dc-avatar-empty"><i class="fas fa-robot"></i></span>
	{/if}
{/snippet}

<div class="dc-frame">
	<div class="dc-top">
		<span class="dc-channel"><i class="fas fa-hashtag"></i>{channel}</span>

		<div class="dc-switch" role="group" aria-label="Mode">
			<button type="button" aria-pressed={editing} class={editing ? 'dc-switch-on' : ''} onclick={() => (mode = 'edit')}>
				<i class="fas fa-pen"></i>Edit
			</button>
			<button
				type="button"
				aria-pressed={!editing}
				class={editing ? '' : 'dc-switch-on'}
				title="Click the buttons like a member would"
				onclick={() => {
					mode = 'try';
					onclear();
				}}
			>
				<i class="fas fa-play"></i>Try it
			</button>
		</div>

		<div class="relative" use:clickOutside={() => (languageOpen = false)}>
			<button type="button" class="dc-chip" aria-expanded={languageOpen} onclick={() => (languageOpen = !languageOpen)}>
				<i class="fas fa-language"></i>{serverLanguageLabel(lang)}{doc.languages.length > 1 ? ` · ${doc.languages.length}` : ''}
				<i class="fas fa-chevron-down dc-chip-caret"></i>
			</button>
			{#if languageOpen}
				<div class="bg-ash-800 border-ash-600 absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border p-2 shadow-2xl">
					<p class="text-ash-400 px-2 pt-1 pb-2 text-xs">
						Translate this message. {editor.roleActions
							? 'A member who clicks a button gets the reply in the language they picked in the bot menu.'
							: 'Each server gets the post in its own language.'} Anything left untranslated uses the main text.
					</p>
					{#each doc.languages as code (code)}
						<div class="flex items-center gap-1">
							<button
								type="button"
								class="hover:bg-ash-700 text-ash-100 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
								onclick={() => {
									lang = code;
									languageOpen = false;
								}}
							>
								<i class="fas fa-check text-xs {lang === code ? 'text-emerald-400' : 'text-transparent'}"></i>
								<span class="truncate">{serverLanguageLabel(code)}</span>
								{#if code === doc.language}<span class="text-ash-500 text-xs">main</span>{/if}
							</button>
							{#if code !== doc.language}
								<button
									type="button"
									class="text-ash-400 hover:bg-ash-700 grid size-7 place-items-center rounded-md text-xs hover:text-red-300"
									aria-label="Remove {serverLanguageLabel(code)}"
									onclick={() => {
										languageOpen = false;
										onremovelanguage(code);
									}}
								>
									<i class="fas fa-trash"></i>
								</button>
							{/if}
						</div>
					{/each}
					{#if otherLanguages.length > 0}
						<p class="text-ash-500 border-ash-700 mt-2 border-t px-2 pt-2 pb-1 text-[11px] font-semibold uppercase">Add a language</p>
						<div class="grid max-h-40 grid-cols-2 gap-0.5 overflow-y-auto">
							{#each otherLanguages as language (language.code)}
								<button
									type="button"
									class="hover:bg-ash-700 text-ash-200 truncate rounded-lg px-2 py-1.5 text-left text-xs"
									onclick={() => {
										doc.languages.push(language.code);
										lang = language.code;
										languageOpen = false;
									}}
								>
									<i class="fas fa-plus mr-1 text-[10px] text-emerald-400"></i>{language.name}
								</button>
							{/each}
						</div>
					{/if}
					{#if doc.languages.length > 1}
						<div class="border-ash-700 mt-2 border-t px-2 pt-3 pb-1">
							<ConfigToggleRow
								label="Language selector on the message"
								description="Members pick a language from it to read the message privately, whatever language the server uses."
								bind:enabled={doc.language_switch}
							/>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="relative" use:clickOutside={() => (layoutOpen = false)}>
			<button type="button" class="dc-chip" aria-expanded={layoutOpen} onclick={() => (layoutOpen = !layoutOpen)}>
				<i class="fas fa-layer-group"></i>{standard ? 'Standard' : 'Advanced'}
				<i class="fas fa-chevron-down dc-chip-caret"></i>
			</button>
			{#if layoutOpen}
				<div class="bg-ash-800 border-ash-600 absolute right-0 z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border p-2 shadow-2xl">
					{#each LAYOUTS as layout (layout.id)}
						<button
							type="button"
							class="hover:bg-ash-700 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left"
							onclick={() => {
								doc.layout = layout.id;
								layoutOpen = false;
								onclear();
							}}
						>
							<i class="fas fa-check mt-1 text-xs {doc.layout === layout.id ? 'text-emerald-400' : 'text-transparent'}"></i>
							<span>
								<span class="text-ash-100 block text-sm font-semibold">{layout.label}</span>
								<span class="text-ash-400 block text-xs">{layout.hint}</span>
							</span>
						</button>
					{/each}
					<p class="text-ash-500 px-2 pt-1 pb-1 text-[11px]">Each layout keeps its own content. Only the one you pick is sent.</p>
				</div>
			{/if}
		</div>
	</div>

	<div class="dc-chat" role="presentation" onclick={onclear}>
		<div class="dc-message">
			{@render avatar()}
			<div class="dc-content">
				{@render author()}
				{#if hasContent}
					<MessageBody
						{doc}
						{lang}
						{server}
						{context}
						{now}
						editable={editing}
						{selected}
						{flagged}
						{onselect}
						{onaddbutton}
						{onaddinside}
						onlanguage={(code) => {
							if (code) switchLanguage(code, null);
							else languageOpen = true;
						}}
						onpress={(actions) => press(actions, null)}
					/>
				{:else}
					<p class="dc-empty">
						{standard
							? 'Your message is empty. Type in the box below, or press + to add an embed, a photo or a button.'
							: 'Nothing here yet. Press + below to add your first part.'}
					</p>
				{/if}
				{#if uploading !== null}
					<p class="dc-uploading"><i class="fas fa-spinner fa-spin"></i>Uploading {Math.round(uploading * 100)}%</p>
				{/if}
			</div>
		</div>

		{#each replies as reply (reply.key)}
			<div class="dc-message dc-ephemeral">
				{@render avatar()}
				<div class="dc-content">
					{@render author()}
					{#if reply.doc}
						<MessageBody
							doc={reply.doc}
							lang={reply.lang ?? lang}
							{server}
							{context}
							{now}
							onlanguage={(code) => code && switchLanguage(code, reply)}
							onpress={(actions) => press(actions, reply)}
						/>
					{:else}
						<div class="dc-result">
							{#each reply.lines as line, i (i)}
								<div>{@html discordMarkdown(line, context)}</div>
							{/each}
						</div>
					{/if}
					<div class="dc-only-you">
						<i class="fas fa-eye"></i>Only you can see this •
						<button type="button" onclick={() => (replies = replies.filter((entry) => entry.key !== reply.key))}>Dismiss message</button>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="dc-composer relative">
		<div class="relative" use:clickOutside={() => (menuOpen = false)}>
			<button type="button" class="dc-plus" aria-label="Add to the message" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
				<i class="fas fa-plus"></i>
			</button>
			{#if menuOpen}
				<div class="bg-ash-800 border-ash-600 absolute bottom-full left-0 z-30 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border p-2 shadow-2xl">
					<p class="text-ash-500 px-2 pt-1 pb-2 text-[11px] font-semibold uppercase">{insideBox ? 'Add inside the selected box' : 'Add to the message'}</p>
					{#each items as item (item.type)}
						<button
							type="button"
							disabled={item.full}
							class="hover:bg-ash-700 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40"
							onclick={() => add(item)}
						>
							<span class="bg-ash-700 text-ash-200 grid size-8 shrink-0 place-items-center rounded-lg"><i class="fas {item.icon} text-sm"></i></span>
							<span class="min-w-0">
								<span class="text-ash-100 block text-sm font-semibold">{item.label}</span>
								<span class="text-ash-400 block truncate text-xs">{item.full ? 'This message already has the most Discord allows' : item.hint}</span>
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if standard}
			<textarea
				bind:this={textInput}
				value={messageText}
				oninput={(event) => setText(event.currentTarget.value)}
				maxlength={MESSAGE_LIMITS.text}
				rows={Math.min(8, Math.max(1, messageText.split('\n').length))}
				aria-label="What the bot says"
				placeholder={translating && doc.text[doc.language] ? doc.text[doc.language] : `Write what the bot says in #${channel}`}
				class="dc-input"></textarea>
			<TagPicker target={textInput} max={MESSAGE_LIMITS.text} placement="above" onchange={setText} />
			<span class="dc-count {messageText.length >= MESSAGE_LIMITS.text * 0.9 ? 'dc-count-near' : ''}">{messageText.length}/{MESSAGE_LIMITS.text}</span>
			<div class="relative" use:clickOutside={() => (emojiOpen = false)}>
				<button type="button" class="dc-emoji-button" aria-label="Add an emoji" aria-expanded={emojiOpen} onclick={() => (emojiOpen = !emojiOpen)}>
					<i class="fas fa-face-smile"></i>
				</button>
				{#if emojiOpen}
					<div class="absolute right-0 bottom-full z-30 mb-2 w-80 max-w-[calc(100vw-3rem)] shadow-2xl"><EmojiPicker onpick={insertEmoji} /></div>
				{/if}
			</div>
		{:else}
			<span class="dc-input dc-input-hint">Press + to add a part, then click it in the message to edit it.</span>
		{/if}

		<input
			bind:this={fileInput}
			type="file"
			accept="{IMAGE_ACCEPT},{MESSAGE_VIDEO_ACCEPT}"
			class="hidden"
			onchange={(event) => {
				const file = event.currentTarget.files?.[0];
				event.currentTarget.value = '';
				if (file) onfile(file);
			}}
		/>
	</div>
</div>

<style>
	.dc-frame {
		display: flex;
		flex-direction: column;
		border: 1px solid #2c2c33;
		border-radius: 12px;
		background: #1a1a1e;
		font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
	}

	.dc-top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid #2c2c33;
		padding: 10px 12px;
	}

	.dc-channel {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 6px;
		min-width: 0;
		overflow: hidden;
		color: #f2f3f5;
		font-weight: 600;
		font-size: 15px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dc-channel i {
		color: #80848e;
		font-size: 13px;
	}

	.dc-switch {
		display: flex;
		border-radius: 8px;
		background: #111214;
		padding: 2px;
	}

	.dc-switch button {
		display: flex;
		align-items: center;
		gap: 6px;
		border-radius: 6px;
		padding: 5px 10px;
		color: #949ba4;
		font-weight: 600;
		font-size: 12px;
	}

	.dc-switch button i {
		font-size: 10px;
	}

	.dc-switch .dc-switch-on {
		background: #5865f2;
		color: #fff;
	}

	.dc-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		border: 1px solid #36363c;
		border-radius: 8px;
		padding: 5px 10px;
		color: #dbdee1;
		font-size: 12px;
		white-space: nowrap;
	}

	.dc-chip:hover {
		border-color: #4e5058;
	}

	.dc-chip-caret {
		color: #80848e;
		font-size: 9px;
	}

	.dc-chat {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 12px;
		min-height: 220px;
	}

	.dc-message {
		display: flex;
		gap: 12px;
		border-radius: 6px;
		padding: 6px;
		min-width: 0;
	}

	.dc-ephemeral {
		box-shadow: inset 2px 0 0 #5865f2;
		background: rgba(88, 101, 242, 0.08);
	}

	.dc-avatar {
		flex-shrink: 0;
		border-radius: 50%;
		width: 40px;
		height: 40px;
		object-fit: cover;
	}

	.dc-avatar-empty {
		display: grid;
		place-items: center;
		background: #5865f2;
		color: #fff;
	}

	.dc-content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.dc-author {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.dc-name {
		overflow: hidden;
		color: #f2f3f5;
		font-weight: 600;
		font-size: 15px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dc-tag {
		flex-shrink: 0;
		border-radius: 4px;
		background: #5865f2;
		padding: 1px 5px;
		color: #fff;
		font-weight: 600;
		font-size: 10px;
	}

	.dc-timestamp {
		flex-shrink: 0;
		color: #949ba4;
		font-size: 12px;
	}

	.dc-empty {
		border: 1px dashed #3a3a41;
		border-radius: 8px;
		padding: 14px;
		max-width: 520px;
		color: #949ba4;
		font-size: 14px;
	}

	.dc-uploading {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #949ba4;
		font-size: 13px;
	}

	.dc-result {
		color: #dbdee1;
		font-size: 15px;
		line-height: 1.375;
	}

	.dc-result :global(.dc-mention) {
		border-radius: 3px;
		background: rgba(88, 101, 242, 0.3);
		padding: 0 2px;
		color: #c9cdfb;
		font-weight: 500;
	}

	.dc-only-you {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-top: 2px;
		color: #949ba4;
		font-size: 12px;
	}

	.dc-only-you button {
		color: #00a8fc;
	}

	.dc-only-you button:hover {
		text-decoration: underline;
	}

	.dc-composer {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		margin: 0 12px 12px;
		border: 1px solid #36363c;
		border-radius: 10px;
		background: #222327;
		padding: 8px;
	}

	.dc-plus {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		transition: filter 120ms ease;
		border-radius: 50%;
		background: #5865f2;
		width: 32px;
		height: 32px;
		color: #fff;
		font-size: 14px;
	}

	.dc-plus:hover {
		filter: brightness(1.15);
	}

	.dc-input {
		flex: 1;
		align-self: center;
		background: transparent;
		min-width: 0;
		resize: none;
		color: #dbdee1;
		font-size: 15px;
		line-height: 1.375;
	}

	.dc-input::placeholder {
		color: #6d6f78;
	}

	.dc-input:focus {
		outline: none;
	}

	.dc-input-hint {
		color: #6d6f78;
		font-size: 14px;
	}

	.dc-count {
		flex-shrink: 0;
		align-self: center;
		color: #6d6f78;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.dc-count-near {
		color: #f0b232;
	}

	.dc-emoji-button {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		border-radius: 8px;
		width: 32px;
		height: 32px;
		color: #b5bac1;
		font-size: 18px;
	}

	.dc-emoji-button:hover {
		color: #f0b232;
	}
</style>
