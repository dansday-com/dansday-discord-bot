<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let saving = $state(false);

	let baseXP = $state<number>(data.settings?.REQUIREMENTS?.BASE_XP ?? 100);
	let multiplier = $state<number>(data.settings?.REQUIREMENTS?.MULTIPLIER ?? 1.5);

	let messageXP = $state<number>(data.settings?.MESSAGE?.XP ?? 15);
	let messageCooldown = $state<number>(data.settings?.MESSAGE?.COOLDOWN_SECONDS ?? 60);

	let voiceXPPerMinute = $state<number>(data.settings?.VOICE?.XP_PER_MINUTE ?? 10);
	let voiceAfkXPPerMinute = $state<number>(data.settings?.VOICE?.AFK_XP_PER_MINUTE ?? 5);
	let voiceCooldown = $state<number>(data.settings?.VOICE?.COOLDOWN_SECONDS ?? 60);

	let progressChannel = $state<string>(data.settings?.PROGRESS_CHANNEL_ID ?? '');

	const xpOptions = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);
	const cooldownOptions = Array.from({ length: 13 }, (_, i) => i * 15);
	const baseXPOptions = Array.from({ length: 20 }, (_, i) => (i + 1) * 50);
	const multiplierOptions = Array.from({ length: 11 }, (_, i) => parseFloat((1.0 + i * 0.1).toFixed(1)));

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: 'leveling',
					PROGRESS_CHANNEL_ID: progressChannel,
					REQUIREMENTS: { BASE_XP: baseXP, MULTIPLIER: multiplier },
					MESSAGE: { XP: messageXP, COOLDOWN_SECONDS: messageCooldown },
					VOICE: { XP_PER_MINUTE: voiceXPPerMinute, AFK_XP_PER_MINUTE: voiceAfkXPPerMinute, COOLDOWN_SECONDS: voiceCooldown }
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
		<i class="fas fa-chart-line text-ash-300"></i>Leveling
	</h3>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-trophy mr-1"></i>Base XP
		</label>
		<p class="text-ash-500 mb-2 text-xs">XP required to reach level 2. Higher levels use exponential formula: Base XP × (Multiplier ^ (Level - 2))</p>
		<select
			bind:value={baseXP}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each baseXPOptions as val}
				<option value={val}>{val}</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-chart-line mr-1"></i>Multiplier
		</label>
		<p class="text-ash-500 mb-2 text-xs">Exponential multiplier for level requirements. Higher values make leveling progressively harder.</p>
		<select
			bind:value={multiplier}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each multiplierOptions as val}
				<option value={val}>{val}x</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-comment mr-1"></i>XP Per Message
		</label>
		<p class="text-ash-500 mb-2 text-xs">XP awarded for each eligible message (must pass cooldown and have member role).</p>
		<select
			bind:value={messageXP}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each xpOptions as val}
				<option value={val}>{val}</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-clock mr-1"></i>Message Cooldown (seconds)
		</label>
		<p class="text-ash-500 mb-2 text-xs">Minimum time between messages to earn XP. Messages sent too quickly won't award XP.</p>
		<select
			bind:value={messageCooldown}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each cooldownOptions as val}
				<option value={val}>{val}s</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-microphone mr-1"></i>Active Voice XP (per cooldown interval)
		</label>
		<p class="text-ash-500 mb-2 text-xs">XP awarded per cooldown interval when actively in voice.</p>
		<select
			bind:value={voiceXPPerMinute}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each xpOptions as val}
				<option value={val}>{val}</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-pause mr-1"></i>AFK Voice XP (per cooldown interval)
		</label>
		<p class="text-ash-500 mb-2 text-xs">XP awarded per cooldown interval when AFK in voice.</p>
		<select
			bind:value={voiceAfkXPPerMinute}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each xpOptions as val}
				<option value={val}>{val}</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-clock mr-1"></i>Voice Cooldown (seconds)
		</label>
		<p class="text-ash-500 mb-2 text-xs">How often voice XP is checked and awarded. XP amount above is given each interval.</p>
		<select
			bind:value={voiceCooldown}
			class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
		>
			{#each cooldownOptions as val}
				<option value={val}>{val}s</option>
			{/each}
		</select>
	</div>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-hashtag mr-1"></i>Level Progress Notification Channel
		</label>
		<p class="text-ash-500 mb-2 text-xs">Channel for level and rank notifications. Uses default channel if not set.</p>
		<ChannelPicker channels={data.channels} categories={data.categories} value={progressChannel} onchange={(id) => (progressChannel = id)} />
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
