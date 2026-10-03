<script lang="ts">
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { DURATION_UNITS, MODERATION_ACTION_META, splitDuration } from '$lib/frontend/moderation.js';
	import {
		ESCALATION_ACTIONS,
		ESCALATION_TIMED_ACTIONS,
		MAX_ESCALATION_STEPS,
		MAX_REASON_PRESETS,
		MAX_REASON_PRESET_LENGTH,
		type EscalationAction,
		type ModerationRules
	} from '$lib/moderation-rules.js';

	interface Props {
		serverId: number | string;
		rules: ModerationRules;
		onsaved?: () => void | Promise<void>;
	}

	let { serverId, rules, onsaved }: Props = $props();

	type StepDraft = { warns: number; action: string; amount: number; unit: string };
	const timed = (action: string) => ESCALATION_TIMED_ACTIONS.includes(action as EscalationAction);

	const ACTION_OPTIONS = ESCALATION_ACTIONS.map((a) => ({ value: a, label: MODERATION_ACTION_META[a].label }));

	let expiryDays = $state(0);
	let steps = $state<StepDraft[]>([]);
	let presets = $state<string[]>([]);
	let newPreset = $state('');
	let busy = $state(false);

	$effect(() => {
		expiryDays = rules.warn_expiry_days;
		steps = rules.escalation.map((s) => ({ warns: s.warns, action: s.action, ...splitDuration(s.duration_seconds ?? 3600) }));
		presets = [...rules.reason_presets];
	});

	function addStep() {
		const last = steps[steps.length - 1];
		steps = [...steps, { warns: (last?.warns ?? 2) + 1, action: 'timeout', amount: 1, unit: '3600' }];
	}

	function addPreset() {
		const text = newPreset.trim();
		if (!text) return;
		if (presets.some((p) => p.toLowerCase() === text.toLowerCase())) return showToast('That reason is already saved', 'error');
		presets = [...presets, text];
		newPreset = '';
	}

	async function save() {
		busy = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/moderation/rules`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					warn_expiry_days: Math.max(0, Math.trunc(Number(expiryDays) || 0)),
					escalation: steps.map((s) => ({
						warns: Math.trunc(Number(s.warns)),
						action: s.action,
						duration_seconds: timed(s.action) ? Math.round(Number(s.amount) * Number(s.unit)) : null
					})),
					reason_presets: presets
				})
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not save the rules', 'error');
			showToast('Rules saved', 'success');
			await onsaved?.();
		} finally {
			busy = false;
		}
	}
</script>

<div class="grid gap-3 lg:grid-cols-3">
	<div class="bg-ash-700 border-ash-600 flex flex-col gap-2 rounded-lg border p-3 sm:p-4">
		<p class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-hourglass-end text-amber-400"></i>Warnings expire</p>
		<div class="flex items-center gap-2">
			<input
				type="number"
				min="0"
				max="3650"
				bind:value={expiryDays}
				aria-label="Days before a warning expires"
				class="bg-ash-800 border-ash-600 text-ash-100 w-24 rounded-lg border px-3 py-2 text-sm"
			/>
			<span class="text-ash-300 text-sm">days</span>
		</div>
		<p class="text-ash-500 text-xs">Example: 30 = a warning stops counting after 30 days. 0 = never.</p>
	</div>

	<div class="bg-ash-700 border-ash-600 flex flex-col gap-2 rounded-lg border p-3 sm:p-4 lg:col-span-2">
		<p class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-stairs text-orange-400"></i>Auto-escalation</p>
		<p class="text-ash-500 text-xs">Example: at 3 warnings, time out for 1 hour. The bot does it right after the warning.</p>
		{#each steps as step, i (i)}
			<div class="bg-ash-800 border-ash-600 flex flex-wrap items-center gap-2 rounded-lg border p-2">
				<span class="text-ash-300 text-xs">At</span>
				<input
					type="number"
					min="1"
					max="100"
					bind:value={step.warns}
					aria-label="Warnings"
					class="bg-ash-700 border-ash-600 text-ash-100 w-16 rounded-lg border px-2 py-1.5 text-sm"
				/>
				<span class="text-ash-300 text-xs">warnings</span>
				<div class="w-40">
					<LabeledSelect appearance="field" options={ACTION_OPTIONS} bind:value={step.action} ariaLabel="Action" />
				</div>
				{#if timed(step.action)}
					<input
						type="number"
						min="1"
						bind:value={step.amount}
						aria-label="Duration"
						class="bg-ash-700 border-ash-600 text-ash-100 w-16 rounded-lg border px-2 py-1.5 text-sm"
					/>
					<div class="w-28">
						<LabeledSelect appearance="field" options={DURATION_UNITS} bind:value={step.unit} ariaLabel="Duration unit" />
					</div>
				{/if}
				<button
					type="button"
					onclick={() => (steps = steps.filter((_, j) => j !== i))}
					aria-label="Remove step"
					class="text-ash-400 ml-auto px-2 hover:text-red-400"
				>
					<i class="fas fa-trash"></i>
				</button>
			</div>
		{/each}
		{#if steps.length < MAX_ESCALATION_STEPS}
			<button type="button" onclick={addStep} class="text-ash-200 border-ash-600 hover:bg-ash-600 self-start rounded-lg border px-3 py-1.5 text-xs">
				<i class="fas fa-plus mr-1 text-emerald-400"></i>Add step
			</button>
		{/if}
	</div>

	<div class="bg-ash-700 border-ash-600 flex flex-col gap-2 rounded-lg border p-3 sm:p-4 lg:col-span-3">
		<p class="text-ash-100 flex items-center gap-2 text-sm font-semibold"><i class="fas fa-list-check text-sky-400"></i>Reason presets</p>
		<p class="text-ash-500 text-xs">Reasons you pick from when moderating, instead of typing. Example: Spamming in chat.</p>
		<div class="flex gap-2">
			<input
				type="text"
				maxlength={MAX_REASON_PRESET_LENGTH}
				bind:value={newPreset}
				onkeydown={(e) => e.key === 'Enter' && addPreset()}
				placeholder="e.g. Spamming in chat"
				aria-label="New reason preset"
				class="bg-ash-800 border-ash-600 text-ash-100 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
			/>
			<button
				type="button"
				onclick={addPreset}
				disabled={presets.length >= MAX_REASON_PRESETS}
				class="bg-ash-600 hover:bg-ash-500 text-ash-100 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
			>
				Add
			</button>
		</div>
		{#if presets.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each presets as p, i (p)}
					<span class="bg-ash-800 border-ash-600 text-ash-200 inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-3 text-xs">
						<span class="truncate">{p}</span>
						<button
							type="button"
							onclick={() => (presets = presets.filter((_, j) => j !== i))}
							aria-label="Remove preset"
							class="text-ash-400 hover:text-red-400"
						>
							<i class="fas fa-xmark"></i>
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>
</div>

<button
	type="button"
	onclick={save}
	disabled={busy}
	class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
>
	<i class="fas {busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}"></i>Save rules
</button>
