<script lang="ts">
	import { onMount } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';

	const EFFECT_TYPES = [
		{ value: 'xp_steal', label: 'XP Steal', category: 'pvp' },
		{ value: 'xp_bomb', label: 'XP Bomb', category: 'pvp' },
		{ value: 'xp_boost', label: 'XP Boost', category: 'boost' },
		{ value: 'shield', label: 'Shield', category: 'pvp' },
		{ value: 'leech', label: 'Leech', category: 'pvp' },
		{ value: 'reflect', label: 'Reflect', category: 'pvp' },
		{ value: 'insurance', label: 'Insurance', category: 'pvp' },
		{ value: 'gamble', label: 'Gamble', category: 'fun' },
		{ value: 'gift', label: 'Gift', category: 'fun' },
		{ value: 'bounty', label: 'Bounty', category: 'pvp' },
		{ value: 'cosmetic', label: 'Cosmetic', category: 'cosmetic' }
	];
	const CATEGORIES = ['pvp', 'boost', 'cosmetic', 'fun'];

	let items = $state<any[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	let editing = $state<any | null>(null);

	function blankForm() {
		return {
			id: null as number | null,
			name: '',
			effect_type: 'xp_boost',
			category: 'boost',
			description: '',
			cost: 100,
			icon: '',
			enabled: true,
			available_from: '',
			available_to: '',
			cfg: {
				min_percent: 1,
				max_percent: 25,
				cooldown_minutes: 30,
				immunity_minutes: 30,
				multiplier: 2,
				skim_percent: 10,
				effect_duration_minutes: 60,
				scope: 'all',
				win_chance: 50,
				payout_multiplier: 2,
				stake: 100,
				gift_amount: 500,
				tax_percent: 10,
				bounty_amount: 500,
				cosmetic_kind: 'theme',
				value: '',
				recur_days: [] as number[],
				recur_from: '',
				recur_to: ''
			}
		};
	}

	let form = $state(blankForm());

	async function loadItems() {
		loading = true;
		try {
			const res = await fetch('/api/admin/items', { credentials: 'include' });
			const d = await res.json();
			if (d.success) items = d.items ?? [];
			else showToast(d.error || 'Failed to load', 'error');
		} finally {
			loading = false;
		}
	}

	onMount(loadItems);

	function onEffectTypeChange() {
		const def = EFFECT_TYPES.find((e) => e.value === form.effect_type);
		if (def) form.category = def.category;
	}

	function buildConfig() {
		const c = form.cfg;
		const t = form.effect_type;
		const config: Record<string, any> = {};
		if (t === 'xp_steal' || t === 'xp_bomb') {
			config.min_percent = Number(c.min_percent);
			config.max_percent = Number(c.max_percent);
			config.cooldown_minutes = Number(c.cooldown_minutes);
			config.immunity_minutes = Number(c.immunity_minutes);
		} else if (t === 'xp_boost') {
			config.multiplier = Number(c.multiplier);
			config.effect_duration_minutes = Number(c.effect_duration_minutes);
			config.scope = c.scope;
		} else if (t === 'shield' || t === 'reflect' || t === 'insurance') {
			config.effect_duration_minutes = Number(c.effect_duration_minutes);
		} else if (t === 'gift') {
			config.gift_amount = Number(c.gift_amount);
			config.tax_percent = Number(c.tax_percent);
		} else if (t === 'leech') {
			config.skim_percent = Number(c.skim_percent);
			config.effect_duration_minutes = Number(c.effect_duration_minutes);
		} else if (t === 'gamble') {
			config.win_chance = Number(c.win_chance);
			config.payout_multiplier = Number(c.payout_multiplier);
			config.stake = Number(c.stake);
		} else if (t === 'bounty') {
			config.bounty_amount = Number(c.bounty_amount);
		} else if (t === 'cosmetic') {
			config.cosmetic_kind = c.cosmetic_kind;
			config.value = c.value;
		}
		if (Array.isArray(c.recur_days) && c.recur_days.length > 0) {
			config.recurring_schedule = { days: c.recur_days.map(Number), from: c.recur_from, to: c.recur_to };
		}
		return config;
	}

	function startCreate() {
		form = blankForm();
		editing = { mode: 'create' };
	}

	function startEdit(item: any) {
		const cfg = typeof item.config === 'string' ? JSON.parse(item.config || '{}') : item.config || {};
		const f = blankForm();
		f.id = item.id;
		f.name = item.name ?? '';
		f.effect_type = item.effect_type ?? 'xp_boost';
		f.category = item.category ?? 'boost';
		f.description = item.description ?? '';
		f.cost = item.cost ?? 0;
		f.icon = item.icon ?? '';
		f.enabled = item.enabled !== false;
		f.available_from = item.available_from ? String(item.available_from).slice(0, 16).replace(' ', 'T') : '';
		f.available_to = item.available_to ? String(item.available_to).slice(0, 16).replace(' ', 'T') : '';
		f.cfg = { ...f.cfg, ...cfg };
		const recur = cfg.recurring_schedule;
		if (recur) {
			f.cfg.recur_days = recur.days ?? [];
			f.cfg.recur_from = recur.from ?? '';
			f.cfg.recur_to = recur.to ?? '';
		}
		form = f;
		editing = { mode: 'edit' };
	}

	async function save() {
		saving = true;
		try {
			const config = buildConfig();
			const recurringSchedule = config.recurring_schedule ?? null;
			delete config.recurring_schedule;
			const payload: any = {
				name: form.name,
				effect_type: form.effect_type,
				category: form.category,
				description: form.description,
				cost: Number(form.cost),
				icon: form.icon || null,
				enabled: form.enabled,
				available_from: form.available_from ? form.available_from.replace('T', ' ') + ':00' : null,
				available_to: form.available_to ? form.available_to.replace('T', ' ') + ':00' : null,
				recurring_schedule: recurringSchedule,
				config
			};
			let res;
			if (form.id) {
				payload.id = form.id;
				res = await fetch('/api/admin/items', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify(payload)
				});
			} else {
				res = await fetch('/api/admin/items', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify(payload)
				});
			}
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				editing = null;
				await loadItems();
			} else showToast(d.error || 'Failed to save', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove(item: any) {
		if (!confirm(`Delete "${item.name}"?`)) return;
		const res = await fetch('/api/admin/items', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ id: item.id })
		});
		const d = await res.json();
		if (d.success) {
			showToast('Deleted', 'success');
			await loadItems();
		} else showToast(d.error || 'Failed to delete', 'error');
	}

	const DAYS = [
		{ v: 0, l: 'Sun' },
		{ v: 1, l: 'Mon' },
		{ v: 2, l: 'Tue' },
		{ v: 3, l: 'Wed' },
		{ v: 4, l: 'Thu' },
		{ v: 5, l: 'Fri' },
		{ v: 6, l: 'Sat' }
	];

	function toggleDay(v: number) {
		const set = new Set(form.cfg.recur_days);
		if (set.has(v)) set.delete(v);
		else set.add(v);
		form.cfg.recur_days = [...set].sort((a, b) => a - b);
	}

	const isTargeted = $derived(['xp_steal', 'xp_bomb'].includes(form.effect_type));
