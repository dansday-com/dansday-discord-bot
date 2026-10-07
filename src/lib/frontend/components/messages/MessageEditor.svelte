<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { agentDock, type AgentMessageEditor } from '$lib/frontend/agent.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { serverLanguageLabel, type ServerLanguage } from '$lib/languages.js';
	import {
		MESSAGE_LIMITS,
		messageDocIssues,
		newMessageBlock,
		newMessageButton,
		newMessageDoc,
		newMessageEmbed,
		newMessagePartId,
		normalizeMessageDoc,
		removeMessageLanguage,
		type ButtonsBlock,
		type MessageBlockType,
		type MessageDoc,
		type MessageIssue,
		type MessageScope
	} from '$lib/messages.js';
	import MessageCanvas from './MessageCanvas.svelte';
	import PartInspector from './PartInspector.svelte';
	import SendDialog from './SendDialog.svelte';
	import { setMessageEditor, type EditorEmoji, type EditorRole, type MessageEditorContext } from './editorContext.js';
	import type { MarkdownContext } from './discordMarkdown.js';
	import { uploadMedia } from './mediaUpload.js';
	import { containerOf, locatePart, type PostedCopy, type Selection } from './selection.js';
	import { GHOST_BUTTON, PANEL } from './styles.js';

	let {
		data
	}: {
		data: {
			scope: MessageScope;
			apiBase: string;
			listPath: string;
			serverName: string;
			uploadLimit: number;
			message: { id: number; name: string; content: MessageDoc } | null;
			draft: { name: string; content: MessageDoc } | null;
			messages: { id: number; name: string; content: MessageDoc }[];
			posts: PostedCopy[];
			channels: any[];
			categories: any[];
			roles: (EditorRole & { position: number | null })[];
			defaults: { language: ServerLanguage; color: string; footer: string };
			bot: { name: string; avatar: string | null };
			emojis: EditorEmoji[];
			members: { id: string; name: string }[];
			membersUrl: string | null;
		};
	} = $props();

	const initial = () => ({
		id: data.message?.id ?? null,
		scope: data.scope,
		name: data.message?.name ?? data.draft?.name ?? '',
		send: page.url.searchParams.get('send') === '1',
		members: data.members.map((member) => [member.id, member.name] as const),
		doc: normalizeMessageDoc($state.snapshot(data.message?.content ?? data.draft?.content ?? newMessageDoc(data.defaults.language)), undefined, data.scope)
	});
	const serialize = (messageName: string, content: MessageDoc) => JSON.stringify([messageName.trim(), content]);

	const messageId = initial().id;
	const global = initial().scope === 'global';
	let name = $state(initial().name);
	let doc = $state<MessageDoc>(initial().doc);
	let lang = $state<ServerLanguage>(initial().doc.language);
	let saved = $state(messageId === null ? '' : serialize(initial().name, initial().doc));

	let mode = $state<'edit' | 'try'>('edit');
	let selection = $state<Selection>(null);
	let nonce = $state(0);
	let menuOpen = $state(false);
	let uploading = $state<number | null>(null);
	let sendOpen = $state(messageId !== null && initial().send);
	let nameInput = $state<HTMLInputElement>();

	let saving = $state(false);
	let sending = $state(false);
	let removing = $state<number | 'all' | null>(null);
	let deleting = $state(false);
	let confirmDelete = $state(false);
	let confirmLanguage = $state<ServerLanguage | null>(null);
	let confirmPost = $state<PostedCopy | 'all' | null>(null);
	let leaveTo = $state<URL | null>(null);
	let leaving = false;
	let beforeAgent: { name: string; doc: MessageDoc } | null = null;
	let memberNames = $state<Record<string, string>>(Object.fromEntries(initial().members));

	const EVERYONE_MENTIONS = [
		{ discord_role_id: 'everyone', name: '@everyone', color: '#3b82f6', position: Number.MAX_SAFE_INTEGER },
		{ discord_role_id: 'here', name: '@here', color: '#8b5cf6', position: Number.MAX_SAFE_INTEGER - 1 }
	];

	const GROUP_MENTIONS = [
		...EVERYONE_MENTIONS,
		{ discord_role_id: 'admin', name: 'Admin Roles', color: '#ef4444', position: 2 },
		{ discord_role_id: 'staff', name: 'Staff Roles', color: '#f59e0b', position: 1 }
	];

	const STEPS = [
		{ icon: 'fa-keyboard', text: 'Type in the box under the message to write what the bot says.' },
		{ icon: 'fa-plus', text: 'Press + to add an embed, a photo or video, a button or a dropdown.' },
		{ icon: 'fa-arrow-pointer', text: 'Click anything in the message to change it here.' },
		{ icon: 'fa-play', text: 'Switch to Try it to click the buttons like a member would.' },
		{ icon: 'fa-wand-magic-sparkles', text: 'Or press Ask AI in the corner and describe the message.' }
	];

	const mentionRoles = $derived(
		global
			? GROUP_MENTIONS
			: [...EVERYONE_MENTIONS, ...data.roles.map((role) => ({ discord_role_id: role.id, name: role.name, color: role.color ?? '', position: role.position }))]
	);
	const dirty = $derived(serialize(name, doc) !== saved);
	const issues = $derived<MessageIssue[]>([
		...(name.trim() ? [] : [{ part: 'name', text: 'Give the message a name at the top so you can find it later.' }]),
		...messageDocIssues(doc)
	]);
	const flagged = $derived(new Set(issues.flatMap((issue) => (issue.part ? [issue.part] : []))));
	const markdownContext = $derived<MarkdownContext>({
		roles: new Map(data.roles.map((role) => [role.id, { name: role.name, color: role.color }])),
		channels: new Map(data.channels.map((channel: any) => [String(channel.discord_channel_id), String(channel.name ?? '')])),
		members: new Map(Object.entries(memberNames))
	});
	const servers = $derived(new Set(data.posts.map((post) => post.guild_id)).size);
	const copies = $derived(
		global ? `${servers} ${servers === 1 ? 'server' : 'servers'}` : `${data.posts.length} posted ${data.posts.length === 1 ? 'copy' : 'copies'}`
	);
	const box = $derived(selection ? containerOf(doc, selection.id) : null);
	const editingPart = $derived(!!selection && selection.id !== 'text' && !!locatePart(doc, selection.id));

	const editorContext: MessageEditorContext = {
		get lang() {
			return lang;
		},
		get base() {
			return doc.language;
		},
		get uploadUrl() {
			return `${data.apiBase}/file`;
		},
		get uploadLimit() {
			return data.uploadLimit;
		},
		get uploadLimitNote() {
			return global
				? 'A global message goes to every server, so files have to fit a server without boosts.'
				: "Discord sets it from this server's boost level.";
		},
		get colorNote() {
			return global ? "Leave the color empty to use each server's own embed color." : '';
		},
		get roleActions() {
			return !global;
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
		},
		get membersUrl() {
			return data.membersUrl;
		},
		rememberMember(id, name) {
			memberNames[id] = name;
		}
	};
	setMessageEditor(editorContext);

	beforeNavigate((navigation) => {
		if (!dirty || leaving) return;
		navigation.cancel();
		if (!navigation.willUnload && navigation.to) leaveTo = navigation.to.url;
	});

	async function select(id: string, focus = '') {
		mode = 'edit';
		selection = { id, focus };
		nonce++;
		if (!window.matchMedia('(max-width: 1023px)').matches) return;
		await tick();
		document.querySelector('.dc-selected')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}

	function resolveMessage(id: number): MessageDoc | null {
		if (id === messageId) return doc;
		return data.messages.find((message) => message.id === id)?.content ?? null;
	}

	function removeLanguage(code: ServerLanguage) {
		doc = removeMessageLanguage($state.snapshot(doc) as MessageDoc, code, data.scope);
		if (lang === code) lang = doc.language;
		confirmLanguage = null;
	}

	function addButtonTo(row: ButtonsBlock) {
		const button = newMessageButton();
		row.buttons.push(button);
		select(button.id);
	}

	function addButton(rowId: string) {
		const rows = doc.layout === 'standard' ? doc.rows : doc.blocks.flatMap((block) => (block.type === 'container' ? block.blocks : [block]));
		const row = rows.find((block) => block.id === rowId);
		if (row?.type === 'buttons' && row.buttons.length < MESSAGE_LIMITS.buttons) addButtonTo(row);
	}

	function add(type: 'embed' | MessageBlockType) {
		if (doc.layout === 'standard') {
			if (type === 'embed') {
				const embed = newMessageEmbed(data.defaults.color, data.defaults.footer ? { [doc.language]: data.defaults.footer } : {});
				doc.embeds.push(embed);
				return select(embed.id, 'title');
			}
			if (type === 'buttons') {
				const last = doc.rows[doc.rows.length - 1];
				if (last?.type === 'buttons' && last.buttons.length < MESSAGE_LIMITS.buttons) return addButtonTo(last);
			}
			if (type !== 'buttons' && type !== 'select') return;
			const row = newMessageBlock(type) as ButtonsBlock;
			doc.rows.push(row);
			return select(type === 'buttons' ? row.buttons[0].id : row.id);
		}

		const target: any[] = box && type !== 'container' ? box.blocks : doc.blocks;
		if (target.length >= (target === doc.blocks ? MESSAGE_LIMITS.blocks : MESSAGE_LIMITS.innerBlocks)) {
			return showToast('That is as many parts as fit here. Remove one first.', 'error');
		}
		const block: any = newMessageBlock(type as MessageBlockType, data.defaults.color);
		target.push(block);
		if (block.type === 'buttons') select(block.buttons[0].id);
		else if (block.type === 'container') select(block.blocks[0].id);
		else select(block.id);
	}

	async function addFile(file: File) {
		try {
			const key = await uploadMedia(editorContext, file, true, (fraction) => (uploading = fraction));
			if (!key) return;
			const attachment = { id: newMessagePartId(), file: key, spoiler: false };
			doc.attachments.push(attachment);
			select(attachment.id);
		} finally {
			uploading = null;
		}
	}

	function applyAgent(result: { name: string | null; content: MessageDoc | null } | null): boolean {
		if (!result?.content && !result?.name) return false;
		beforeAgent = { name, doc: $state.snapshot(doc) as MessageDoc };
		if (result.name) name = result.name;
		if (result.content) {
			doc = normalizeMessageDoc(result.content, undefined, data.scope);
			if (!doc.languages.includes(lang)) lang = doc.language;
			selection = null;
			mode = 'edit';
		}
		return true;
	}

	function undoAgent() {
		if (!beforeAgent) return;
		name = beforeAgent.name;
		doc = beforeAgent.doc;
		if (!doc.languages.includes(lang)) lang = doc.language;
		selection = null;
		beforeAgent = null;
	}

	const dockEditor: AgentMessageEditor = {
		scope: initial().scope,
		read: () => ({ id: messageId, name, content: $state.snapshot(doc) as MessageDoc }),
		apply: applyAgent,
		undo: undoAgent
	};

	onMount(() => {
		agentDock.editor = dockEditor;
		return () => {
			if (agentDock.editor === dockEditor) agentDock.editor = null;
		};
	});

	function openIssue(issue: MessageIssue) {
		if (issue.part === 'name') return nameInput?.focus();
		if (issue.part) select(issue.part);
	}

	function savedToast(posts: any) {
		const failed: string[] = posts?.failed ?? [];
		const unreached = global ? (posts?.unreached ?? 0) > 0 : data.posts.length > 0 && posts?.running === false;
		if (failed.length > 0) return showToast(`Saved, but ${failed[0]}`, 'error', 9000);
		if (unreached) return showToast('Saved. A bot is offline, so some posted copies still show the old version.', 'info', 7000);
		if (posts?.updated > 0) return showToast(`Saved and updated ${posts.updated} posted ${posts.updated === 1 ? 'copy' : 'copies'}.`, 'success');
		showToast('Message saved.', 'success');
	}

	async function save(thenSend = false): Promise<boolean> {
		if (issues.length > 0) {
			showToast(issues[0].text, 'error', 6000);
			openIssue(issues[0]);
			return false;
		}
		saving = true;
		try {
			const content = $state.snapshot(doc) as MessageDoc;
			const res = await fetch(data.apiBase, {
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
				if (!thenSend) showToast('Message saved. Press Send to post it.', 'success');
				leaving = true;
				await goto(`${data.listPath}/${out.id}${thenSend ? '?send=1' : ''}`, { replaceState: true });
				return true;
			}
			savedToast(out.posts);
			await invalidateAll();
			return true;
		} finally {
			saving = false;
		}
	}

	async function openSend() {
		if ((dirty || messageId === null) && !(await save(true))) return;
		if (messageId !== null) sendOpen = true;
	}

	async function send(target: { channelIds: string[]; mentionIds: string[]; language: string }): Promise<boolean> {
		sending = true;
		try {
			const res = await fetch(`${data.apiBase}/${messageId}/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					global ? { mention_groups: target.mentionIds } : { channel_ids: target.channelIds, role_ids: target.mentionIds, language: target.language }
				)
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Could not send the message', 'error', 8000);
				return false;
			}
			const where = global ? (out.sent === 1 ? 'server' : 'servers') : out.sent === 1 ? 'channel' : 'channels';
			const notes = [
				out.failed?.length > 0 ? `${out.failed.length} failed: ${out.failed[0]}` : '',
				out.skipped > 0 ? `${out.skipped} skipped, no Bot Updates Channel set.` : '',
				out.offline > 0 ? `${out.offline} ${out.offline === 1 ? 'bot is' : 'bots are'} offline.` : ''
			].filter(Boolean);
			showToast([`Sent to ${out.sent} ${where}.`, ...notes].join(' '), notes.length > 0 ? 'info' : 'success', notes.length > 0 ? 9000 : 4000);
			await invalidateAll();
			return true;
		} finally {
			sending = false;
		}
	}

	async function removePost(target: PostedCopy | 'all') {
		removing = target === 'all' ? 'all' : target.id;
		try {
			const res = await fetch(`${data.apiBase}/${messageId}/posts/${target === 'all' ? 'all' : target.id}`, { method: 'DELETE' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not remove it', 'error', 7000);
			if (out.failed?.length > 0) showToast(`Removed ${out.removed}, but ${out.failed[0]}`, 'error', 9000);
			else if (out.unreached > 0) showToast(`Removed ${out.removed}. ${out.unreached} sit on a bot that is offline.`, 'info', 7000);
			else showToast(target === 'all' ? 'Removed from every server.' : `Removed from #${target.channel_name}.`, 'success');
			await invalidateAll();
		} finally {
			removing = null;
			confirmPost = null;
		}
	}

	async function remove() {
		deleting = true;
		try {
			const res = await fetch(`${data.apiBase}/${messageId}`, { method: 'DELETE' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not delete the message', 'error', 8000);
			showToast(
				out.stripped ? 'Message deleted.' : 'Message deleted. A bot is offline, so some posted copies keep their buttons until it is back.',
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

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && selection && !sendOpen) selection = null;
	}}
/>

<div class="mb-4 flex flex-wrap items-center gap-2">
	<a href={data.listPath} class="text-ash-400 hover:text-ash-100 inline-flex shrink-0 items-center gap-2 text-sm transition-colors">
		<i class="fas fa-arrow-left text-violet-300"></i>{global ? 'Global messages' : 'Messages'}
	</a>
	<input
		bind:this={nameInput}
		type="text"
		bind:value={name}
		maxlength={MESSAGE_LIMITS.name}
		placeholder="Name this message. Only you see the name."
		aria-label="Message name"
		class="bg-ash-800 border-ash-700 text-ash-100 placeholder-ash-500 focus:ring-ash-500 min-w-0 flex-1 basis-48 rounded-lg border px-3 py-2 text-sm font-semibold focus:ring-2 focus:outline-none"
	/>
	{#if messageId !== null}
		<button type="button" class="{GHOST_BUTTON} py-2" onclick={() => (confirmDelete = true)}><i class="fas fa-trash text-red-300"></i>Delete</button>
	{/if}
	<button
		type="button"
		onclick={() => save()}
		disabled={saving || (!dirty && messageId !== null)}
		class="bg-ash-600 hover:bg-ash-500 text-ash-100 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
	>
		<i class="fas {saving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}"></i>
		{#if !dirty && messageId !== null}Saved{:else if data.posts.length > 0}Save and update {copies}{:else}Save{/if}
	</button>
	<button
		type="button"
		onclick={openSend}
		disabled={saving}
		class="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<i class="fas fa-paper-plane"></i>Send
		{#if data.posts.length > 0}
			<span class="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold">{global ? `in ${copies}` : `${data.posts.length} posted`}</span>
		{/if}
	</button>
</div>

<div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
	<div class="min-w-0">
		<MessageCanvas
			bind:doc
			bind:lang
			bind:mode
			bind:menuOpen
			channel={global ? 'bot-updates' : 'your-channel'}
			server={data.serverName}
			bot={data.bot}
			context={markdownContext}
			resolve={resolveMessage}
			selected={selection?.id ?? null}
			{flagged}
			insideBox={!!box}
			{uploading}
			onselect={select}
			onclear={() => (selection = null)}
			onadd={add}
			onfile={addFile}
			onaddbutton={addButton}
			onaddinside={(containerId) => {
				select(containerId);
				menuOpen = true;
			}}
			onremovelanguage={(code) => (confirmLanguage = code)}
		/>
	</div>

	<aside
		class="{PANEL} min-w-0 {editingPart
			? 'fixed inset-x-0 bottom-0 z-40 max-h-[55vh] overflow-y-auto rounded-b-none shadow-2xl lg:sticky lg:inset-x-auto lg:top-4 lg:bottom-auto lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:rounded-xl lg:shadow-none'
			: 'lg:sticky lg:top-4'}"
	>
		{#if editingPart}
			<PartInspector bind:doc bind:selection {nonce} />
		{:else}
			<h3 class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-wand-magic-sparkles text-fuchsia-300"></i>How it works</h3>
			<ul class="mt-3 flex flex-col gap-2.5">
				{#each STEPS as step (step.icon)}
					<li class="text-ash-300 flex items-start gap-2.5 text-sm">
						<span class="bg-ash-700 text-ash-200 grid size-6 shrink-0 place-items-center rounded-md text-[11px]"><i class="fas {step.icon}"></i></span>
						<span>{step.text}</span>
					</li>
				{/each}
			</ul>
			{#if lang !== doc.language}
				<p class="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-100">
					You are translating into {serverLanguageLabel(lang)}. Anything you leave empty shows the {serverLanguageLabel(doc.language)} text.
				</p>
			{/if}
		{/if}

		{#if issues.length > 0 && !editingPart}
			<div class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
				<p class="flex items-center gap-2 text-sm font-semibold text-amber-200"><i class="fas fa-triangle-exclamation text-amber-400"></i>Fix before saving</p>
				<ul class="mt-2 flex flex-col gap-1">
					{#each issues as issue (issue.text)}
						<li>
							<button
								type="button"
								disabled={!issue.part}
								onclick={() => openIssue(issue)}
								class="w-full rounded-md px-1.5 py-1 text-left text-xs text-amber-100/90 enabled:hover:bg-amber-500/15"
							>
								{issue.text}{#if issue.part}<i class="fas fa-arrow-right ml-1.5 text-[10px] opacity-70"></i>{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</aside>
</div>

{#if editingPart}
	<div class="h-[55vh] lg:hidden"></div>
{/if}

<SendDialog
	bind:open={
		() => sendOpen,
		(next) => {
			sendOpen = next;
			if (!next && page.url.searchParams.has('send')) goto(page.url.pathname, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}
	{global}
	channels={data.channels}
	categories={data.categories}
	{mentionRoles}
	languages={doc.languages}
	posts={data.posts}
	{sending}
	{removing}
	onsend={send}
	onremove={(post) => (confirmPost = post)}
/>

<ConfirmModal
	open={confirmDelete}
	title="Delete this message?"
	message={data.posts.length > 0
		? `"${name}" is deleted from the panel. Its copies in ${copies} stay in Discord, but buttons and dropdowns are taken off because they would stop working.`
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
	message={confirmPost === 'all'
		? `Every posted copy is deleted from Discord, in ${copies}. The message stays saved here.`
		: confirmPost
			? `The copy in ${confirmPost.server_name ? `${confirmPost.server_name}, ` : ''}#${confirmPost.channel_name} is deleted from Discord. The message stays saved here.`
			: ''}
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
