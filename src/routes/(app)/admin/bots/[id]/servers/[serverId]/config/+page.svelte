<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { DEFAULT_SERVER_LANGUAGE, SERVER_LANGUAGES, serverLanguageLabel } from '$lib/languages.js';
	import { BOT_BIO_MAX_LENGTH, DEFAULT_MAIN_EMBED_COLOR } from '$lib/utils/mainConfigSettings.js';
	import {
		BOT_PROFILE_IMAGE,
		BOT_PROFILE_IMAGE_ACCEPT,
		BOT_PROFILE_IMAGE_FORMATS_LABEL,
		imageSizeLabel,
		prepareBotProfileImage,
		type BotProfileImageKind
	} from '$lib/images.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);
	let defaultColor = $state(data.settings?.color ?? DEFAULT_MAIN_EMBED_COLOR);
	let defaultFooter = $state(data.settings?.footer ?? '');
	let botUpdatesChannel = $state(data.settings?.bot_updates_channel_id ?? '');
	let moderationLogChannel = $state(data.settings?.moderation_log_channel_id ?? '');
	let botNickname = $state(data.settings?.bot_nickname ?? '');
	let botBio = $state(data.settings?.bot_bio ?? '');
	let staffRoles = $state<string[]>(data.settings?.staff_roles ?? []);
	let language = $state<string>(data.settings?.language ?? DEFAULT_SERVER_LANGUAGE);

	$effect(() => {
		const next = data.defaultFooters[language as keyof typeof data.defaultFooters];
		if (next && untrack(() => Object.values(data.defaultFooters).includes(defaultFooter.trim()))) defaultFooter = next;
	});

	const languageOptions = SERVER_LANGUAGES.map((l) => ({ value: l.code, label: serverLanguageLabel(l.code) }));

	let pending = $state<Record<BotProfileImageKind, string | null | undefined>>({ avatar: undefined, banner: undefined });
	let preparing = $state<BotProfileImageKind | null>(null);
	let inputs: Record<BotProfileImageKind, HTMLInputElement | undefined> = $state({ avatar: undefined, banner: undefined });

	const savedUrl = (kind: BotProfileImageKind) => (kind === 'avatar' ? data.settings?.bot_avatar_url : data.settings?.bot_banner_url) || '';
	const shown = (kind: BotProfileImageKind) => (pending[kind] === undefined ? savedUrl(kind) : (pending[kind] ?? ''));
	const avatarPreview = $derived(shown('avatar') || data.bot?.bot_icon || '');
	const bannerPreview = $derived(shown('banner'));
	const displayName = $derived(botNickname.trim() || data.bot?.name || 'Bot');

	async function pick(kind: BotProfileImageKind, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		preparing = kind;
		try {
			pending[kind] = await prepareBotProfileImage(file, kind);
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Could not read the image', 'error');
		} finally {
			preparing = null;
		}
	}

	function reset(kind: BotProfileImageKind) {
		pending[kind] = savedUrl(kind) ? null : undefined;
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.main,
					color: defaultColor,
					footer: defaultFooter,
					bot_updates_channel_id: botUpdatesChannel,
					moderation_log_channel_id: moderationLogChannel,
					bot_nickname: botNickname,
					bot_bio: botBio,
					...(pending.avatar !== undefined && { bot_avatar: pending.avatar }),
					...(pending.banner !== undefined && { bot_banner: pending.banner }),
					staff_roles: staffRoles,
					language
				})
			});
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				pending = { avatar: undefined, banner: undefined };
				invalidateAll();
			} else {
				showToast(d.error || 'Failed to save', 'error');
				if (d.saved) {
					pending = { avatar: undefined, banner: undefined };
					invalidateAll();
				}
			}
		} finally {
			saving = false;
		}
	}
</script>

