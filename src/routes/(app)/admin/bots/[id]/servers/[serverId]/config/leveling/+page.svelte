<script lang="ts">
	import { DEFAULT_LEVELING_SETTINGS } from '$lib/levelingDefaults.js';
	import { invalidateAll } from '$app/navigation';
	import { SERVER_SETTINGS } from '$lib/backend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import ConfigNumberSelect from '$lib/frontend/components/ConfigNumberSelect.svelte';
	import ChannelPicker from '$lib/frontend/components/ChannelPicker.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import { formatMultiplier, formatSeconds } from '$lib/frontend/numericSelectFormatters.js';
	import { INVITE_ACCOUNT_AGE_DAY_OPTIONS, INVITE_HOLD_HOUR_OPTIONS, INVITE_SHARE_PERCENT_OPTIONS, INVITE_STAFF_MULTIPLIER } from '$lib/invites.js';
	import { HOURS_PER_DAY } from '$lib/utils/time.js';
	import type { PageProps } from './$types';

	const STEPPED_OPTION_COUNT = 20;
	const XP_STEP = 5;
	const COOLDOWN_OPTION_COUNT = 13;
	const COOLDOWN_STEP_SECONDS = 15;
	const BASE_XP_STEP = 50;
	const INVITE_XP_STEP = 50;
	const MULTIPLIER_OPTION_COUNT = 11;
	const MULTIPLIER_STEP = 0.1;

	let { data }: PageProps = $props();

	let isSaving = $state(false);
	let featureEnabled = $state(data.settings?.enabled === true);

	let baseXP = $state<number>(data.settings?.REQUIREMENTS?.BASE_XP ?? DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.BASE_XP);
	let multiplier = $state<number>(data.settings?.REQUIREMENTS?.MULTIPLIER ?? DEFAULT_LEVELING_SETTINGS.REQUIREMENTS.MULTIPLIER);

	let messageXP = $state<number>(data.settings?.MESSAGE?.XP ?? DEFAULT_LEVELING_SETTINGS.MESSAGE.XP);
	let messageCooldown = $state<number>(data.settings?.MESSAGE?.COOLDOWN_SECONDS ?? DEFAULT_LEVELING_SETTINGS.MESSAGE.COOLDOWN_SECONDS);

	let voiceXPPerMinute = $state<number>(data.settings?.VOICE?.XP_PER_MINUTE ?? DEFAULT_LEVELING_SETTINGS.VOICE.XP_PER_MINUTE);
	let voiceAfkXPPerMinute = $state<number>(data.settings?.VOICE?.AFK_XP_PER_MINUTE ?? DEFAULT_LEVELING_SETTINGS.VOICE.AFK_XP_PER_MINUTE);
	let voiceCooldown = $state<number>(data.settings?.VOICE?.COOLDOWN_SECONDS ?? DEFAULT_LEVELING_SETTINGS.VOICE.COOLDOWN_SECONDS);

	let videoXPPerMinute = $state<number>(data.settings?.VIDEO?.XP_PER_MINUTE ?? 0);
	let streamingXPPerMinute = $state<number>(data.settings?.STREAMING?.XP_PER_MINUTE ?? 0);

	let inviteXP = $state<number>(data.settings?.INVITE?.XP ?? DEFAULT_LEVELING_SETTINGS.INVITE.XP);
	let inviteMinAccountAge = $state<number>(data.settings?.INVITE?.MIN_ACCOUNT_AGE_DAYS ?? DEFAULT_LEVELING_SETTINGS.INVITE.MIN_ACCOUNT_AGE_DAYS);
	let inviteHoldHours = $state<number>(data.settings?.INVITE?.HOLD_HOURS ?? DEFAULT_LEVELING_SETTINGS.INVITE.HOLD_HOURS);
	let inviteSharePercent = $state<number>(data.settings?.INVITE?.SHARE_PERCENT ?? DEFAULT_LEVELING_SETTINGS.INVITE.SHARE_PERCENT);

	let progressChannel = $state<string>(data.settings?.PROGRESS_CHANNEL_ID ?? '');

	const xpValues = Array.from({ length: STEPPED_OPTION_COUNT }, (_, i) => (i + 1) * XP_STEP);
	const cooldownValues = Array.from({ length: COOLDOWN_OPTION_COUNT }, (_, i) => i * COOLDOWN_STEP_SECONDS);
	const baseXPValues = Array.from({ length: STEPPED_OPTION_COUNT }, (_, i) => (i + 1) * BASE_XP_STEP);
	const multiplierValues = Array.from({ length: MULTIPLIER_OPTION_COUNT }, (_, i) => parseFloat((1.0 + i * MULTIPLIER_STEP).toFixed(1)));
	const inviteXPValues = Array.from({ length: STEPPED_OPTION_COUNT }, (_, i) => (i + 1) * INVITE_XP_STEP);

	const formatDays = (v: number) => (v === 0 ? 'Off' : `${v} day${v === 1 ? '' : 's'}`);
	const formatHours = (v: number) =>
		v === 0 ? 'Instant' : v % HOURS_PER_DAY === 0 ? `${v / HOURS_PER_DAY} day${v === HOURS_PER_DAY ? '' : 's'}` : `${v} hour${v === 1 ? '' : 's'}`;

	async function save() {
		isSaving = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/settings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					component: SERVER_SETTINGS.component.leveling,
					enabled: featureEnabled,
					PROGRESS_CHANNEL_ID: progressChannel,
					REQUIREMENTS: { BASE_XP: baseXP, MULTIPLIER: multiplier },
					MESSAGE: { XP: messageXP, COOLDOWN_SECONDS: messageCooldown },
					VOICE: { XP_PER_MINUTE: voiceXPPerMinute, AFK_XP_PER_MINUTE: voiceAfkXPPerMinute, COOLDOWN_SECONDS: voiceCooldown },
					VIDEO: { XP_PER_MINUTE: videoXPPerMinute },
					STREAMING: { XP_PER_MINUTE: streamingXPPerMinute },
					INVITE: { XP: inviteXP, MIN_ACCOUNT_AGE_DAYS: inviteMinAccountAge, HOLD_HOURS: inviteHoldHours, SHARE_PERCENT: inviteSharePercent }
				})
			});
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				invalidateAll();
			} else {
				showToast(d.error || 'Failed to save', 'error');
			}
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="bg-ash-800 border-ash-700 space-y-5 rounded-xl border p-4 sm:p-6">
	<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold">
		<i class="fas fa-chart-line text-lime-400"></i>Leveling
	</h3>
	<p class="text-ash-400 text-xs">Control XP gain, cooldowns, and where progress notifications are posted.</p>

	<ConfigToggleRow
		label="Leveling module"
		description="When off, XP, voice time, and leveling Discord UI are disabled."
		labelIconClass="fas fa-chart-line text-lime-400"
		bind:enabled={featureEnabled}
		ariaLabel="Toggle leveling module"
	/>
	{#if !featureEnabled}
		<p class="flex items-start gap-2 text-xs text-amber-200/90">
			<i class="fas fa-power-off mt-0.5 shrink-0 text-amber-400/90" aria-hidden="true"></i>
			<span>Module is off. Save configuration to apply. Turn the module on to edit the options below.</span>
		</p>
	{/if}
	<div class="space-y-5 transition-opacity" class:pointer-events-none={!featureEnabled} class:opacity-50={!featureEnabled}>
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

		<ConfigNumberSelect
			label="Video / camera XP (per voice interval)"
			description="Extra XP each voice reward tick while camera is on in voice — including if self-muted/deaf (e.g. watch together). 0 disables. Stacks with voice XP (active or AFK rate)."
			labelIconClass="fas fa-video mr-1 text-lime-400"
			values={xpValues}
			bind:value={videoXPPerMinute}
		/>

		<ConfigNumberSelect
			label="Live stream XP (per voice interval)"
			description="Extra XP each tick while using Go Live in voice — including if self-muted/deaf. 0 disables. Stacks with voice and video XP."
			labelIconClass="fas fa-broadcast-tower mr-1 text-lime-400"
			values={xpValues}
			bind:value={streamingXPPerMinute}
		/>

		<div class="space-y-3">
			<ConfigNumberSelect
				label="Invite XP"
				description="XP paid to the inviter for each member who joins and stays."
				labelIconClass="fas fa-user-plus mr-1 text-lime-400"
				values={inviteXPValues}
				bind:value={inviteXP}
			/>
			<p class="text-ash-400 flex items-center gap-2 text-xs">
				<i class="fas fa-shield-halved text-lime-400"></i>Staff earn {(inviteXP * INVITE_STAFF_MULTIPLIER).toLocaleString()} XP per invite ({INVITE_STAFF_MULTIPLIER}×).
			</p>
		</div>

		<div class="space-y-3">
			<ConfigNumberSelect
				label="Invite share"
				description="Share of the chat and voice XP an invited member earns that also goes to their inviter, for as long as they stay. Off disables it."
				labelIconClass="fas fa-people-arrows mr-1 text-lime-400"
				values={INVITE_SHARE_PERCENT_OPTIONS}
				bind:value={inviteSharePercent}
				formatOption={(v) => (v === 0 ? 'Off' : `${v}%`)}
			/>
			{#if inviteSharePercent > 0}
				<p class="text-ash-400 flex items-center gap-2 text-xs">
					<i class="fas fa-shield-halved text-lime-400"></i>Staff get {inviteSharePercent * INVITE_STAFF_MULTIPLIER}% ({INVITE_STAFF_MULTIPLIER}×).
				</p>
			{/if}
		</div>

		<ConfigNumberSelect
			label="Invite hold time"
			description="How long the new member must stay before the inviter is paid. Leaving earlier pays nothing."
			labelIconClass="fas fa-hourglass-half mr-1 text-lime-400"
			values={INVITE_HOLD_HOUR_OPTIONS}
			bind:value={inviteHoldHours}
			formatOption={formatHours}
		/>

		<ConfigNumberSelect
			label="Minimum account age"
			description="Accounts younger than this count as fake invites and pay no XP."
			labelIconClass="fas fa-user-clock mr-1 text-lime-400"
			values={INVITE_ACCOUNT_AGE_DAY_OPTIONS}
			bind:value={inviteMinAccountAge}
			formatOption={formatDays}
		/>

		<p class="text-ash-500 flex items-start gap-2 text-xs">
			<i class="fas fa-circle-info mt-0.5 text-lime-400"></i>
			<span>Invite tracking needs the bot to have the Manage Server permission. Without it, joins are logged with no inviter.</span>
		</p>

		<div>
			<label class="text-ash-300 mb-1.5 block text-xs font-medium">
				<i class="fas fa-hashtag mr-1 text-lime-400"></i>Level Progress Notification Channel
			</label>
			<p class="text-ash-500 mb-2 text-xs">Channel for level and rank notifications.</p>
			<ChannelPicker channels={data.channels} categories={data.categories} value={progressChannel} onchange={(id) => (progressChannel = id)} />
		</div>
	</div>

	<button
		onclick={save}
		disabled={isSaving}
		class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50"
	>
		{#if isSaving}<i class="fas fa-spinner fa-spin"></i>{/if}
		{isSaving ? 'Saving...' : 'Save Configuration'}
	</button>
</div>
