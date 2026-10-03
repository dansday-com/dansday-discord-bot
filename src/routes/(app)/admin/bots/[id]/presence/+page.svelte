<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import type { PageProps } from './$types';

	const PRESENCE_DISCORD_OPTIONS: LabeledSelectOption[] = [
		{ value: 'online', label: 'Online' },
		{ value: 'idle', label: 'Idle' },
		{ value: 'dnd', label: 'Do not disturb' },
		{ value: 'invisible', label: 'Invisible' }
	];

	const PRESENCE_ACTIVITY_OPTIONS: LabeledSelectOption[] = [
		{ value: 'playing', label: 'Playing' },
		{ value: 'streaming', label: 'Streaming' },
		{ value: 'listening', label: 'Listening' },
		{ value: 'watching', label: 'Watching' },
		{ value: 'custom', label: 'Custom' },
		{ value: 'competing', label: 'Competing' }
	];

	let { data }: PageProps = $props();

	function presenceFromServer(p: typeof data.botPresence) {
		return {
			...p,
			activity_url: p.activity_url ?? '',
			activity_state: p.activity_state ?? ''
		};
	}

	let presence = $state(presenceFromServer(data.botPresence));
	let savingPresence = $state(false);

	$effect(() => {
		presence = presenceFromServer(data.botPresence);
	});

	async function savePresence() {
		savingPresence = true;
		try {
			const urlStr = typeof presence.activity_url === 'string' ? presence.activity_url.trim() : '';
			const stateStr = typeof presence.activity_state === 'string' ? presence.activity_state.trim() : '';
			const isCustom = presence.activity_type === 'custom';
			const res = await fetch(`/api/bots/${data.bot.id}/presence`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					discord_status: presence.discord_status,
					activity_type: presence.activity_type,
					activity_name: isCustom ? '' : presence.activity_name,
					activity_url: urlStr === '' ? null : urlStr,
					activity_state: stateStr === '' ? null : stateStr
				})
			});
			const d = await res.json();
			if (!res.ok) {
				showToast(d.error || 'Failed to save presence', 'error');
				return;
			}
			showToast('Discord presence saved', 'success');
			await invalidateAll();
		} finally {
			savingPresence = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 mb-1 text-lg font-semibold">
		<i class="fas fa-circle-notch mr-2 text-violet-400"></i>Discord presence
	</h3>
	<p class="text-ash-400 mb-4 text-sm">
		Updates apply about every 30 seconds while running, or after restart. Streaming: <strong class="text-ash-300">Twitch</strong> or
		<strong class="text-ash-300">YouTube</strong> URLs only.
	</p>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="min-w-0">
			<LabeledSelect
				id="presence-discord-status"
				label="Visibility"
				labelIconClass="fas fa-eye text-violet-400"
				labelTone="cyan"
				appearance="dashboard"
				options={PRESENCE_DISCORD_OPTIONS}
				bind:value={presence.discord_status}
				ariaLabel="Discord visibility"
			/>
		</div>
		<div class="min-w-0">
			<LabeledSelect
				id="presence-activity-type"
				label="Activity type"
				labelIconClass="fas fa-gamepad text-violet-400"
				labelTone="cyan"
				appearance="dashboard"
				options={PRESENCE_ACTIVITY_OPTIONS}
				bind:value={presence.activity_type}
				ariaLabel="Discord activity type"
			/>
		</div>
		{#if presence.activity_type === 'custom'}
			<div class="sm:col-span-2">
				<label for="presence-activity-state" class="text-ash-400 mb-1 block text-xs">Custom status</label>
				<input
					id="presence-activity-state"
					type="text"
					maxlength="128"
					bind:value={presence.activity_state}
					placeholder="Text shown as custom status"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>
		{:else}
			<div class="sm:col-span-2">
				<label for="presence-activity-name" class="text-ash-400 mb-1 block text-xs">Activity name</label>
				<input
					id="presence-activity-name"
					type="text"
					maxlength="128"
					bind:value={presence.activity_name}
					placeholder="e.g. your community name or track title"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>
			{#if presence.activity_type === 'streaming'}
				<div class="sm:col-span-2">
					<label for="presence-activity-url" class="text-ash-400 mb-1 block text-xs">Stream URL</label>
					<p class="text-ash-500 mb-1 text-xs">Must be a Twitch or YouTube watch URL. You can paste without https://.</p>
					<input
						id="presence-activity-url"
						type="text"
						inputmode="url"
						autocomplete="url"
						bind:value={presence.activity_url}
						placeholder="https://twitch.tv/yourchannel or https://youtube.com/watch?v=…"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
					/>
				</div>
			{/if}
			<div class="sm:col-span-2">
				<label for="presence-activity-state-noncustom" class="text-ash-400 mb-1 block text-xs">State</label>
				<input
					id="presence-activity-state-noncustom"
					type="text"
					maxlength="128"
					bind:value={presence.activity_state}
					placeholder="Extra line under the activity, if supported"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder:text-ash-500 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
				/>
			</div>
		{/if}
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-3">
		<button
			type="button"
			onclick={savePresence}
			disabled={savingPresence}
			class="text-ash-100 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if savingPresence}
				<i class="fas fa-spinner fa-spin mr-2"></i>Saving…
			{:else}
				<i class="fas fa-save mr-2"></i>Save presence
			{/if}
		</button>
	</div>
</div>
