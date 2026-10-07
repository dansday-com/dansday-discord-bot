<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { MAX_REWARDS, MAX_REWARD_LEVEL, xpForLevel } from '$lib/rewards.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const BLOCK_REASONS: Record<string, string> = {
		deleted: 'was deleted in Discord.',
		managed: 'belongs to an integration, so no bot can give it.',
		no_permission: 'needs the bot to have the Manage Roles permission.',
		above_bot: "is above the bot's own role. Drag the bot's role higher in Server Settings → Roles."
	};

	type Draft = { level: number; role_id: string };

	let rows = $state<Draft[]>([]);
	let keep = $state(true);
	let stack = $state(true);
	let busy = $state(false);
	let blocked = $state<{ role_id: string; reason: string }[]>([]);

	$effect(() => {
		rows = data.rules.rewards.map((r) => ({ level: r.level, role_id: r.role_id }));
		keep = data.rules.keep;
		stack = data.rules.stack;
	});

	const roleById = $derived(new Map(data.roles.map((r) => [r.id, r])));

	function fmt(n: number) {
		return Number(n || 0).toLocaleString();
	}

	function roleDot(color: string | null) {
		return `background-color: ${color && color !== '#000000' ? color : 'var(--color-ash-400)'}`;
	}

	function reachedCount(level: number) {
		let n = 0;
		for (const [lv, count] of data.levelCounts) if (lv >= level) n += count;
		return n;
	}

	function roleOptions(current: string) {
		const taken = new Set(rows.map((r) => r.role_id).filter((id) => id && id !== current));
		return [{ value: '', label: 'Pick a role' }, ...data.roles.filter((r) => !taken.has(r.id)).map((r) => ({ value: r.id, label: r.name }))];
	}

	function addRow() {
		const last = rows[rows.length - 1];
		rows = [...rows, { level: Math.min(MAX_REWARD_LEVEL, (last?.level ?? 0) + 5), role_id: '' }];
	}

	async function save() {
		if (rows.some((r) => !r.role_id)) return showToast('Pick a role for every reward', 'error');
		const rewards = rows.map((r) => ({ level: Math.trunc(Number(r.level)), role_id: r.role_id }));
		if (rewards.some((r) => !(r.level >= 2 && r.level <= MAX_REWARD_LEVEL))) return showToast(`Levels go from 2 to ${MAX_REWARD_LEVEL}`, 'error');
		busy = true;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/rewards`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rewards, keep, stack })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not save the rewards', 'error');
			blocked = out.blocked ?? [];
			showToast(
				out.synced ? 'Rewards saved. Giving roles to members who already qualify.' : 'Rewards saved. The bot is offline, so roles go out when it starts.',
				'success'
			);
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Rewards - {APP_NAME}</title>
</svelte:head>

<div class="space-y-4 sm:space-y-6">
	{#if !data.levelingEnabled}
		<div class="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 sm:p-4">
			<i class="fas fa-triangle-exclamation mt-0.5 text-amber-400"></i>
			<p>Leveling is off, so nobody levels up and no reward roles are given. Turn it on under Configuration → Leveling.</p>
		</div>
	{/if}

	{#if blocked.length > 0}
		<div class="rounded-xl border border-red-500/40 bg-red-500/10 p-3 sm:p-4">
			<p class="flex items-center gap-2 text-sm font-semibold text-red-200">
				<i class="fas fa-circle-exclamation text-red-400"></i>The bot can't give {blocked.length === 1 ? 'this role' : 'these roles'} yet
			</p>
			<ul class="mt-2 space-y-1 text-xs text-red-200/90">
				{#each blocked as b (b.role_id)}
					<li><span class="font-semibold">@{roleById.get(b.role_id)?.name ?? b.role_id}</span> {BLOCK_REASONS[b.reason] ?? 'cannot be given.'}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold"><i class="fas fa-trophy text-yellow-400"></i>Rewards</h3>
		<p class="text-ash-400 mt-1 mb-4 text-xs">
			Members get the role when they reach the level, and see this list on their Rewards tab. The bot gives and takes back the roles on this list, so don't hand
			them out yourself.
		</p>

		<div class="flex flex-col gap-2">
			{#each rows as row, i (i)}
				{@const role = roleById.get(row.role_id)}
				<div class="bg-ash-700 border-ash-600 flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:flex-nowrap">
					<span class="text-ash-300 text-xs">Level</span>
					<input
						type="number"
						min="2"
						max={MAX_REWARD_LEVEL}
						bind:value={row.level}
						disabled={!data.canEdit}
						aria-label="Level"
						class="bg-ash-800 border-ash-600 text-ash-100 w-20 rounded-lg border px-2 py-1.5 text-sm"
					/>
					<span class="h-2.5 w-2.5 shrink-0 rounded-full" style={roleDot(role?.color ?? null)}></span>
					<div class="min-w-0 flex-1 basis-40">
						<LabeledSelect appearance="field" options={roleOptions(row.role_id)} bind:value={row.role_id} disabled={!data.canEdit} ariaLabel="Reward role" />
					</div>
					<span class="text-ash-400 w-full text-xs whitespace-nowrap tabular-nums sm:w-auto">
						{fmt(xpForLevel(Number(row.level) || 0, data.levelReq.baseXp, data.levelReq.multiplier))} XP · {fmt(reachedCount(Number(row.level) || 0))} reached
					</span>
					{#if data.canEdit}
						<button
							type="button"
							onclick={() => (rows = rows.filter((_, j) => j !== i))}
							aria-label="Remove reward"
							class="text-ash-400 ml-auto px-2 hover:text-red-400 sm:ml-0"
						>
							<i class="fas fa-trash"></i>
						</button>
					{/if}
				</div>
			{:else}
				<p class="bg-ash-700/50 border-ash-600 text-ash-400 rounded-lg border border-dashed p-4 text-center text-sm">
					No rewards yet. Add one to give a role at a level.
				</p>
			{/each}
		</div>

		{#if data.canEdit && rows.length < MAX_REWARDS}
			<button type="button" onclick={addRow} class="text-ash-200 border-ash-600 hover:bg-ash-600 mt-3 rounded-lg border px-3 py-1.5 text-xs">
				<i class="fas fa-plus mr-1 text-emerald-400"></i>Add reward
			</button>
		{/if}
	</section>

	<section class="bg-ash-800 border-ash-700 space-y-4 rounded-xl border p-4 sm:p-6">
		<ConfigToggleRow
			label="Keep roles when a level drops"
			description="On: a member who loses XP to a steal or bomb keeps the role. Off: the role is taken back until they climb back to that level."
			labelIconClass="fas fa-shield-halved text-sky-400"
			bind:enabled={keep}
			disabled={!data.canEdit}
		/>
		<ConfigToggleRow
			label="Keep lower rewards"
			description="On: members keep every reward they pass. Off: each new reward replaces the one before, so members only wear their highest."
			labelIconClass="fas fa-layer-group text-violet-400"
			bind:enabled={stack}
			disabled={!data.canEdit}
		/>
	</section>

	{#if data.canEdit}
		<button
			type="button"
			onclick={save}
			disabled={busy}
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
		>
			<i class="fas {busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}"></i>Save rewards
		</button>
	{/if}
</div>
