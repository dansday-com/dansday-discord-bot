<script lang="ts">
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import MemberPicker from '$lib/frontend/components/MemberPicker.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';

	interface Props {
		serverId: number | string;
		ondone?: () => void | Promise<void>;
	}

	let { serverId, ondone }: Props = $props();

	const ACTIONS = [
		{ value: 'warn', label: 'Warn', icon: 'fa-triangle-exclamation', color: 'text-amber-400' },
		{ value: 'timeout', label: 'Timeout', icon: 'fa-volume-xmark', color: 'text-orange-400' },
		{ value: 'untimeout', label: 'Remove timeout', icon: 'fa-volume-high', color: 'text-emerald-400' },
		{ value: 'kick', label: 'Kick', icon: 'fa-door-open', color: 'text-sky-400' },
		{ value: 'ban', label: 'Ban', icon: 'fa-gavel', color: 'text-red-400' },
		{ value: 'tempban', label: 'Temporary ban', icon: 'fa-hourglass-half', color: 'text-rose-400' },
		{ value: 'clearwarns', label: 'Clear warnings', icon: 'fa-broom', color: 'text-violet-400' }
	];
	const UNITS = [
		{ value: '60', label: 'Minutes' },
		{ value: '3600', label: 'Hours' },
		{ value: '86400', label: 'Days' }
	];
	const TIMED = ['timeout', 'tempban'];
	const REASON_OPTIONAL = ['untimeout', 'clearwarns'];

	let target = $state('');
	let action = $state('warn');
	let reason = $state('');
	let amount = $state(10);
	let unit = $state('60');
	let busy = $state(false);

	const current = $derived(ACTIONS.find((a) => a.value === action)!);

	async function submit() {
		if (!target) return showToast('Pick a member', 'error');
		if (!REASON_OPTIONAL.includes(action) && !reason.trim()) return showToast('Enter a reason', 'error');
		if (TIMED.includes(action) && (!amount || amount < 1)) return showToast('Enter a duration', 'error');
		busy = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/moderation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action,
					target_id: target,
					reason: reason.trim() || null,
					duration_seconds: TIMED.includes(action) ? Math.round(amount * Number(unit)) : null
				})
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Moderation action failed', 'error');
				return;
			}
			showToast(out.case_number ? `Case #${out.case_number} recorded` : 'Done', 'success');
			reason = '';
			await ondone?.();
		} catch {
			showToast('Moderation action failed', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<div>
	<MemberPicker serverId={Number(serverId)} value={target} placeholder="Pick a member..." onchange={(v) => (target = String(v))} />

	<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
		{#each ACTIONS as a (a.value)}
			<button
				type="button"
				class="border-ash-600 text-ash-200 hover:bg-ash-700 flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors {action ===
				a.value
					? 'bg-ash-700 ring-ash-400 ring-1'
					: ''}"
				onclick={() => (action = a.value)}
			>
				<i class="fas {a.icon} {a.color} shrink-0"></i><span class="truncate">{a.label}</span>
			</button>
		{/each}
	</div>

	{#if TIMED.includes(action)}
		<div class="mt-4">
			<span class="text-ash-300 mb-1.5 block text-sm font-medium">Duration</span>
			<div class="flex gap-2">
				<input
					type="number"
					min="1"
					bind:value={amount}
					aria-label="Duration amount"
					class="bg-ash-700 border-ash-600 text-ash-100 w-24 rounded-lg border px-3 py-2.5 text-sm"
				/>
				<div class="min-w-0 flex-1 sm:max-w-48">
					<LabeledSelect appearance="field" options={UNITS} bind:value={unit} ariaLabel="Duration unit" />
				</div>
			</div>
		</div>
	{/if}

	<div class="mt-4">
		<label class="text-ash-300 mb-1.5 block text-sm font-medium" for="moderate-reason">Reason</label>
		<textarea
			id="moderate-reason"
			bind:value={reason}
			rows="2"
			maxlength="1000"
			placeholder="Why this action is taken"
			class="bg-ash-700 border-ash-600 text-ash-100 w-full rounded-lg border px-3 py-2.5 text-sm"></textarea>
	</div>

	<button
		type="button"
		onclick={submit}
		disabled={busy || !target}
		class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 sm:w-auto"
	>
		<i class="fas {busy ? 'fa-spinner fa-spin' : current.icon}"></i>{busy ? 'Please wait...' : current.label}
	</button>
</div>
