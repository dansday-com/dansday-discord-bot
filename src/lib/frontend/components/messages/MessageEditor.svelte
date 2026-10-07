<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { imageSizeLabel } from '$lib/images.js';
	import { SERVER_LANGUAGES, serverLanguageLabel, type ServerLanguage } from '$lib/languages.js';
	import {
		MESSAGE_LIMITS,
		MESSAGE_PLACEHOLDERS,
		MESSAGE_VIDEO_FORMATS_LABEL,
		messageDocProblems,
		newMessageBlock,
		newMessageDoc,
		newMessageEmbed,
		newMessagePartId,
		normalizeMessageDoc,
		removeMessageLanguage,
		type MessageDoc,
		type RowBlock
	} from '$lib/messages.js';
	import BlockList from './BlockList.svelte';
	import EmbedEditor from './EmbedEditor.svelte';
	import LocalizedField from './LocalizedField.svelte';
	import MediaField from './MediaField.svelte';
	import MessagePreview from './MessagePreview.svelte';
	import RowEditor from './RowEditor.svelte';
	import { moveItem, setMessageEditor, type EditorEmoji, type EditorRole } from './editorContext.js';
	import type { MarkdownContext } from './discordMarkdown.js';
	import { GHOST_BUTTON, ICON_BUTTON, LABEL, PANEL } from './styles.js';

	type Post = { id: number; channel_id: string; channel_name: string; discord_message_id: string; language: string; created_at: string };

	let {
		data
	}: {
		data: {
			serverId: number;
			guildId: string;
			listPath: string;
			serverName: string;
			uploadLimit: number;
			message: { id: number; name: string; content: MessageDoc } | null;
			draft: { name: string; content: MessageDoc } | null;
			messages: { id: number; name: string; content: MessageDoc }[];
			posts: Post[];
			channels: any[];
			categories: any[];
			roles: (EditorRole & { position: number | null })[];
			defaults: { language: ServerLanguage; color: string; footer: string };
			bot: { name: string; avatar: string | null };
			emojis: EditorEmoji[];
		};
	} = $props();

	const initial = () => ({
		id: data.message?.id ?? null,
		name: data.message?.name ?? data.draft?.name ?? '',
		doc: normalizeMessageDoc(
			$state.snapshot(data.message?.content ?? data.draft?.content ?? newMessageDoc(data.defaults.language, data.defaults.color, data.defaults.footer))
		)
	});
	const serialize = (messageName: string, content: MessageDoc) => JSON.stringify([messageName.trim(), content]);

	const messageId = initial().id;
	let name = $state(initial().name);
	let doc = $state<MessageDoc>(initial().doc);
	let lang = $state<ServerLanguage>(initial().doc.language);
	let saved = $state(messageId === null ? '' : serialize(initial().name, initial().doc));

	let saving = $state(false);
	let sending = $state(false);
	let removing = $state<number | null>(null);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let confirmLanguage = $state<ServerLanguage | null>(null);
	let confirmPost = $state<Post | null>(null);
	let leaveTo = $state<URL | null>(null);
	let leaving = false;

	let channelIds = $state<string[]>([]);
	let mentionIds = $state<string[]>([]);
	let sendLanguage = $state<string>(initial().doc.language);
	let addLanguage = $state('');

	const LAYOUTS = [
		{ id: 'standard', label: 'Standard message', icon: 'fa-message', hint: 'Text, photos, videos, embeds and buttons, like a normal post.' },
		{ id: 'components', label: 'Components V2', icon: 'fa-layer-group', hint: 'Free layout: containers, sections, galleries and dividers.' }
	] as const;

	const GLOBAL_MENTIONS = [
		{ discord_role_id: 'everyone', name: '@everyone', color: '#3b82f6', position: Number.MAX_SAFE_INTEGER },
		{ discord_role_id: 'here', name: '@here', color: '#8b5cf6', position: Number.MAX_SAFE_INTEGER - 1 }
	];

	const mentionRoles = $derived([
		...GLOBAL_MENTIONS,
		...data.roles.map((role) => ({ discord_role_id: role.id, name: role.name, color: role.color ?? '', position: role.position }))
	]);
	const dirty = $derived(serialize(name, doc) !== saved);
	const problems = $derived([...(name.trim() ? [] : ['Give the message a name so you can find it later.']), ...messageDocProblems(doc)]);
	const otherLanguages = $derived(SERVER_LANGUAGES.filter((language) => !doc.languages.includes(language.code)));
	const languageOptions = $derived([
		{ value: '', label: 'Add a language' },
		...otherLanguages.map((language) => ({ value: language.code, label: serverLanguageLabel(language.code) }))
	]);
	const sendLanguageOptions = $derived(doc.languages.map((code) => ({ value: code, label: serverLanguageLabel(code) })));
	const markdownContext = $derived<MarkdownContext>({
		roles: new Map(data.roles.map((role) => [role.id, { name: role.name, color: role.color }])),
		channels: new Map(data.channels.map((channel: any) => [String(channel.discord_channel_id), String(channel.name ?? '')]))
	});

	setMessageEditor({
		get lang() {
			return lang;
		},
		get base() {
			return doc.language;
		},
		get serverId() {
			return data.serverId;
		},
		get uploadLimit() {
			return data.uploadLimit;
		},
		get selfId() {
			return messageId;
		},
		get emojis() {
			return data.emojis;
		},
		get roles() {
			return data.roles;
		},
		get messages() {
			return data.messages;
		}
	});

	$effect(() => {
		if (!addLanguage) return;
		const code = addLanguage as ServerLanguage;
		addLanguage = '';
		if (!doc.languages.includes(code)) doc.languages.push(code);
		lang = code;
	});

	$effect(() => {
		if (!doc.languages.includes(sendLanguage as ServerLanguage)) sendLanguage = doc.language;
	});

	beforeNavigate((navigation) => {
		if (!dirty || leaving) return;
		navigation.cancel();
		if (!navigation.willUnload && navigation.to) leaveTo = navigation.to.url;
	});

	function resolveMessage(id: number): MessageDoc | null {
		if (id === messageId) return doc;
		return data.messages.find((message) => message.id === id)?.content ?? null;
	}

	function removeLanguage(code: ServerLanguage) {
		doc = removeMessageLanguage($state.snapshot(doc) as MessageDoc, code);
		if (lang === code) lang = doc.language;
		confirmLanguage = null;
	}

	function addRow(type: RowBlock['type']) {
		doc.rows.push(newMessageBlock(type) as RowBlock);
	}

	async function save(): Promise<boolean> {
		if (problems.length > 0) {
			showToast(problems[0], 'error', 6000);
			return false;
		}
		saving = true;
		try {
			const content = $state.snapshot(doc) as MessageDoc;
			const res = await fetch(`/api/servers/${data.serverId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: messageId, name, content })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Could not save the message', 'error', 6000);
				return false;
			}
			saved = serialize(name, doc);
			if (messageId === null) {
				showToast('Message saved. You can send it now.', 'success');
				leaving = true;
				await goto(`${data.listPath}/${out.id}`, { replaceState: true });
				return true;
			}
			const posts = out.posts ?? { running: true, updated: 0, removed: 0, failed: [] };
			if (posts.failed.length > 0) showToast(`Saved, but ${posts.failed[0]}`, 'error', 9000);
			else if (data.posts.length > 0 && !posts.running) showToast('Saved. The bot is offline, so the posted copies still show the old version.', 'info', 7000);
			else if (posts.updated > 0) showToast(`Saved and updated ${posts.updated} posted ${posts.updated === 1 ? 'copy' : 'copies'}.`, 'success');
			else showToast('Message saved.', 'success');
			await invalidateAll();
			return true;
		} finally {
			saving = false;
		}
	}

	async function send() {
		if (channelIds.length === 0) return showToast('Pick at least one channel to send it to.', 'error');
		if (dirty && !(await save())) return;
		sending = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/messages/${messageId}/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ channel_ids: channelIds, role_ids: mentionIds, language: sendLanguage })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not send the message', 'error', 8000);
			if (out.failed?.length > 0) showToast(`Sent to ${out.sent}, but ${out.failed[0]}`, 'error', 9000);
			else showToast(`Sent to ${out.sent} ${out.sent === 1 ? 'channel' : 'channels'}.`, 'success');
			channelIds = [];
			mentionIds = [];
			await invalidateAll();
		} finally {
			sending = false;
		}
	}

	async function removePost(post: Post) {
		removing = post.id;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/messages/${messageId}/posts/${post.id}`, { method: 'DELETE' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not remove it', 'error', 7000);
			showToast(`Removed from #${post.channel_name}.`, 'success');
			await invalidateAll();
		} finally {
			removing = null;
			confirmPost = null;
		}
	}

	async function remove() {
		deleting = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/messages/${messageId}`, { method: 'DELETE' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not delete the message', 'error', 8000);
			showToast(
				out.stripped ? 'Message deleted.' : 'Message deleted. The bot is offline, so the posted copies keep their buttons until it is back.',
				out.stripped ? 'success' : 'info',
				7000
			);
			leaving = true;
			await goto(data.listPath);
		} finally {
			deleting = false;
			confirmDelete = false;
		}
	}
</script>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<a href={data.listPath} class="text-ash-400 hover:text-ash-100 inline-flex shrink-0 items-center gap-2 text-sm transition-colors">
		<i class="fas fa-arrow-left text-violet-300"></i>Messages
	</a>
	<input
		type="text"
		bind:value={name}
		maxlength={MESSAGE_LIMITS.name}
		placeholder="Name it, e.g. Rules panel"
		aria-label="Message name"
		class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 min-w-0 flex-1 basis-48 rounded-lg border px-3 py-2 text-sm font-semibold focus:ring-2 focus:outline-none"
	/>
	{#if messageId !== null}
		<button type="button" class="{GHOST_BUTTON} py-2" onclick={() => (confirmDelete = true)}><i class="fas fa-trash text-red-300"></i>Delete</button>
	{/if}
	<button
		type="button"
		onclick={save}
		disabled={saving || (!dirty && messageId !== null)}
		class="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<i class="fas {saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}"></i>
		{#if !dirty && messageId !== null}Saved{:else if data.posts.length > 0}Save and update {data.posts.length} posted{:else}Save{/if}
	</button>
</div>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
	<div class="flex min-w-0 flex-col gap-4">
		<section class={PANEL}>
			<div class="flex flex-wrap gap-2">
				{#each LAYOUTS as layout (layout.id)}
					<button
						type="button"
						aria-pressed={doc.layout === layout.id}
						onclick={() => (doc.layout = layout.id)}
						class="min-w-0 flex-1 basis-56 rounded-lg border p-3 text-left transition-colors {doc.layout === layout.id
							? 'border-ash-300 bg-ash-700'
							: 'border-ash-600 hover:border-ash-500'}"
					>
						<span class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas {layout.icon} text-fuchsia-300"></i>{layout.label}</span>
						<span class="text-ash-400 mt-1 block text-xs">{layout.hint}</span>
					</button>
				{/each}
			</div>

			<div class="border-ash-700 mt-4 border-t pt-4">
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="{LABEL} mr-1"><i class="fas fa-language mr-1 text-sky-300"></i>Language</span>
					{#each doc.languages as code (code)}
						<span
							class="flex items-center overflow-hidden rounded-lg border text-xs transition-colors {lang === code
								? 'border-ash-300 bg-ash-600 text-ash-100'
								: 'border-ash-600 text-ash-300 hover:border-ash-500'}"
						>
							<button type="button" class="px-2.5 py-1.5" aria-pressed={lang === code} onclick={() => (lang = code)}>
								{serverLanguageLabel(code)}{code === doc.language ? ' · main' : ''}
							</button>
							{#if code !== doc.language}
								<button
									type="button"
									class="py-1.5 pr-2 hover:text-red-300"
									aria-label="Remove {serverLanguageLabel(code)}"
									onclick={() => (confirmLanguage = code)}
								>
									<i class="fas fa-xmark"></i>
								</button>
							{/if}
						</span>
					{/each}
					{#if otherLanguages.length > 0}
						<div class="w-44">
							<LabeledSelect appearance="field" options={languageOptions} bind:value={addLanguage} ariaLabel="Add a language" />
						</div>
					{/if}
				</div>
				<p class="text-ash-500 mt-2 text-xs">
					{#if doc.languages.length === 1}
						Add a language to translate this message. Members who click a button get the reply in the language they picked in the bot menu.
					{:else if lang === doc.language}
						This is the main text. Other languages fall back to it wherever a translation is left empty.
					{:else}
						You are translating into {serverLanguageLabel(lang)}. Empty boxes show the {serverLanguageLabel(doc.language)} text as a hint.
					{/if}
				</p>
			</div>
		</section>

		{#if doc.layout === 'standard'}
			<section class={PANEL}>
				<h3 class="text-ash-100 mb-3 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-pen text-violet-400"></i>Text</h3>
				<LocalizedField
					bind:value={doc.text}
					label="What the bot says"
					max={MESSAGE_LIMITS.text}
					multiline
					rows={4}
					placeholder="Write it like a normal Discord message. Markdown and emoji work."
				/>
				<p class="text-ash-500 mt-2 text-xs">
					{#each MESSAGE_PLACEHOLDERS as placeholder, i (placeholder.token)}
						{i > 0 ? ' · ' : ''}<code class="text-ash-300">{placeholder.token}</code> {placeholder.label.toLowerCase()}
					{/each}
				</p>
			</section>

			<section class={PANEL}>
				<h3 class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-photo-film text-sky-400"></i>Photos and videos</h3>
				<p class="text-ash-400 mt-1 mb-3 text-xs">
					Sent as real attachments, like a member uploading them. Images or {MESSAGE_VIDEO_FORMATS_LABEL}, up to {imageSizeLabel(data.uploadLimit)} each, which is
					this server's Discord limit.
				</p>
				<div class="flex flex-col gap-2">
					{#each doc.attachments as attachment, i (attachment.id)}
						<div class="bg-ash-700/50 border-ash-600 flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
							<div class="min-w-0 flex-1 basis-64"><MediaField bind:value={attachment.file} video link={false} /></div>
							<label class="text-ash-300 flex cursor-pointer items-center gap-2 text-xs">
								<input type="checkbox" bind:checked={attachment.spoiler} class="accent-ash-300 size-3.5" />Spoiler
							</label>
							<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => moveItem(doc.attachments, i, -1)}>
								<i class="fas fa-arrow-up"></i>
							</button>
							<button
								type="button"
								class={ICON_BUTTON}
								aria-label="Move down"
								disabled={i === doc.attachments.length - 1}
								onclick={() => moveItem(doc.attachments, i, 1)}
							>
								<i class="fas fa-arrow-down"></i>
							</button>
							<button type="button" class={ICON_BUTTON} aria-label="Remove file" onclick={() => doc.attachments.splice(i, 1)}
								><i class="fas fa-trash"></i></button
							>
						</div>
					{/each}
				</div>
				{#if doc.attachments.length < MESSAGE_LIMITS.attachments}
					<button
						type="button"
						class="{GHOST_BUTTON} {doc.attachments.length > 0 ? 'mt-3' : ''}"
						onclick={() => doc.attachments.push({ id: newMessagePartId(), file: '', spoiler: false })}
					>
						<i class="fas fa-plus text-emerald-400"></i>Photo or video
					</button>
				{/if}
			</section>

			{#each doc.embeds as embed, i (embed.id)}
				<section class={PANEL}>
					<div class="mb-3 flex items-center gap-1">
						<h3 class="text-ash-100 mr-auto flex items-center gap-2 text-sm font-semibold">
							<span class="h-4 w-1 rounded-full" style="background: {embed.color || 'var(--color-ash-500)'}"></span>Embed {i + 1}
						</h3>
						<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => moveItem(doc.embeds, i, -1)}>
							<i class="fas fa-arrow-up"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Move down" disabled={i === doc.embeds.length - 1} onclick={() => moveItem(doc.embeds, i, 1)}>
							<i class="fas fa-arrow-down"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Remove embed" onclick={() => doc.embeds.splice(i, 1)}><i class="fas fa-trash"></i></button>
					</div>
					<EmbedEditor bind:embed={doc.embeds[i]} />
				</section>
			{/each}

			{#each doc.rows as row, i (row.id)}
				<section class={PANEL}>
					<div class="mb-3 flex items-center gap-1">
						<h3 class="text-ash-100 mr-auto flex items-center gap-2 text-sm font-semibold">
							<i class="fas {row.type === 'buttons' ? 'fa-hand-pointer' : 'fa-list'} text-amber-300"></i>{row.type === 'buttons' ? 'Buttons' : 'Dropdown'}
						</h3>
						<button type="button" class={ICON_BUTTON} aria-label="Move up" disabled={i === 0} onclick={() => moveItem(doc.rows, i, -1)}>
							<i class="fas fa-arrow-up"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Move down" disabled={i === doc.rows.length - 1} onclick={() => moveItem(doc.rows, i, 1)}>
							<i class="fas fa-arrow-down"></i>
						</button>
						<button type="button" class={ICON_BUTTON} aria-label="Remove row" onclick={() => doc.rows.splice(i, 1)}><i class="fas fa-trash"></i></button>
					</div>
					<RowEditor bind:row={doc.rows[i]} />
				</section>
			{/each}

			<div class="flex flex-wrap gap-2">
				{#if doc.embeds.length < MESSAGE_LIMITS.embeds}
					<button type="button" class={GHOST_BUTTON} onclick={() => doc.embeds.push(newMessageEmbed(data.defaults.color))}>
						<i class="fas fa-plus text-emerald-400"></i>Embed
					</button>
				{/if}
				{#if doc.rows.length < MESSAGE_LIMITS.rows}
					<button type="button" class={GHOST_BUTTON} onclick={() => addRow('buttons')}><i class="fas fa-plus text-emerald-400"></i>Row of buttons</button>
					<button type="button" class={GHOST_BUTTON} onclick={() => addRow('select')}><i class="fas fa-plus text-emerald-400"></i>Dropdown</button>
				{/if}
			</div>
		{:else}
			<section class={PANEL}>
				<h3 class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-layer-group text-violet-400"></i>Blocks</h3>
				<p class="text-ash-400 mt-1 mb-3 text-xs">Stack blocks top to bottom. Put them in a container to get the box with a colored edge.</p>
				<BlockList bind:blocks={doc.blocks} max={MESSAGE_LIMITS.blocks} color={data.defaults.color} />
			</section>
		{/if}
	</div>

	<div class="flex min-w-0 flex-col gap-4 self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
		<section class={PANEL}>
			<h3 class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-eye text-cyan-400"></i>Preview</h3>
			<p class="text-ash-400 mt-1 mb-3 text-xs">Click a button or dropdown to see what a member gets.</p>
			<MessagePreview {doc} {lang} server={data.serverName} bot={data.bot} context={markdownContext} resolve={resolveMessage} />
		</section>

		{#if problems.length > 0}
			<section class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
				<p class="flex items-center gap-2 text-sm font-semibold text-amber-200"><i class="fas fa-triangle-exclamation text-amber-400"></i>Fix before saving</p>
				<ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/90">
					{#each problems as problem (problem)}
						<li>{problem}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class={PANEL}>
			<h3 class="text-ash-100 mb-3 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-paper-plane text-emerald-400"></i>Send</h3>
			{#if messageId === null}
				<p class="text-ash-400 text-sm">Save the message first, then pick where the bot posts it.</p>
			{:else}
				<div class="flex flex-col gap-3">
					<div>
						<span class="{LABEL} mb-1.5 block">Channels</span>
						<ChannelPicker
							channels={data.channels}
							categories={data.categories}
							value={channelIds}
							multi={true}
							placeholder="Select channels..."
							onchange={(value) => (channelIds = value as string[])}
						/>
					</div>
					<div>
						<span class="{LABEL} mb-1.5 block">Ping roles with it</span>
						<RolePicker roles={mentionRoles as any} value={mentionIds} placeholder="Nobody" onchange={(value) => (mentionIds = value as string[])} />
					</div>
					{#if doc.languages.length > 1}
						<div>
							<span class="{LABEL} mb-1.5 block">Post it in</span>
							<LabeledSelect appearance="field" options={sendLanguageOptions} bind:value={sendLanguage} ariaLabel="Language to post in" />
						</div>
					{/if}
					<button
						type="button"
						onclick={send}
						disabled={sending || saving || problems.length > 0}
						class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
					>
						<i class="fas {sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-emerald-300"></i>
						{sending ? 'Sending...' : dirty ? 'Save and send' : 'Send'}
					</button>
				</div>
			{/if}
		</section>

		{#if data.posts.length > 0}
			<section class={PANEL}>
				<h3 class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-thumbtack text-amber-300"></i>Posted copies</h3>
				<p class="text-ash-400 mt-1 mb-3 text-xs">Saving this message edits every copy below.</p>
				<div class="flex flex-col gap-1.5">
					{#each data.posts as post (post.id)}
						<div class="bg-ash-700/50 border-ash-600 flex items-center gap-2 rounded-lg border px-2.5 py-2">
							<div class="min-w-0 flex-1">
								<p class="text-ash-100 truncate text-sm">#{post.channel_name}</p>
								<p class="text-ash-400 truncate text-xs">
									<LocalTime value={post.created_at} />{doc.languages.length > 1 ? ` · ${serverLanguageLabel(post.language)}` : ''}
								</p>
							</div>
							<a
								href="https://discord.com/channels/{data.guildId}/{post.channel_id}/{post.discord_message_id}"
								target="_blank"
								rel="noreferrer"
								class={ICON_BUTTON}
								aria-label="Open in Discord"
								title="Open in Discord"
							>
								<i class="fas fa-arrow-up-right-from-square"></i>
							</a>
							<button
								type="button"
								class={ICON_BUTTON}
								aria-label="Remove from #{post.channel_name}"
								title="Delete from Discord"
								disabled={removing !== null}
								onclick={() => (confirmPost = post)}
							>
								<i class="fas {removing === post.id ? 'fa-spinner fa-spin' : 'fa-trash'}"></i>
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<ConfirmModal
	open={confirmDelete}
	title="Delete this message?"
	message={data.posts.length > 0
		? `"${name}" is deleted from the panel. Its ${data.posts.length} posted ${data.posts.length === 1 ? 'copy stays' : 'copies stay'} in Discord, but buttons and dropdowns are taken off because they would stop working.`
		: `"${name}" is deleted from the panel. This cannot be undone.`}
	confirmLabel="Delete"
	dangerous
	loading={deleting}
	onconfirm={remove}
	oncancel={() => (confirmDelete = false)}
/>

<ConfirmModal
	open={confirmPost !== null}
	title="Delete it from Discord?"
	message={confirmPost ? `The copy in #${confirmPost.channel_name} is deleted from Discord. The message stays saved here.` : ''}
	confirmLabel="Delete from Discord"
	dangerous
	loading={removing !== null}
	onconfirm={() => confirmPost && removePost(confirmPost)}
	oncancel={() => (confirmPost = null)}
/>

<ConfirmModal
	open={confirmLanguage !== null}
	title="Remove this language?"
	message={confirmLanguage ? `Every ${serverLanguageLabel(confirmLanguage)} translation in this message is deleted.` : ''}
	confirmLabel="Remove"
	dangerous
	onconfirm={() => confirmLanguage && removeLanguage(confirmLanguage)}
	oncancel={() => (confirmLanguage = null)}
/>

<ConfirmModal
	open={leaveTo !== null}
	title="Leave without saving?"
	message="Your changes to this message are not saved yet."
	confirmLabel="Leave"
	cancelLabel="Stay"
	dangerous
	onconfirm={() => {
		const target = leaveTo;
		leaveTo = null;
		leaving = true;
		if (target) goto(target);
	}}
	oncancel={() => (leaveTo = null)}
/>
