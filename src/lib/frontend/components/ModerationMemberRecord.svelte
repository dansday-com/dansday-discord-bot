<script lang="ts">
	import LocalTime from '$lib/frontend/components/LocalTime.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { MODERATION_ACTION_META, formatDuration } from '$lib/frontend/moderation.js';

	interface Props {
		serverId: number | string;
		memberId: string;
		canEdit: boolean;
		deniedReason: string;
		presets?: string[];
		onchange?: () => void | Promise<void>;
	}

	let { serverId, memberId, canEdit, deniedReason, presets = [], onchange }: Props = $props();

	type Case = {
		id: string;
		case_number: number;
		action: string;
		reason: string | null;
		duration_seconds: number | null;
		expires_at: string | null;
		active: boolean;
		revoked_at: string | null;
		source: string;
		created_at: string;
		staff_name: string | null;
	};

	const PUNISHMENTS = ['warn', 'timeout', 'ban', 'tempban'];

	let loading = $state(false);
	let busy = $state(false);
	let cases = $state<Case[]>([]);
	let editing = $state<number | null>(null);
	let draft = $state('');

	const standing = $derived({
		warnings: cases.filter((c) => c.action === 'warn' && c.active).length,
		timeout: cases.find((c) => c.action === 'timeout' && c.active) ?? null,
		ban: cases.find((c) => (c.action === 'ban' || c.action === 'tempban') && c.active) ?? null
	});

	$effect(() => {
		void load(memberId);
	});

	async function load(id: string) {
		loading = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/moderation?member=${encodeURIComponent(id)}`, { credentials: 'include' });
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not load the record', 'error');
			cases = out.cases ?? [];
		} finally {
			loading = false;
		}
	}

	async function post(body: Record<string, unknown>) {
		busy = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/moderation`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) {
				showToast(out.error || 'Action failed', 'error');
				return false;
			}
			return true;
		} finally {
			busy = false;
		}
	}

	function startEdit(c: Case) {
		editing = c.case_number;
		draft = c.reason ?? '';
	}

	async function saveReason(caseNumber: number) {
		if (!(await post({ action: 'edit_reason', case_number: caseNumber, reason: draft.trim() }))) return;
		showToast(`Case #${caseNumber} updated`, 'success');
		editing = null;
		await load(memberId);
	}

	async function removeWarning(caseNumber: number) {
		if (!(await post({ action: 'unwarn', case_number: caseNumber }))) return;
		showToast(`Warning #${caseNumber} removed`, 'success');
		await load(memberId);
		await onchange?.();
	}

	function status(c: Case) {
		if (c.revoked_at) return { label: 'Revoked', tone: 'bg-ash-600 text-ash-300' };
		if (!PUNISHMENTS.includes(c.action)) return null;
		if (c.active) return { label: 'Active', tone: 'bg-emerald-500/15 text-emerald-300' };
		return { label: 'Expired', tone: 'bg-ash-600 text-ash-400' };
	}
</script>

<div class="bg-ash-800 border-ash-700 rounded-lg border p-3 sm:p-4">
	<div class="grid grid-cols-3 gap-2">
		<div class="bg-ash-700 border-ash-600 rounded-lg border p-2 text-center">
			<p class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Active warnings</p>
			<p class="text-sm font-bold text-amber-400 tabular-nums">{standing.warnings}</p>
		</div>
		<div class="bg-ash-700 border-ash-600 rounded-lg border p-2 text-center">
			<p class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Timeout</p>
			<p class="text-sm font-bold {standing.timeout ? 'text-orange-400' : 'text-ash-300'}">
				{#if standing.timeout?.expires_at}<LocalTime value={standing.timeout.expires_at} fallback="Yes" />{:else}No{/if}
			</p>
		</div>
		<div class="bg-ash-700 border-ash-600 rounded-lg border p-2 text-center">
			<p class="text-ash-400 text-[0.6rem] tracking-wide uppercase">Banned</p>
			<p class="text-sm font-bold {standing.ban ? 'text-red-400' : 'text-ash-300'}">{standing.ban ? 'Yes' : 'No'}</p>
		</div>
	</div>

	{#if !canEdit}
		<p class="mt-3 flex items-center gap-1.5 text-xs text-amber-300"><i class="fas fa-lock"></i>{deniedReason}</p>
	{/if}

	{#if loading && cases.length === 0}
		<p class="text-ash-400 py-6 text-center text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Loading…</p>
	{:else if cases.length === 0}
		<p class="text-ash-500 py-6 text-center text-xs">Clean record. No cases.</p>
	{:else}
		<ul class="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1">
			{#each cases as c (c.id)}
				{@const meta = MODERATION_ACTION_META[c.action] ?? { label: c.action, icon: 'fa-circle', color: 'text-ash-400' }}
				{@const badge = status(c)}
				<li class="bg-ash-700 border-ash-600 rounded-lg border px-3 py-2 text-xs">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
						<span class="text-ash-400 font-mono">#{c.case_number}</span>
						<span class="font-semibold {meta.color}"><i class="fas {meta.icon} mr-1"></i>{meta.label}</span>
						{#if c.duration_seconds}<span class="bg-ash-600 text-ash-300 rounded px-1.5 py-0.5">{formatDuration(c.duration_seconds)}</span>{/if}
						{#if badge}<span class="rounded px-1.5 py-0.5 {badge.tone}">{badge.label}</span>{/if}
						<span class="text-ash-500 ml-auto"><LocalTime value={c.created_at} fallback="" /></span>
					</div>
					{#if editing === c.case_number}
						<div class="mt-2 flex flex-col gap-2 sm:flex-row">
							<input
								type="text"
								maxlength="1000"
								bind:value={draft}
								list="moderation-record-presets"
								aria-label="Reason"
								class="bg-ash-800 border-ash-600 text-ash-100 min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
							/>
							<div class="flex gap-2">
								<button
									type="button"
									disabled={busy}
									onclick={() => saveReason(c.case_number)}
									class="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Save</button
								>
								<button
									type="button"
									disabled={busy}
									onclick={() => (editing = null)}
									class="bg-ash-600 text-ash-100 hover:bg-ash-500 flex-1 rounded-lg px-3 py-1.5">Cancel</button
								>
							</div>
						</div>
					{:else}
						<p class="text-ash-200 mt-1 break-words">{c.reason || 'No reason provided'}</p>
					{/if}
					<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
						<span class="text-ash-500">{c.staff_name || (c.source === 'auto' ? 'Automatic' : c.source === 'panel' ? 'Panel' : 'Unknown')} · {c.source}</span>
						{#if canEdit && editing !== c.case_number}
							<button type="button" disabled={busy} onclick={() => startEdit(c)} class="text-ash-300 hover:text-ash-100 ml-auto disabled:opacity-50">
								<i class="fas fa-pen mr-1 text-sky-400"></i>Edit reason
							</button>
							{#if c.action === 'warn' && c.active}
								<button type="button" disabled={busy} onclick={() => removeWarning(c.case_number)} class="text-ash-300 hover:text-ash-100 disabled:opacity-50">
									<i class="fas fa-eraser mr-1 text-violet-400"></i>Remove
								</button>
							{/if}
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		<datalist id="moderation-record-presets">
			{#each presets as p (p)}<option value={p}></option>{/each}
		</datalist>
	{/if}
</div>