</script>

<div class="space-y-5">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-ash-100 flex items-center gap-2 text-lg font-semibold"><i class="fas fa-store text-teal-400"></i>Items</h2>
			<p class="text-ash-400 text-xs">Global catalog. Items appear in every server with the items module enabled.</p>
		</div>
		<button onclick={startCreate} class="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500">
			<i class="fas fa-plus"></i>Add Item
		</button>
	</div>

	{#if loading}
		<p class="text-ash-400 text-sm"><i class="fas fa-spinner fa-spin mr-1"></i>Loading...</p>
	{:else if items.length === 0}
		<div class="bg-ash-800 border-ash-700 rounded-xl border p-8 text-center">
			<p class="text-ash-400 text-sm">No items yet. Click "Add Item" to create your first one.</p>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each items as item}
				<div class="bg-ash-800 border-ash-700 rounded-xl border p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="text-ash-100 flex items-center gap-2 text-sm font-semibold">
								{#if item.icon}<span>{item.icon}</span>{/if}
								<span class="truncate">{item.name}</span>
							</div>
							<div class="text-ash-500 mt-1 flex flex-wrap gap-1 text-[10px]">
								<span class="bg-ash-700 rounded px-1.5 py-0.5">{item.effect_type}</span>
								<span class="bg-ash-700 rounded px-1.5 py-0.5">{item.category}</span>
								{#if item.enabled === false}<span class="rounded bg-red-900/50 px-1.5 py-0.5 text-red-300">disabled</span>{/if}
							</div>
						</div>
						<div class="shrink-0 text-sm font-semibold text-teal-400">{item.cost} XP</div>
					</div>
					{#if item.description}<p class="text-ash-400 mt-2 line-clamp-2 text-xs">{item.description}</p>{/if}
					<div class="mt-3 flex gap-2">
						<button onclick={() => startEdit(item)} class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex-1 rounded-lg py-1.5 text-xs">Edit</button>
						<button onclick={() => remove(item)} class="rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/60">Delete</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if editing}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onclick={() => (editing = null)} role="presentation">
		<div
			class="bg-ash-800 border-ash-700 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border p-5"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<h3 class="text-ash-100 mb-4 text-base font-semibold">{form.id ? 'Edit Item' : 'Add Item'}</h3>

			<div class="space-y-4">
				<div>
					<label class="text-ash-300 mb-1 block text-xs font-medium">Name</label>
					<input bind:value={form.name} class="bg-ash-900 border-ash-700 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Mega Bomb" />
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="text-ash-300 mb-1 block text-xs font-medium">Effect type</label>
						<select
							bind:value={form.effect_type}
							onchange={onEffectTypeChange}
							class="bg-ash-900 border-ash-700 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm"
						>
							{#each EFFECT_TYPES as e}<option value={e.value}>{e.label}</option>{/each}
						</select>
					</div>
					<div>
						<label class="text-ash-300 mb-1 block text-xs font-medium">Category</label>
						<select bind:value={form.category} class="bg-ash-900 border-ash-700 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm">
							{#each CATEGORIES as c}<option value={c}>{c}</option>{/each}
						</select>
					</div>
				</div>

				<div>
					<label class="text-ash-300 mb-1 block text-xs font-medium">Description</label>
					<textarea
						bind:value={form.description}
						rows="2"
						class="bg-ash-900 border-ash-700 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm"
						placeholder="Shown on the item hover card"
					></textarea>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="text-ash-300 mb-1 block text-xs font-medium">Cost (XP)</label>
						<input type="number" bind:value={form.cost} class="bg-ash-900 border-ash-700 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm" />
					</div>
					<div>
						<label class="text-ash-300 mb-1 block text-xs font-medium">Icon (emoji)</label>
						<input bind:value={form.icon} class="bg-ash-900 border-ash-700 text-ash-100 w-full rounded-lg border px-3 py-2 text-sm" placeholder="💣" />
					</div>
				</div>

				<div class="border-ash-700 space-y-3 rounded-lg border p-3">
					<p class="text-ash-400 text-[11px] font-medium tracking-wide uppercase">Effect settings</p>
					{#if form.effect_type === 'xp_steal' || form.effect_type === 'xp_bomb'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Min %<input
									type="number"
									bind:value={form.cfg.min_percent}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Max %<input
									type="number"
									bind:value={form.cfg.max_percent}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Cooldown (min)<input
									type="number"
									bind:value={form.cfg.cooldown_minutes}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Victim immunity (min)<input
									type="number"
									bind:value={form.cfg.immunity_minutes}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">
							{form.effect_type === 'xp_steal' ? 'Random % of target total XP, transferred to buyer.' : 'Random % of target total XP, destroyed (vanishes).'}
						</p>
					{:else if form.effect_type === 'xp_boost'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Multiplier<input
									type="number"
									step="0.1"
									bind:value={form.cfg.multiplier}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 col-span-2 text-xs"
								>Scope
								<select bind:value={form.cfg.scope} class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm">
									<option value="all">All XP</option>
									<option value="message">Message only</option>
									<option value="voice">Voice only</option>
								</select>
							</label>
						</div>
					{:else if form.effect_type === 'shield' || form.effect_type === 'reflect' || form.effect_type === 'insurance'}
						<label class="text-ash-300 text-xs"
							>Duration (min)<input
								type="number"
								bind:value={form.cfg.effect_duration_minutes}
								class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
							/></label
						>
						<p class="text-ash-500 text-[11px]">
							{#if form.effect_type === 'reflect'}While active, the next steal/bomb against you fails and hits the attacker instead.{:else if form.effect_type === 'insurance'}While
								active, the next time you're robbed your XP is refunded once.{:else}Blocks incoming steal/bomb while active.{/if}
						</p>
					{:else if form.effect_type === 'gift'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Gift amount (XP)<input
									type="number"
									bind:value={form.cfg.gift_amount}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Tax %<input
									type="number"
									bind:value={form.cfg.tax_percent}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">Sends a fixed XP amount to a chosen member, minus the tax (burned).</p>
					{:else if form.effect_type === 'leech'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Skim %<input
									type="number"
									bind:value={form.cfg.skim_percent}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
						</div>
					{:else if form.effect_type === 'gamble'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Win chance %<input
									type="number"
									bind:value={form.cfg.win_chance}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Payout multiplier<input
									type="number"
									step="0.1"
									bind:value={form.cfg.payout_multiplier}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
							<label class="text-ash-300 col-span-2 text-xs"
								>Stake (XP)<input
									type="number"
									bind:value={form.cfg.stake}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">Stakes the XP, rolls win chance; on win pays stake × multiplier.</p>
					{:else if form.effect_type === 'bounty'}
						<label class="text-ash-300 text-xs"
							>Bounty amount (XP)<input
								type="number"
								bind:value={form.cfg.bounty_amount}
								class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
							/></label
						>
						<p class="text-ash-500 text-[11px]">Puts XP on a member's head. Whoever lands the next successful steal on them collects it.</p>
					{:else if form.effect_type === 'cosmetic'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Kind
								<select bind:value={form.cfg.cosmetic_kind} class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm">
									<option value="theme">Theme</option>
									<option value="badge">Badge</option>
									<option value="title">Title</option>
									<option value="frame">Frame</option>
								</select>
							</label>
							<label class="text-ash-300 text-xs"
								>Value<input
									bind:value={form.cfg.value}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
									placeholder="midnight"
								/></label
							>
						</div>
					{:else}
						<p class="text-ash-500 text-[11px]">No extra settings for this effect type yet.</p>
					{/if}
				</div>

				<div class="border-ash-700 space-y-3 rounded-lg border p-3">
					<p class="text-ash-400 text-[11px] font-medium tracking-wide uppercase">Availability (optional, UTC)</p>
					<div class="grid grid-cols-2 gap-3">
						<label class="text-ash-300 text-xs"
							>From<input
								type="datetime-local"
								bind:value={form.available_from}
								class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
							/></label
						>
						<label class="text-ash-300 text-xs"
							>To<input
								type="datetime-local"
								bind:value={form.available_to}
								class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
							/></label
						>
					</div>
					<div>
						<p class="text-ash-300 mb-1 text-xs">Recurring days (UTC)</p>
						<div class="flex flex-wrap gap-1">
							{#each DAYS as d}
								<button
									type="button"
									onclick={() => toggleDay(d.v)}
									class="rounded px-2 py-1 text-[11px] {form.cfg.recur_days.includes(d.v) ? 'bg-teal-600 text-white' : 'bg-ash-700 text-ash-300'}">{d.l}</button
								>
							{/each}
						</div>
						<div class="mt-2 grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>From (HH:MM)<input
									bind:value={form.cfg.recur_from}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
									placeholder="18:00"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>To (HH:MM)<input
									bind:value={form.cfg.recur_to}
									class="bg-ash-900 border-ash-700 text-ash-100 mt-1 w-full rounded border px-2 py-1.5 text-sm"
									placeholder="21:00"
								/></label
							>
						</div>
					</div>
				</div>

				<label class="text-ash-300 flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={form.enabled} />Enabled</label>
				{#if isTargeted}<p class="text-ash-500 text-[11px]">This is a targeted PvP item — members pick a target when using it.</p>{/if}
			</div>

			<div class="mt-5 flex gap-2">
				<button onclick={() => (editing = null)} class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex-1 rounded-lg py-2 text-sm">Cancel</button>
				<button onclick={save} disabled={saving} class="flex-1 rounded-lg bg-teal-600 py-2 text-sm text-white hover:bg-teal-500 disabled:opacity-50">
					{#if saving}<i class="fas fa-spinner fa-spin mr-1"></i>{/if}{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
