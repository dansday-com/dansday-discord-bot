<script lang="ts">
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { DURATION_UNITS, MODERATION_ACTION_META, MODERATION_REASON_OPTIONAL, MODERATION_TIMED_ACTIONS, moderateEach } from '$lib/frontend/moderation.js';

	type Target = { id: string; role_ids: string[]; warnings: number; timeout_until: unknown };

	interface Props {
		serverId: number | string;
		targets: Target[];
		banned?: boolean;
		suggest?: string;
		roles: { id: string; name: string; manageable: boolean }[];
		presets: string[];
		deniedReason: string;
		ondone?: (failedIds: string[]) => void | Promise<void>;
	}

	let { serverId, targets, banned = false, suggest = 'warn', roles, presets, deniedReason, ondone }: Props = $props();

	const MEMBER_ACTIONS = ['warn', 'timeout', 'untimeout', 'kick', 'ban', 'tempban', 'clearwarns', 'role_add', 'role_remove'];
	const BAN_ACTIONS = ['unban'];
	const ROLE_ACTIONS = ['role_add', 'role_remove'];

	let action = $state('warn');
	let reason = $state('');
	let preset = $state('');
	let amount = $state(10);
	let unit = $state('60');
	let actionRoleId = $state('');
	let busy = $state(false);
	let progress = $state<{ done: number; total: number } | null>(null);
	let confirm = $state<{ title: string; message: string; run: () => Promise<void> } | null>(null);

	const isRole = $derived(ROLE_ACTIONS.includes(action));
	const isTimed = $derived(MODERATION_TIMED_ACTIONS.includes(action));
	const reasonOptional = $derived(MODERATION_REASON_OPTIONAL.includes(action));
	const meta = $derived(MODERATION_ACTION_META[action]);

	const actionOptions = $derived(
		(banned ? BAN_ACTIONS : MEMBER_ACTIONS)
			.map((value) => ({ value, n: ROLE_ACTIONS.includes(value) ? targets.length : applicableIds(value).length }))
			.filter((o) => o.n > 0 || targets.length === 0)
			.map(({ value, n }) => ({ value, label: n < targets.length ? `${MODERATION_ACTION_META[value].label} · ${n}` : MODERATION_ACTION_META[value].label }))
	);
	const roleOptions = $derived.by(() => {
		const adding = action === 'role_add';
		const options = roles
			.filter((r) => r.manageable)
			.map((r) => {
				const has = targets.filter((t) => t.role_ids.includes(r.id)).length;
				const n = adding ? targets.length - has : has;
				return { value: r.id, label: `${r.name} · ${n} ${adding ? "don't have it" : 'have it'}`, n };
			})
			.filter((o) => o.n > 0)
			.map(({ value, label }) => ({ value, label }));
		return [{ value: '', label: adding ? 'Pick a role to give' : 'Pick a role to take' }, ...options];
	});
	const presetOptions = $derived([{ value: '', label: 'Use a preset…' }, ...presets.map((p) => ({ value: p, label: p }))]);

	$effect(() => {
		action = suggest;
	});

	$effect(() => {
		if (actionOptions.length > 0 && !actionOptions.some((o) => o.value === action)) action = actionOptions[0].value;
	});

	$effect(() => {
		if (actionRoleId && !roleOptions.some((o) => o.value === actionRoleId)) actionRoleId = '';
	});

	$effect(() => {
		if (preset) {
			reason = preset;
			preset = '';
		}
	});

	function applicableIds(a: string): string[] {
		let list = targets;
		if (!banned) {
			if (a === 'untimeout') list = targets.filter((t) => t.timeout_until);
			else if (a === 'clearwarns') list = targets.filter((t) => t.warnings > 0);
			else if (ROLE_ACTIONS.includes(a) && actionRoleId) list = targets.filter((t) => t.role_ids.includes(actionRoleId) !== (a === 'role_add'));
		}
		return list.map((t) => t.id);
	}

	function apply() {
		if (isRole && !actionRoleId) return showToast('Pick a role', 'error');
		if (!reasonOptional && !reason.trim()) return showToast('Enter a reason', 'error');
		if (isTimed && (!amount || amount < 1)) return showToast('Enter a duration', 'error');
		const ids = applicableIds(action);
		if (ids.length === 0) return showToast('Nobody selected needs this', 'error');
		const who = `${ids.length.toLocaleString()} ${ids.length === 1 ? 'member' : 'members'}${ids.length < targets.length ? ` of the ${targets.length.toLocaleString()} selected` : ''}`;
		const roleName = roles.find((r) => r.id === actionRoleId)?.name ?? 'that role';
		confirm = {
			title: meta.label,
			message: isRole ? `${meta.label} ${roleName} ${action === 'role_add' ? 'to' : 'from'} ${who}?` : `${meta.label}: ${who}?`,
			run: () => (isRole ? runRoles(ids) : runEach(ids))
		};
	}

	async function runEach(ids: string[]) {
		busy = true;
		progress = { done: 0, total: ids.length };
		try {
			const out = await moderateEach(
				serverId,
				ids,
				{ action, reason: reason.trim() || null, duration_seconds: isTimed ? Math.round(amount * Number(unit)) : null },
				(done) => (progress = { done, total: ids.length })
			);
			const parts = [`Done for ${out.done.toLocaleString()}`];
			if (out.escalated > 0) parts.push(`${out.escalated} auto-escalated`);
			if (out.failed > 0) parts.push(`${out.failed} failed and are still selected: ${out.error}`);
			showToast(parts.join(' · '), out.failed > 0 ? 'error' : 'success');
			if (out.failed === 0) reason = '';
			await ondone?.(out.failedIds);
		} finally {
			busy = false;
			progress = null;
		}
	}

	async function runRoles(ids: string[]) {
		busy = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/moderation/bulk`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, role_id: actionRoleId, target_ids: ids })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Bulk action failed', 'error');
			showToast(`Started for ${Number(out.queued ?? 0).toLocaleString()}. The result goes to the moderation log channel.`, 'success');
			await ondone?.([]);
		} catch {
			showToast('Bulk action failed', 'error');
		} finally {
			busy = false;
		}
	}

	async function runConfirm() {
		const pending = confirm;
		confirm = null;
		if (pending) await pending.run();
	}
</script>

<div class="flex flex-col gap-3">
	<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
		<LabeledSelect appearance="field" options={actionOptions} bind:value={action} ariaLabel="Action" />
		{#if isRole}
			<LabeledSelect appearance="field" options={roleOptions} bind:value={actionRoleId} ariaLabel="Role" />
		{/if}
		{#if isTimed}
			<div class="flex gap-2">
				<input
					type="number"
					min="1"
					bind:value={amount}
					aria-label="Duration amount"
					class="bg-ash-700 border-ash-600 text-ash-100 h-10 w-20 rounded-lg border px-3 text-sm"
				/>
				<div class="min-w-0 flex-1">
					<LabeledSelect appearance="field" options={DURATION_UNITS} bind:value={unit} ariaLabel="Duration unit" />
				</div>
			</div>
		{/if}
		{#if !isRole && presets.length > 0}
			<LabeledSelect appearance="field" options={presetOptions} bind:value={preset} ariaLabel="Reason preset" />
		{/if}
	</div>
	{#if isRole && roles.some((r) => !r.manageable)}
		<p class="text-ash-500 text-xs">Staff and admin roles are hidden. {deniedReason}</p>
	{/if}
	{#if !isRole}
		<input
			type="text"
			maxlength="1000"
			bind:value={reason}
			placeholder={reasonOptional ? 'Reason (optional)' : 'Reason'}
			aria-label="Reason"
			class="bg-ash-800 border-ash-600 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm"
		/>
	{/if}
	<button
		type="button"
		onclick={apply}
		disabled={busy}
		class="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 sm:w-auto sm:self-start"
	>
		{#if progress}
			<i class="fas fa-spinner fa-spin"></i>Working {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
		{:else}
			<i class="fas {meta?.icon ?? 'fa-gavel'}"></i>{meta?.label ?? 'Apply'}{targets.length > 1 ? ` · ${targets.length.toLocaleString()}` : ''}
		{/if}
	</button>
</div>

<ConfirmModal
	open={confirm !== null}
	dangerous={true}
	title={confirm?.title ?? ''}
	message={confirm?.message ?? ''}
	onconfirm={runConfirm}
	oncancel={() => (confirm = null)}
/>
