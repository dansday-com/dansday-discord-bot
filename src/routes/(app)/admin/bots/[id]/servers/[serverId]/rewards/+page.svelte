<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { IMAGE_ACCEPT, IMAGE_FORMATS_LABEL, imageExtension, imageSizeLabel } from '$lib/images.js';
	import { prepareThemeUpload } from '$lib/themes.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import {
		MAX_REWARDS,
		MAX_REWARD_NAME,
		REWARD_GOALS,
		REWARD_IMAGE_MAX_BYTES,
		REWARD_KINDS,
		rewardGoalLabel,
		rewardGoalMeta,
		xpForLevel
	} from '$lib/rewards.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const BLOCK_REASONS: Record<string, string> = {
		deleted: 'was deleted in Discord.',
		managed: 'belongs to an integration, so no bot can give it.',
		no_permission: 'needs the bot to have the Manage Roles permission.',
		above_bot: "is above the bot's own role. Drag the bot's role higher in Server Settings → Roles."
	};

	const GOAL_OPTIONS = REWARD_GOALS.map((g) => ({ value: g.id, label: g.label }));
	const KIND_OPTIONS = REWARD_KINDS.map((k) => ({ value: k.id, label: k.label }));
	const FIELD = 'bg-ash-800 border-ash-600 text-ash-100 rounded-lg border px-2 py-1.5 text-sm';

	type Draft = {
		id: number | null;
		goal_type: string;
		units: number;
		kind: string;
		role_id: string;
		xp: number;
		name: string;
		image: string | null;
		image_url: string | null;
		file: File | null;
		preview: string | null;
		original: number | null;
		winner_limit: number | null | '';
		winners: number;
		reached: number | null;
	};

	const IMAGE_LIMIT = imageSizeLabel(REWARD_IMAGE_MAX_BYTES);

	let rows = $state<Draft[]>([]);
	let keep = $state(true);
	let stack = $state(true);
	let busy = $state(false);
	let preparing = $state<number | null>(null);
	let delivering = $state<string | null>(null);
	let blocked = $state<{ role_id: string; reason: string }[]>([]);

	$effect(() => {
		rows = data.rewards.map((r) => ({ ...r, file: null, preview: null, original: null }));
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

	function roleOptions(current: string) {
		const taken = new Set(rows.map((r) => (r.kind === 'role' ? r.role_id : '')).filter((id) => id && id !== current));
		return [{ value: '', label: 'Pick a role' }, ...data.roles.filter((r) => !taken.has(r.id)).map((r) => ({ value: r.id, label: r.name }))];
	}

	function hint(row: Draft): string {
		const parts: string[] = [];
		if (row.goal_type === 'level') parts.push(`${fmt(xpForLevel(Number(row.units) || 0, data.levelReq.baseXp, data.levelReq.multiplier))} XP`);
		if (row.reached !== null) parts.push(`${fmt(row.reached)} reached`);
		if (row.id !== null && row.winner_limit) parts.push(`${fmt(row.winners)}/${fmt(Number(row.winner_limit))} taken`);
		return parts.join(' · ');
	}

	function addRow() {
		const last = rows[rows.length - 1];
		rows = [
			...rows,
			{
				id: null,
				goal_type: last?.goal_type ?? 'level',
				units: (Number(last?.units) || 0) + (last ? rewardGoalMeta(last.goal_type).min : 5),
				kind: 'role',
				role_id: '',
				xp: 1000,
				name: '',
				image: null,
				image_url: null,
				file: null,
				preview: null,
				original: null,
				winner_limit: '',
				winners: 0,
				reached: null
			}
		];
	}

	function imageLabel(row: Draft): string {
		if (!row.file) return '';
		const now = imageSizeLabel(row.file.size);
		if (row.original != null && row.original > row.file.size) return `${row.file.name} · ${imageSizeLabel(row.original)} → ${now}`;
		return `${row.file.name} · ${now}`;
	}

	function discardImage(row: Draft) {
		if (row.preview) URL.revokeObjectURL(row.preview);
		row.file = null;
		row.preview = null;
		row.original = null;
	}

	function removeImage(row: Draft) {
		discardImage(row);
		row.image = null;
		row.image_url = null;
	}

	async function pickImage(row: Draft, index: number, input: HTMLInputElement) {
		const picked = input.files?.[0];
		input.value = '';
		if (!picked) return;
		if (!imageExtension(picked.type)) return showToast(`Use a ${IMAGE_FORMATS_LABEL} image.`, 'error');
		preparing = index;
		try {
			const prepared = await prepareThemeUpload(picked);
			if (prepared.file.size > REWARD_IMAGE_MAX_BYTES) {
				return showToast(
					prepared.file === picked
						? `That image is ${imageSizeLabel(picked.size)}. Pick one under ${IMAGE_LIMIT}.`
						: `Still ${imageSizeLabel(prepared.file.size)} after optimising. The limit is ${IMAGE_LIMIT}.`,
					'error'
				);
			}
			discardImage(row);
			row.file = prepared.file;
			row.preview = URL.createObjectURL(prepared.file);
			row.original = picked.size;
		} finally {
			preparing = null;
		}
	}

	async function uploadImage(row: Draft): Promise<boolean> {
		if (!row.file) return true;
		const form = new FormData();
		form.append('image', row.file);
		const res = await fetch(`/api/servers/${data.serverId}/rewards/image`, { method: 'POST', body: form });
		const out = await res.json().catch(() => ({}));
		if (!res.ok || !out.ok) {
			showToast(out.error || 'Could not upload the image', 'error');
			return false;
		}
		row.image = out.key;
		row.image_url = out.url;
		discardImage(row);
		return true;
	}

	async function save() {
		if (rows.some((r) => r.kind === 'role' && !r.role_id)) return showToast('Pick a role for every role reward', 'error');
		if (rows.some((r) => r.kind === 'custom' && !r.name.trim())) return showToast('Name every custom reward', 'error');
		busy = true;
		try {
			for (const row of rows) if (row.kind === 'custom' && !(await uploadImage(row))) return;
			const rewards = rows.map((r) => ({
				id: r.id,
				goal_type: r.goal_type,
				units: Math.trunc(Number(r.units)),
				kind: r.kind,
				role_id: r.role_id,
				xp: Math.trunc(Number(r.xp)),
				name: r.name,
				image: r.image,
				winner_limit: r.winner_limit === '' || r.winner_limit === null ? null : Math.trunc(Number(r.winner_limit))
			}));
			const res = await fetch(`/api/servers/${data.serverId}/rewards`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rewards, keep, stack })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not save the rewards', 'error');
			blocked = out.blocked ?? [];
			showToast(
				out.synced ? 'Rewards saved. Members who already qualify get theirs now.' : 'Rewards saved. The bot is offline, so they go out when it starts.',
				'success'
			);
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function deliver(id: string) {
		delivering = id;
		try {
			const res = await fetch(`/api/servers/${data.serverId}/rewards/deliver`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok || !out.ok) return showToast(out.error || 'Could not mark it delivered', 'error');
			showToast('Marked as delivered', 'success');
			await invalidateAll();
		} finally {
			delivering = null;
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
			<p>Leveling is off, so nothing is counted and no rewards are given. Turn it on under Configuration → Leveling.</p>
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

	{#if data.pending.length > 0}
		<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
			<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold"><i class="fas fa-hand-holding-heart text-emerald-400"></i>To deliver</h3>
			<p class="text-ash-400 mt-1 mb-4 text-xs">Members who earned a custom reward. Hand it over, then mark it delivered.</p>
			<div class="flex flex-col gap-2">
				{#each data.pending as p (p.id)}
					<div class="bg-ash-700 border-ash-600 flex flex-wrap items-center gap-3 rounded-lg border p-2">
						{#if p.image_url}
							<img src={p.image_url} alt="" class="size-9 shrink-0 rounded-lg object-cover" loading="lazy" />
						{:else}
							<span class="bg-ash-800 text-ash-300 grid size-9 shrink-0 place-items-center rounded-lg"><i class="fas fa-gift"></i></span>
						{/if}
						<div class="min-w-0 flex-1 basis-40">
							<p class="text-ash-100 truncate text-sm font-semibold">{p.name}</p>
							<p class="text-ash-400 truncate text-xs">{p.member_name} · {rewardGoalLabel(p)}</p>
						</div>
						{#if data.canEdit}
							<button
								type="button"
								onclick={() => deliver(p.id)}
								disabled={delivering === p.id}
								class="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
							>
								<i class="fas {delivering === p.id ? 'fa-spinner fa-spin' : 'fa-check'} mr-1"></i>Delivered
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 flex items-center gap-2 text-base font-semibold"><i class="fas fa-trophy text-yellow-400"></i>Rewards</h3>
		<p class="text-ash-400 mt-1 mb-4 text-xs">
			Pick a goal and what reaching it gives. Members see this list on their Rewards tab. Voice hours count active time only. The bot gives and takes back
			reward roles itself, so don't hand those out yourself.
		</p>

		<div class="flex flex-col gap-2">
			{#each rows as row, i (i)}
				{@const role = roleById.get(row.role_id)}
				{@const meta = rewardGoalMeta(row.goal_type)}
				<div class="bg-ash-700 border-ash-600 flex flex-col gap-2 rounded-lg border p-2">
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-ash-300 w-10 shrink-0 text-xs">Reach</span>
						<div class="min-w-0 flex-1 basis-36">
							<LabeledSelect appearance="field" options={GOAL_OPTIONS} bind:value={row.goal_type} disabled={!data.canEdit} ariaLabel="Goal" />
						</div>
						<input type="number" min={meta.min} max={meta.max} bind:value={row.units} disabled={!data.canEdit} aria-label={meta.label} class="{FIELD} w-24" />
						{#if data.canEdit}
							<button
								type="button"
								onclick={() => (rows = rows.filter((_, j) => j !== i))}
								aria-label="Remove reward"
								class="text-ash-400 ml-auto px-2 hover:text-red-400"
							>
								<i class="fas fa-trash"></i>
							</button>
						{/if}
					</div>

					<div class="flex flex-wrap items-center gap-2">
						<span class="text-ash-300 w-10 shrink-0 text-xs">Give</span>
						<div class="min-w-0 flex-1 basis-28">
							<LabeledSelect appearance="field" options={KIND_OPTIONS} bind:value={row.kind} disabled={!data.canEdit} ariaLabel="Reward" />
						</div>
						{#if row.kind === 'role'}
							<span class="h-2.5 w-2.5 shrink-0 rounded-full" style={roleDot(role?.color ?? null)}></span>
							<div class="min-w-0 flex-2 basis-40">
								<LabeledSelect
									appearance="field"
									options={roleOptions(row.role_id)}
									bind:value={row.role_id}
									disabled={!data.canEdit}
									ariaLabel="Reward role"
								/>
							</div>
						{:else if row.kind === 'xp'}
							<input type="number" min="1" bind:value={row.xp} disabled={!data.canEdit} aria-label="XP" class="{FIELD} min-w-0 flex-2 basis-40" />
							<span class="text-ash-300 text-xs">XP</span>
						{:else}
							<input
								type="text"
								maxlength={MAX_REWARD_NAME}
								placeholder="Free Nitro"
								bind:value={row.name}
								disabled={!data.canEdit}
								aria-label="Reward name"
								class="{FIELD} min-w-0 flex-2 basis-40"
							/>
						{/if}
					</div>

					{#if row.kind === 'custom'}
						{@const shown = row.preview ?? row.image_url}
						<div class="flex items-center gap-2">
							<span class="text-ash-300 w-10 shrink-0 self-start pt-1 text-xs">Image</span>
							<label
								for="reward-image-{i}"
								class="border-ash-500 bg-ash-800 relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border {shown
									? ''
									: 'border-dashed'} {data.canEdit ? 'hover:border-ash-400 group cursor-pointer transition-colors' : ''}"
							>
								{#if shown}
									<img src={shown} alt="" class="size-full object-cover" />
								{:else}
									<i class="fas fa-image text-ash-400 text-lg"></i>
								{/if}
								{#if preparing === i}
									<span class="absolute inset-0 grid place-items-center bg-black/55"><i class="fas fa-spinner fa-spin text-white"></i></span>
								{:else if data.canEdit && shown}
									<span class="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
										<i class="fas fa-upload text-white"></i>
									</span>
								{/if}
							</label>
							<div class="min-w-0 flex-1">
								<p class="text-ash-500 text-xs">
									{#if row.file}
										<span class="text-ash-300">{imageLabel(row)}</span> · uploads when you save
									{:else}
										Shown on members' Rewards tab. {IMAGE_FORMATS_LABEL} · max {IMAGE_LIMIT}.
									{/if}
								</p>
								{#if data.canEdit}
									<div class="mt-1.5 flex flex-wrap gap-2">
										<label
											for="reward-image-{i}"
											class="bg-ash-600 hover:bg-ash-500 text-ash-100 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
										>
											<i class="fas fa-upload mr-1"></i>{shown ? 'Replace' : 'Upload image'}
										</label>
										{#if row.file}
											<button
												type="button"
												onclick={() => discardImage(row)}
												class="bg-ash-800 hover:bg-ash-600 text-ash-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
											>
												<i class="fas fa-rotate-left mr-1"></i>Discard
											</button>
										{:else if row.image_url}
											<button
												type="button"
												onclick={() => removeImage(row)}
												class="bg-ash-800 hover:bg-ash-600 text-ash-200 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
											>
												<i class="fas fa-trash mr-1 text-red-300"></i>Remove
											</button>
										{/if}
									</div>
									<input
										id="reward-image-{i}"
										type="file"
										accept={IMAGE_ACCEPT}
										class="hidden"
										disabled={preparing !== null || busy}
										onchange={(e) => pickImage(row, i, e.currentTarget)}
									/>
								{/if}
							</div>
						</div>
					{/if}

					<div class="flex flex-wrap items-center gap-2">
						<span class="text-ash-300 w-10 shrink-0 text-xs">First</span>
						<input
							type="number"
							min="1"
							placeholder="Everyone"
							bind:value={row.winner_limit}
							disabled={!data.canEdit}
							aria-label="Winner limit"
							class="{FIELD} w-28"
						/>
						<span class="text-ash-400 text-xs">
							{row.winner_limit ? 'members who reach it from now on' : 'no limit'}
						</span>
						<span class="text-ash-400 ml-auto text-xs whitespace-nowrap tabular-nums">{hint(row)}</span>
					</div>
				</div>
			{:else}
				<p class="bg-ash-700/50 border-ash-600 text-ash-400 rounded-lg border border-dashed p-4 text-center text-sm">
					No rewards yet. Add one to give something for reaching a goal.
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
			label="Keep rewards when a level drops"
			description="On: a member who loses XP to a steal or bomb keeps what they earned. Off: it is taken back until they climb back to that level. XP already paid and delivered rewards always stay."
			labelIconClass="fas fa-shield-halved text-sky-400"
			bind:enabled={keep}
			disabled={!data.canEdit}
		/>
		<ConfigToggleRow
			label="Keep lower rewards"
			description="On: members keep every reward they pass. Off: on the same goal, a higher reward replaces the lower one. XP already paid and delivered rewards always stay."
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
