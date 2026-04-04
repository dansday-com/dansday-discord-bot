<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { serverSettingsComponent } from '$lib/serverSettingsComponents.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigNumberSelect from '$lib/frontend/components/ConfigNumberSelect.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import { formatMultiplier, formatSeconds } from '$lib/frontend/numericSelectFormatters.js';
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

	const xpValues = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);
	const cooldownValues = Array.from({ length: 13 }, (_, i) => i * 15);
	const baseXPValues = Array.from({ length: 20 }, (_, i) => (i + 1) * 50);
	const multiplierValues = Array.from({ length: 11 }, (_, i) => parseFloat((1.0 + i * 0.1).toFixed(1)));

	async function save() {
		saving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: serverSettingsComponent.leveling,
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
		<i class="fas fa-chart-line text-lime-400"></i>Leveling
	</h3>
	<p class="text-ash-400 text-xs">Control XP gain, cooldowns, and where progress notifications are posted.</p>

	<ConfigNumberSelect
		label="Base XP"
		description="XP needed to reach level 2. Higher levels scale with Base XP and Multiplier."
		labelIconClass="fas fa-trophy mr-1 text-lime-400"
		values={baseXPValues}
		bind:value={baseXP}
	/>

	<ConfigNumberSelect
		label="Multiplier"
		description="Exponential multiplier for level requirements. Higher values make leveling progressively harder."
		labelIconClass="fas fa-chart-line mr-1 text-lime-400"
		values={multiplierValues}
		bind:value={multiplier}
		formatOption={formatMultiplier}
	/>

	<ConfigNumberSelect
		label="XP Per Message"
		description="XP awarded for each eligible message (must pass cooldown and have member role)."
		labelIconClass="fas fa-comment mr-1 text-lime-400"
		values={xpValues}
		bind:value={messageXP}
	/>

	<ConfigNumberSelect
		label="Message Cooldown (seconds)"
		description="Minimum time between messages to earn XP. Messages sent too quickly won't award XP."
		labelIconClass="fas fa-clock mr-1 text-lime-400"
		values={cooldownValues}
		bind:value={messageCooldown}
		formatOption={formatSeconds}
	/>

	<ConfigNumberSelect
		label="Active Voice XP (per cooldown interval)"
		description="XP granted each interval while active in voice."
		labelIconClass="fas fa-microphone mr-1 text-lime-400"
		values={xpValues}
		bind:value={voiceXPPerMinute}
	/>

	<ConfigNumberSelect
		label="AFK Voice XP (per cooldown interval)"
		description="XP granted each interval while AFK in voice."
		labelIconClass="fas fa-pause mr-1 text-lime-400"
		values={xpValues}
		bind:value={voiceAfkXPPerMinute}
	/>

	<ConfigNumberSelect
		label="Voice Cooldown (seconds)"
		description="How often voice XP is awarded (the XP above is granted each interval)."
		labelIconClass="fas fa-clock mr-1 text-lime-400"
		values={cooldownValues}
		bind:value={voiceCooldown}
		formatOption={formatSeconds}
	/>

	<div>
		<label class="text-ash-300 mb-1.5 block text-xs font-medium">
			<i class="fas fa-hashtag mr-1 text-lime-400"></i>Level Progress Notification Channel
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