{#snippet imageField(kind: BotProfileImageKind, icon: string, help: string)}
	{@const spec = BOT_PROFILE_IMAGE[kind]}
	{@const hasImage = !!shown(kind)}
	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas {icon} mr-1.5 text-emerald-400"></i>Bot {spec.label}
		</label>
		<p class="text-ash-500 mb-2 text-xs">
			{help}
			{BOT_PROFILE_IMAGE_FORMATS_LABEL}, up to {imageSizeLabel(spec.maxBytes)}. Resized to {spec.width}×{spec.height}.
		</p>
		<input bind:this={inputs[kind]} type="file" accept={BOT_PROFILE_IMAGE_ACCEPT} class="hidden" onchange={(e) => pick(kind, e)} />
		<div class="flex flex-col gap-2 sm:flex-row">
			<button
				type="button"
				onclick={() => inputs[kind]?.click()}
				disabled={preparing !== null}
				class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all disabled:opacity-50"
			>
				<i class="fas {preparing === kind ? 'fa-spinner fa-spin' : 'fa-upload'}"></i>{hasImage ? 'Replace' : 'Upload'}
				{spec.label.toLowerCase()}
			</button>
			<button
				type="button"
				onclick={() => reset(kind)}
				disabled={!hasImage}
				class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all disabled:opacity-50"
			>
				<i class="fas fa-rotate-left"></i>Use default
			</button>
		</div>
	</div>
{/snippet}

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-gear text-emerald-400"></i>Main
	</h3>
	<p class="text-ash-400 text-xs">Set how the bot looks and speaks in this server, and the embed style used across it.</p>

	<div>
		<label for="main-server-language" class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-language mr-1.5 text-emerald-400"></i>Server Language
		</label>
		<p class="text-ash-500 mb-2 text-xs">
			Used for the channels /setup creates, the menu, approval posts, every public bot message, and the AI's chat and voice. Members who pick their own language
			in the menu still get their private replies and DMs in it. Changing this renames the setup channels and refreshes the menu.
		</p>
		<LabeledSelect id="main-server-language" appearance="field" options={languageOptions} bind:value={language} ariaLabel="Server language" />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-robot mr-1.5 text-emerald-400"></i>Bot Nickname
		</label>
		<p class="text-ash-500 mb-2 text-xs">Custom nickname for the bot in this server. Leave empty to use the default name.</p>
		<input
			type="text"
			bind:value={botNickname}
			placeholder="Leave empty for default"
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
			maxlength="32"
		/>
	</div>

	<div class="bg-ash-900 border-ash-600 overflow-hidden rounded-lg border">
		<div class="bg-ash-700 aspect-5/2 w-full">
			{#if bannerPreview}
				<img src={bannerPreview} alt="Bot banner" class="h-full w-full object-cover" />
			{/if}
		</div>
		<div class="flex items-end gap-3 px-3 pb-3">
			<div class="border-ash-900 bg-ash-700 -mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-full border-4">
				{#if avatarPreview}
					<img src={avatarPreview} alt="Bot avatar" class="h-full w-full object-cover" />
				{/if}
			</div>
			<p class="text-ash-100 min-w-0 truncate text-sm font-semibold">{displayName}</p>
		</div>
		{#if botBio.trim()}
			<p class="text-ash-300 px-3 pb-3 text-xs wrap-break-word whitespace-pre-line">{botBio}</p>
		{/if}
	</div>

	{@render imageField('avatar', 'fa-circle-user', 'Profile picture for the bot in this server only.')}
	{@render imageField('banner', 'fa-image', 'Profile banner for the bot in this server only.')}

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-address-card mr-1.5 text-emerald-400"></i>Bot Bio
		</label>
		<p class="text-ash-500 mb-2 text-xs">About Me shown on the bot's profile in this server. Leave empty to use the default.</p>
		<textarea
			bind:value={botBio}
			rows="3"
			maxlength={BOT_BIO_MAX_LENGTH}
			placeholder="Leave empty for default"
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
		></textarea>
		<p class="text-ash-500 mt-1 text-right text-xs">{botBio.length}/{BOT_BIO_MAX_LENGTH}</p>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-palette mr-1.5 text-emerald-400"></i>Default Color
		</label>
		<p class="text-ash-500 mb-2 text-xs">Embed accent color used by default (hex).</p>
		<div class="flex items-center gap-2">
			<input
				type="color"
				bind:value={defaultColor}
				oninput={(e) => (defaultColor = (e.target as HTMLInputElement).value)}
				class="bg-ash-700 border-ash-600 h-9 w-10 cursor-pointer rounded border"
			/>
			<input
				type="text"
				bind:value={defaultColor}
				placeholder={DEFAULT_MAIN_EMBED_COLOR}
				class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 flex-1 rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
			/>
		</div>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-align-left mr-1.5 text-emerald-400"></i>Default Footer</label>
		<p class="text-ash-500 mb-2 text-xs">Footer text shown on most bot embeds. The default follows the server language.</p>
		<input
			type="text"
			bind:value={defaultFooter}
			placeholder={data.defaultFooters[language as keyof typeof data.defaultFooters]}
			class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
		/>
		<div class="bg-ash-900 border-ash-600 mt-2 rounded-lg border p-3">
			<p class="text-ash-200 mb-2 text-xs font-medium">Available placeholders:</p>
			<div class="grid grid-cols-2 gap-2 text-xs">
				<div class="text-ash-300 flex items-center gap-2">
					<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">{'{server}'}</code>
					<span>Server name</span>
				</div>
				<div class="text-ash-300 flex items-center gap-2">
					<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">{'{year}'}</code>
					<span>Current year</span>
				</div>
			</div>
		</div>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-bullhorn mr-1.5 text-emerald-400"></i>Bot Updates Channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Channel to receive announcements and changelogs from the bot developers.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={botUpdatesChannel} onchange={(id) => (botUpdatesChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-gavel mr-1.5 text-emerald-400"></i>Moderation Logs Channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Optional. Where moderation case embeds post. Every case is always in the panel's Moderation tab.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={moderationLogChannel} onchange={(id) => (moderationLogChannel = id)} />
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-user-tie mr-1.5 text-emerald-400"></i>Staff Roles
		</label>
		<p class="text-ash-500 mb-2 text-xs">Roles treated as staff across the bot, and used for staff member filtering.</p>
		<RolePicker roles={data.roles} value={staffRoles} onchange={(v) => (staffRoles = v as string[])} />
	</div>

	<button
		onclick={save}
		disabled={saving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{saving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
