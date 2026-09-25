<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import ServerPicker from '$lib/frontend/components/ServerPicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Forwarder = {
		source_guild_id: string;
		source_guild_name?: string;
		source_channels: string[];
		source_channel_names?: string[];
		target_channel_id: string;
		role_pings: string[];
		only_forward_when_mentions_member: boolean;
		keywords: string[];
		tag: string;
	};

	let saving = $state(false);
	let featureEnabled = $state(data.settings?.enabled === true);
	let forwarders = $state<Forwarder[]>((data.settings?.forwarders ?? []) as Forwarder[]);

	let modalOpen = $state(false);
	let editIndex = $state<number | null>(null);
	let draft = $state<Forwarder>(emptyForwarder());
	let keywordInput = $state('');

	let sourceServers = $state<any[]>(data.sourceServers ?? []);
	let sourceChannels = $state<any[]>([]);
	let sourceCategories = $state<any[]>([]);
	let loadingChannels = $state(false);
	let hydratedListNames = $state(false);

	const channelsCacheByGuild = new Map<string, { channels: any[]; categories: any[] }>();

	function emptyForwarder(): Forwarder {
		return {
			source_guild_id: '',
			source_channels: [],
			target_channel_id: '',
			role_pings: [],
			only_forward_when_mentions_member: false,
			keywords: [],
			tag: ''
		};
	}

	$effect(() => {
		if (!hydratedListNames) hydrateForwarderSourceChannelNames();
	});

	async function fetchSourceChannels(guildId: string): Promise<{ channels: any[]; categories: any[] }> {
		const key = String(guildId);
		if (channelsCacheByGuild.has(key)) return channelsCacheByGuild.get(key) || { channels: [], categories: [] };
		try {
			const res = await fetch(`/api/servers/${data.serverId}/source-servers/${guildId}/channels`, { credentials: 'include' });
			if (!res.ok) return { channels: [], categories: [] };
			const d = await res.json();
			const value = { channels: d?.channels ?? [], categories: d?.categories ?? [] };
			channelsCacheByGuild.set(key, value);
			return value;
		} catch (_) {
			return { channels: [], categories: [] };
		}
	}

	async function hydrateForwarderSourceChannelNames() {
		if (hydratedListNames) return;
		const needs = (forwarders || []).filter((fw) => fw?.source_guild_id && Array.isArray(fw?.source_channels) && fw.source_channels.length > 0);
		if (needs.length === 0) {
			hydratedListNames = true;
			return;
		}

		if (needs.every((fw) => Array.isArray(fw.source_channel_names) && fw.source_channel_names.length === fw.source_channels.length)) {
			hydratedListNames = true;
			return;
		}

		try {
			const updated = [...forwarders];
			for (let i = 0; i < updated.length; i++) {
				const fw = updated[i];
				if (!fw?.source_guild_id || !Array.isArray(fw?.source_channels) || fw.source_channels.length === 0) continue;
				if (Array.isArray(fw.source_channel_names) && fw.source_channel_names.length === fw.source_channels.length) continue;

				const { channels } = await fetchSourceChannels(String(fw.source_guild_id));
				if (!Array.isArray(channels) || channels.length === 0) continue;

				const names = fw.source_channels.map((id) => channelName(id, channels));
				updated[i] = { ...fw, source_channel_names: names };
			}
			forwarders = updated;
		} finally {
			hydratedListNames = true;
		}
	}

	function addKeyword() {
		const value = keywordInput.trim();
		if (!value) return;
		if (draft.keywords.some((k) => k.toLowerCase() === value.toLowerCase())) {
			keywordInput = '';
			return;
		}
		draft = { ...draft, keywords: [...draft.keywords, value] };
		keywordInput = '';
	}

	function removeKeyword(keyword: string) {
		draft = { ...draft, keywords: draft.keywords.filter((k) => k !== keyword) };
	}

	function onKeywordKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addKeyword();
		} else if (e.key === 'Backspace' && keywordInput === '' && draft.keywords.length > 0) {
			draft = { ...draft, keywords: draft.keywords.slice(0, -1) };
		}
	}

	async function openAdd() {
		draft = emptyForwarder();
		editIndex = null;
		keywordInput = '';
		sourceChannels = [];
		sourceCategories = [];
		modalOpen = true;
	}

	async function openEdit(i: number) {
		const fw = forwarders[i];
		draft = {
			...fw,
			source_channels: [...(fw.source_channels ?? [])],
			role_pings: [...(fw.role_pings ?? [])],
			keywords: [...(fw.keywords ?? [])]
		};
		editIndex = i;
		keywordInput = '';
		sourceChannels = [];
		sourceCategories = [];
		if (draft.source_guild_id) await loadChannels(draft.source_guild_id);
		modalOpen = true;
	}

	async function loadChannels(guildId: string) {
		if (!guildId) {
			sourceChannels = [];
			sourceCategories = [];
			return;
		}
		loadingChannels = true;
		const { channels, categories } = await fetchSourceChannels(guildId);
		sourceChannels = channels;
		sourceCategories = categories;
		loadingChannels = false;
	}

	async function onSourceServerChange(val: string) {
		draft = { ...draft, source_guild_id: val, source_channels: [] };
		sourceChannels = [];
		sourceCategories = [];
		if (val) await loadChannels(val);
	}

	function channelName(id: string, list: any[]) {
		return list.find((c: any) => c.discord_channel_id === id)?.name ?? id;
	}

	function sourceServerName(guildId: string) {
		if (!guildId) return '';
		const s = sourceServers.find((sv: any) => String(sv?.discord_server_id) === String(guildId));
		return (s?.name || '') as string;
	}

	function formatChannelList(names: string[], max = 3) {
		const clean = (names || []).map((n) => String(n || '').trim()).filter(Boolean);
		if (clean.length === 0) return '';
		if (clean.length <= max) return clean.map((n) => `#${n}`).join(', ');
		return `${clean
			.slice(0, max)
			.map((n) => `#${n}`)
			.join(', ')} +${clean.length - max}`;
	}

	function saveModal() {
		addKeyword();
		const entry: Forwarder = { ...draft, keywords: [...draft.keywords] };
		entry.source_guild_name = sourceServerName(entry.source_guild_id) || entry.source_guild_name;
		if (sourceChannels?.length && entry.source_channels?.length) {
			entry.source_channel_names = entry.source_channels.map((id) => channelName(id, sourceChannels));
		}
		if (editIndex !== null) {
			const next = [...forwarders];
			next[editIndex] = entry;
			forwarders = next;
		} else {
			forwarders = [...forwarders, entry];
		}
		modalOpen = false;
	}

	function removeForwarder(i: number) {
		forwarders = forwarders.filter((_, idx) => idx !== i);
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.forwarder,
					enabled: featureEnabled,
					forwarders
				})
			});
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				invalidateAll();
			} else showToast(d.error || 'Failed to save', 'error');
		} finally {
			saving = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-forward text-violet-400"></i>Forwarder
	</h3>
	<p class="text-ash-400 text-xs">Forward messages from a linked account's channel to a channel in this server.</p>

	<ConfigToggleRow
		label="Forwarder module"
		description="When off, message forwarding from selfbots is disabled."
		labelIconClass="fas fa-forward text-violet-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle forwarder module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to edit forwarders below.</span>
		</p>
	{/if}
	{#if featureEnabled && !data.hasRunningSelfbot}
		<p class="flex items-start gap-2 rounded-lg border border-red-800/30 bg-red-900/20 p-3 text-xs text-red-200/90">
			<i class="fas fa-exclamation-triangle mt-0.5 shrink-0 text-red-400" aria-hidden="true"></i>
			<span>
				{#if !data.hasSelfbots}
					<strong>No linked account available.</strong> The operator has not linked an account that covers a source server. Ask them to add one.
				{:else}
					<strong>No linked account running.</strong> An account is linked but not online. Ask the operator to start it.
				{/if}
			</span>
		</p>
	{/if}
	<div class="space-y-5 transition-opacity" class:pointer-events-none={!featureEnabled} class:opacity-50={!featureEnabled}>
		<div class="space-y-3">
			{#if forwarders.length === 0}
				<div class="bg-ash-700 rounded-lg p-4 text-center">
					<i class="fas fa-inbox mb-2 text-2xl text-violet-400/80"></i>
					<p class="text-ash-400 text-xs">No forwarders yet. Click Add Forwarder to create one.</p>
				</div>
			{:else}
				{#each forwarders as fw, i}
					<div class="bg-ash-700 border-ash-600 rounded-lg border p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1 space-y-1 text-xs">
								{#if fw.source_guild_id}
									<div class="text-ash-100 flex items-center gap-1.5 font-medium">
										<i class="fas fa-server text-violet-400"></i>{sourceServerName(fw.source_guild_id) ||
											fw.source_guild_name ||
											`Server ${fw.source_guild_id}`}
									</div>
								{/if}
								{#if fw.source_channels?.length}
									<div class="text-ash-400">
										<span class="text-ash-300 font-medium">From:</span>
										{#if fw.source_channel_names?.length}
											{formatChannelList(fw.source_channel_names)}
										{:else}
											{formatChannelList(fw.source_channels.map((id) => channelName(id, sourceChannels))) ||
												`${fw.source_channels.length} channel${fw.source_channels.length !== 1 ? 's' : ''}`}
										{/if}
									</div>
								{/if}
								{#if fw.target_channel_id}
									<div class="text-ash-400">
										<span class="text-ash-300 font-medium">To:</span> #{channelName(fw.target_channel_id, data.channels)}
									</div>
								{/if}
								{#if fw.tag}
									<div class="text-ash-400"><span class="text-ash-300 font-medium">Tag:</span> {fw.tag}</div>
								{/if}
								{#if fw.keywords?.length}
									<div class="text-ash-400">
										<span class="text-ash-300 font-medium">Keywords:</span>
										{fw.keywords.join(', ')}
									</div>
								{/if}
								{#if fw.only_forward_when_mentions_member}
									<div class="text-ash-400 text-xs">
										<i class="fas fa-at mr-1 text-violet-400"></i>Only when mentions the account
									</div>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-1.5">
								<button
									type="button"
									onclick={() => openEdit(i)}
									class="bg-ash-600 hover:bg-ash-500 rounded-lg p-1.5 text-xs text-white transition-colors"
									aria-label="Edit"
								>
									<i class="fas fa-edit"></i>
								</button>
								<button
									type="button"
									onclick={() => removeForwarder(i)}
									class="rounded-lg bg-red-900 p-1.5 text-xs text-red-300 transition-colors hover:bg-red-800"
									aria-label="Delete"
								>
									<i class="fas fa-trash"></i>
								</button>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<button
			type="button"
			onclick={openAdd}
			class="border-ash-600 text-ash-400 hover:text-ash-200 hover:border-ash-400 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm transition-colors"
		>
			<i class="fas fa-plus text-xs"></i>Add Forwarder
		</button>
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

{#if modalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
		<div class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border p-5">
			<div class="mb-5 flex items-center justify-between">
				<h3 class="text-ash-100 flex items-center gap-2 font-bold">
					<i class="fas fa-exchange-alt text-violet-400"></i>
					{editIndex !== null ? 'Edit' : 'Add'} Forwarder
				</h3>
				<button onclick={() => (modalOpen = false)} class="text-ash-400 hover:text-ash-100 transition-colors" aria-label="Close">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="flex-1 space-y-4 overflow-y-auto">
				<div>
					<p class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-server mr-1.5 text-violet-400"></i>Source server</p>
					<p class="text-ash-500 mb-2 text-xs">Select the server messages will be forwarded from.</p>
					<ServerPicker
						servers={sourceServers}
						value={draft.source_guild_id}
						placeholder="Select server..."
						emptyText="No linked source servers"
						onchange={onSourceServerChange}
					/>
				</div>

				<div>
					<p class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-hashtag mr-1.5 text-violet-400"></i>From Channels</p>
					<p class="text-ash-500 mb-2 text-xs">Messages from these channels will be forwarded.</p>
					<ChannelPicker
						channels={sourceChannels}
						categories={sourceCategories}
						multi
						value={draft.source_channels}
						placeholder={loadingChannels ? 'Loading channels…' : draft.source_guild_id ? 'Select source channels...' : 'Select a server first...'}
						emptyText={loadingChannels ? 'Loading channels…' : draft.source_guild_id ? 'No channels found' : 'Select a source server first'}
						onchange={(v) => (draft = { ...draft, source_channels: v as string[] })}
					/>
				</div>

				<div>
					<p class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-bullseye mr-1.5 text-violet-400"></i>Target Channel</p>
					<p class="text-ash-500 mb-2 text-xs">Where forwarded messages will be posted in this server.</p>
					<ChannelPicker
						channels={data.channels}
						categories={data.categories}
						value={draft.target_channel_id}
						placeholder="Select target channel..."
						onchange={(id) => (draft = { ...draft, target_channel_id: id })}
					/>
				</div>

				<div>
					<p class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-user-shield mr-1.5 text-violet-400"></i>Role Pings</p>
					<p class="text-ash-500 mb-2 text-xs">Optional roles to mention on forwarded messages.</p>
					<RolePicker
						roles={data.roles}
						value={draft.role_pings}
						placeholder="Select roles to ping..."
						onchange={(v) => (draft = { ...draft, role_pings: v as string[] })}
					/>
				</div>

				<ConfigToggleRow
					label="Mention filter"
					description="Only forward messages that mention the linked account."
					labelIconClass="fas fa-at text-violet-400"
					enabled={draft.only_forward_when_mentions_member}
					onchange={(v) => (draft = { ...draft, only_forward_when_mentions_member: v })}
					ariaLabel="Toggle mention filter"
				/>

				<div>
					<label for="fw-keyword" class="text-ash-300 mb-1.5 block text-xs font-medium">
						<i class="fas fa-filter mr-1.5 text-violet-400"></i>Keywords <span class="text-ash-500">(optional)</span>
					</label>
					<p class="text-ash-500 mb-2 text-xs">Only forward messages containing a keyword. Empty forwards everything.</p>
					<input
						id="fw-keyword"
						type="text"
						bind:value={keywordInput}
						onkeydown={onKeywordKeydown}
						onblur={addKeyword}
						placeholder="Type keyword, press Enter..."
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
					/>
					{#if draft.keywords.length > 0}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each draft.keywords as keyword}
								<span class="bg-ash-600 text-ash-100 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs">
									{keyword}
									<button
										type="button"
										onclick={() => removeKeyword(keyword)}
										class="hover:text-ash-300 ml-0.5 transition-colors"
										aria-label="Remove keyword {keyword}"
									>
										<i class="fas fa-times text-xs"></i>
									</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>

				<div>
					<label for="fw-tag" class="text-ash-300 mb-1.5 block text-xs font-medium">
						<i class="fas fa-tag mr-1.5 text-violet-400"></i>Tag <span class="text-ash-500">(optional)</span>
					</label>
					<p class="text-ash-500 mb-2 text-xs">Label this forwarder so it’s easier to recognize later.</p>
					<input
						id="fw-tag"
						type="text"
						bind:value={draft.tag}
						placeholder="Enter tag..."
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
					/>
				</div>
			</div>

			<div class="border-ash-700 mt-4 flex gap-2 border-t pt-4">
				<button
					type="button"
					onclick={() => (modalOpen = false)}
					class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={saveModal}
					class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors"
				>
					<i class="fas fa-check"></i>{editIndex !== null ? 'Save Changes' : 'Add Forwarder'}
				</button>
			</div>
		</div>
	</div>
{/if}
