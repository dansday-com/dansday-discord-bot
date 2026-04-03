<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import RolePicker from '$lib/frontend/components/RolePicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Forwarder = {
		selfbot_id: number | '';
		selfbot_name?: string;
		server_id: number | '';
		source_channels: string[];
		source_channel_names?: string[];
		target_channel_id: string;
		role_pings: string[];
		only_forward_when_mentions_member: boolean;
		tag: string;
	};

	let saving = $state(false);
	let forwarders = $state<Forwarder[]>((data.settings?.forwarders ?? []) as Forwarder[]);

	let modalOpen = $state(false);
	let editIndex = $state<number | null>(null);
	let draft = $state<Forwarder>(emptyForwarder());

	let selfbots = $state<any[]>([]);
	let selfbotServers = $state<any[]>([]);
	let selfbotChannels = $state<any[]>([]);
	let selfbotCategories = $state<any[]>([]);
	let loadingServers = $state(false);
	let loadingChannels = $state(false);

	function emptyForwarder(): Forwarder {
		return { selfbot_id: '', server_id: '', source_channels: [], target_channel_id: '', role_pings: [], only_forward_when_mentions_member: false, tag: '' };
	}

	$effect(() => {
		// Needed so the list view can show selfbot names.
		if (selfbots.length === 0) loadSelfbots();
	});

	async function openAdd() {
		draft = emptyForwarder();
		editIndex = null;
		selfbots = [];
		selfbotServers = [];
		selfbotChannels = [];
		await loadSelfbots();
		modalOpen = true;
	}

	async function openEdit(i: number) {
		const fw = forwarders[i];
		draft = { ...fw, source_channels: [...(fw.source_channels ?? [])], role_pings: [...(fw.role_pings ?? [])] };
		editIndex = i;
		selfbots = [];
		selfbotServers = [];
		selfbotChannels = [];
		await loadSelfbots();
		if (draft.selfbot_id) await loadServers(draft.selfbot_id);
		if (draft.selfbot_id && draft.server_id) await loadChannels(draft.selfbot_id, draft.server_id);
		modalOpen = true;
	}

	async function loadSelfbots() {
		try {
			const res = await fetch(`/api/bots/${data.botId}/selfbots`, { credentials: 'include' });
			if (res.ok) selfbots = await res.json();
		} catch (_) {}
	}

	async function loadServers(selfbotId: number | '') {
		if (!selfbotId) {
			selfbotServers = [];
			selfbotChannels = [];
			selfbotCategories = [];
			return;
		}
		loadingServers = true;
		try {
			const res = await fetch(`/api/bots/${selfbotId}/servers`, { credentials: 'include' });
			if (res.ok) selfbotServers = await res.json();
		} catch (_) {}
		loadingServers = false;
	}

	async function loadChannels(selfbotId: number | '', serverId: number | '') {
		if (!selfbotId || !serverId) {
			selfbotChannels = [];
			selfbotCategories = [];
			return;
		}
		loadingChannels = true;
		try {
			const server = selfbotServers.find((s: any) => s.id == serverId);
			const discordServerId = server?.discord_server_id ?? '';
			const res = await fetch(`/api/bots/${selfbotId}/servers/${serverId}/channels?discordServerId=${discordServerId}`, { credentials: 'include' });
			if (res.ok) {
				const d = await res.json();
				selfbotChannels = d?.channels ?? [];
				selfbotCategories = d?.categories ?? [];
			}
		} catch (_) {}
		loadingChannels = false;
	}

	async function onSelfbotChange(e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		draft = { ...draft, selfbot_id: val ? Number(val) : '', server_id: '', source_channels: [] };
		selfbotServers = [];
		selfbotChannels = [];
		selfbotCategories = [];
		if (val) await loadServers(Number(val));
	}

	async function onServerChange(e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		draft = { ...draft, server_id: val ? Number(val) : '', source_channels: [] };
		selfbotChannels = [];
		selfbotCategories = [];
		if (val) await loadChannels(draft.selfbot_id, Number(val));
	}

	function channelName(id: string, list: any[]) {
		return list.find((c: any) => c.discord_channel_id === id)?.name ?? id;
	}

	function selfbotNameById(id: number | '') {
		if (!id) return '';
		const sb = selfbots.find((b: any) => String(b?.id) === String(id));
		return (sb?.name || sb?.username || sb?.userTag || sb?.tag || '') as string;
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
		const entry: Forwarder = { ...draft };
		// Persist friendly names so list view can render without extra API calls.
		entry.selfbot_name = selfbotNameById(entry.selfbot_id) || entry.selfbot_name;
		if (selfbotChannels?.length && entry.source_channels?.length) {
			entry.source_channel_names = entry.source_channels.map((id) => channelName(id, selfbotChannels));
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
				body: JSON.stringify({ component: 'forwarder', forwarders })
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
	<p class="text-ash-400 text-xs">Forward messages from a selfbot's channel to a channel in this server.</p>

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
							{#if fw.selfbot_id}
								<div class="text-ash-100 flex items-center gap-1.5 font-medium">
									<i class="fas fa-robot text-violet-400"></i>{fw.selfbot_name || selfbotNameById(fw.selfbot_id) || `Selfbot #${fw.selfbot_id}`}
								</div>
							{/if}
							{#if fw.source_channels?.length}
								<div class="text-ash-400">
									<span class="text-ash-300 font-medium">From:</span>
									{#if fw.source_channel_names?.length}
										{formatChannelList(fw.source_channel_names)}
									{:else}
										{formatChannelList(fw.source_channels.map((id) => channelName(id, selfbotChannels))) ||
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
							{#if fw.only_forward_when_mentions_member}
								<div class="text-amber-400"><i class="fas fa-at mr-1"></i>Only when mentions selfbot</div>
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
					<label for="fw-selfbot" class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-robot mr-1.5 text-violet-400"></i>Selfbot</label>
					<p class="text-ash-500 mb-2 text-xs">Pick the selfbot account that will forward messages.</p>
					<select
						id="fw-selfbot"
						value={draft.selfbot_id}
						onchange={onSelfbotChange}
						class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
					>
						<option value="">Select selfbot...</option>
						{#each selfbots as bot}
							<option value={bot.id}>{bot.name || `Selfbot ${bot.id}`}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="fw-server" class="text-ash-300 mb-1.5 block text-xs font-medium"
						><i class="fas fa-server mr-1.5 text-violet-400"></i>Server (where selfbot is)</label
					>
					<p class="text-ash-500 mb-2 text-xs">Select the server the selfbot is connected to.</p>
					<select
						id="fw-server"
						value={draft.server_id}
						onchange={onServerChange}
						disabled={!draft.selfbot_id || loadingServers}
						class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none disabled:opacity-50"
					>
						<option value="">{loadingServers ? 'Loading...' : 'Select server...'}</option>
						{#each selfbotServers as server}
							<option value={server.id}>{server.name || `Server ${server.id}`}</option>
						{/each}
					</select>
				</div>

				<div>
					<p class="text-ash-300 mb-1.5 block text-xs font-medium"><i class="fas fa-hashtag mr-1.5 text-violet-400"></i>From Channels</p>
					<p class="text-ash-500 mb-2 text-xs">Messages from these channels will be forwarded.</p>
					{#if loadingChannels}
						<p class="text-ash-500 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i>Loading channels...</p>
					{:else if !draft.server_id}
						<p class="text-ash-500 text-xs italic">Select a server first.</p>
					{:else}
						<ChannelPicker
							channels={selfbotChannels}
							categories={selfbotCategories}
							multi
							value={draft.source_channels}
							placeholder="Select source channels..."
							onchange={(v) => (draft = { ...draft, source_channels: v as string[] })}
						/>
					{/if}
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

				<div>
					<p class="text-ash-500 mb-2 text-xs">Only forward messages that mention the selfbot.</p>
					<label class="flex cursor-pointer items-center gap-3">
						<div class="relative">
							<input type="checkbox" bind:checked={draft.only_forward_when_mentions_member} class="peer sr-only" />
							<div class="bg-ash-600 peer-checked:bg-ash-400 h-6 w-11 rounded-full transition-colors"></div>
							<div class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></div>
						</div>
						<span class="text-ash-300 text-sm">{draft.only_forward_when_mentions_member ? 'Yes' : 'No'}</span>
					</label>
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
