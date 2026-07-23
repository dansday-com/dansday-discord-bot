<script lang="ts">
	import { onMount } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import { ITEM_EFFECTS, effectLabel, effectIcon, isTargetedEffect, getItemEffect, effectDefaultCost } from '$lib/items.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';

	const effectOptions: LabeledSelectOption[] = ITEM_EFFECTS.map((e) => ({ value: e.id, label: e.label }));

	const ALL_DEFAULT_CFG: Record<string, any> = Object.assign({}, ...ITEM_EFFECTS.map((e) => e.defaultConfig));

	function toLocalInput(value: any): string {
		if (!value) return '';
		const d = value instanceof Date ? value : new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return '';
		return d.toISOString().slice(0, 16);
	}

	function fromLocalInput(value: string): string | null {
		if (!value) return null;
		return value.length === 16 ? `${value}:00Z` : `${value}Z`;
	}

	let items = $state<any[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	const adminGroups = $derived.by(() => {
		const byCost = (a: any, b: any) => (Number(a.cost) || 0) - (Number(b.cost) || 0);
		const out: { key: string; label: string; icon: string; items: any[] }[] = [];
		for (const eff of ITEM_EFFECTS) {
			const groupItems = items.filter((i) => i.effect_type === eff.id).sort(byCost);
			if (groupItems.length > 0) out.push({ key: eff.id, label: eff.label, icon: eff.icon, items: groupItems });
		}
		return out;
	});

	let editing = $state<any | null>(null);
	let confirmDelete = $state<any | null>(null);
	let deleting = $state(false);

	function blankForm() {
		return {
			id: null as number | null,
			name: '',
			effect_type: 'boost',
			description: '',
			cost: effectDefaultCost('boost'),
			enabled: true,
			usable: true,
			available_from: '',
			available_to: '',
			cfg: {
				...ALL_DEFAULT_CFG,
				recur_days: [] as number[],
				recur_from: '',
				recur_to: ''
			} as Record<string, any>
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

	function buildConfig() {
		const c = form.cfg as Record<string, any>;
		const defaults = getItemEffect(form.effect_type)?.defaultConfig ?? {};
		const config: Record<string, any> = {};
		for (const [key, def] of Object.entries(defaults)) {
			config[key] = typeof def === 'number' ? Number(c[key]) : c[key];
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
		f.effect_type = item.effect_type ?? 'boost';
		f.description = item.description ?? '';
		f.cost = item.cost ?? 0;
		f.enabled = item.enabled !== false;
		f.usable = item.usable !== false;
		f.available_from = toLocalInput(item.available_from);
		f.available_to = toLocalInput(item.available_to);
		f.cfg = { ...f.cfg, ...cfg };
		const recur = typeof item.recurring_schedule === 'string' ? JSON.parse(item.recurring_schedule || 'null') : item.recurring_schedule;
		if (recur) {
			f.cfg.recur_days = (recur.days ?? []).map(Number);
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
				description: form.description,
				cost: Number(form.cost),
				enabled: form.enabled,
				usable: form.usable,
				available_from: fromLocalInput(form.available_from),
				available_to: fromLocalInput(form.available_to),
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

	let togglingId = $state<number | null>(null);

	async function toggleEnabled(item: any) {
		const next = item.enabled === false;
		togglingId = item.id;
		item.enabled = next;
		try {
			const res = await fetch('/api/admin/items', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ id: item.id, enabled: next })
			});
			const d = await res.json();
			if (!d.success) {
				item.enabled = !next;
				showToast(d.error || 'Failed to update', 'error');
			}
		} catch {
			item.enabled = !next;
			showToast('Failed to update', 'error');
		} finally {
			togglingId = null;
		}
	}

	async function toggleUsable(item: any) {
		const next = item.usable === false;
		togglingId = item.id;
		item.usable = next;
		try {
			const res = await fetch('/api/admin/items', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ id: item.id, usable: next })
			});
			const d = await res.json();
			if (!d.success) {
				item.usable = !next;
				showToast(d.error || 'Failed to update', 'error');
			}
		} catch {
			item.usable = !next;
			showToast('Failed to update', 'error');
		} finally {
			togglingId = null;
		}
	}

	async function remove() {
		const item = confirmDelete;
		if (!item) return;
		deleting = true;
		try {
			const res = await fetch('/api/admin/items', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ id: item.id })
			});
			const d = await res.json();
			if (d.success) {
				showToast('Deleted', 'success');
				confirmDelete = null;
				await loadItems();
			} else showToast(d.error || 'Failed to delete', 'error');
		} finally {
			deleting = false;
		}
	}

	let giftItem = $state<any | null>(null);
	let giftSearch = $state('');
	let giftMembers = $state<any[]>([]);
	let giftLoading = $state(false);
	let giftingMemberId = $state<number | null>(null);
	let giftSearchTimer: ReturnType<typeof setTimeout> | null = null;

	async function loadGiftMembers() {
		giftLoading = true;
		try {
			const res = await fetch(`/api/admin/items/gift?q=${encodeURIComponent(giftSearch.trim())}`, { credentials: 'include' });
			const d = await res.json();
			if (d.success) giftMembers = d.members ?? [];
			else showToast(d.error || 'Failed to load members', 'error');
		} finally {
			giftLoading = false;
		}
	}

	function startGift(item: any) {
		giftItem = item;
		giftSearch = '';
		giftMembers = [];
		loadGiftMembers();
	}

	function onGiftSearchInput() {
		if (giftSearchTimer) clearTimeout(giftSearchTimer);
		giftSearchTimer = setTimeout(loadGiftMembers, 250);
	}

	const giftGroups = $derived.by(() => {
		const groups = new Map<string, { server: string; members: any[] }>();
		for (const m of giftMembers) {
			const key = `${m.server_id}`;
			if (!groups.has(key)) groups.set(key, { server: m.server_name || 'Unknown server', members: [] });
			groups.get(key)!.members.push(m);
		}
		return [...groups.values()];
	});

	function giftAvatar(m: any): string {
		return m.avatar || `https://cdn.discordapp.com/embed/avatars/${Number(m.discord_member_id) % 5 || 0}.png`;
	}

	function giftMemberName(m: any): string {
		return m.server_display_name || m.display_name || m.username || 'Unknown';
	}

	async function giveTo(member: any) {
		if (!giftItem) return;
		giftingMemberId = member.id;
		try {
			const res = await fetch('/api/admin/items/gift', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ item_id: giftItem.id, member_id: member.id, quantity: 1 })
			});
			const d = await res.json();
			if (d.success) {
				showToast(`Gave "${giftItem.name}" to ${giftMemberName(member)} (${member.server_name})`, 'success');
				member.inventory_total = Number(member.inventory_total || 0) + 1;
			} else showToast(d.error || 'Failed to give item', 'error');
		} catch {
			showToast('Failed to give item', 'error');
		} finally {
			giftingMemberId = null;
		}
	}

	$effect(() => {
		if (!giftItem) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') giftItem = null;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

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
		const set = new Set<number>((form.cfg.recur_days ?? []).map(Number));
		if (set.has(v)) set.delete(v);
		else set.add(v);
		form.cfg.recur_days = [...set].sort((a, b) => a - b);
	}

	const isTargeted = $derived(isTargetedEffect(form.effect_type));

	$effect(() => {
		if (!editing) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') editing = null;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<svelte:head>
	<title>Items | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="space-y-5">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h2 class="text-ash-100 flex items-center gap-2 text-lg font-semibold"><i class="fas fa-store text-teal-400"></i>Items</h2>
			<p class="text-ash-400 text-xs">Global catalog. Items appear in every server with the items module enabled.</p>
		</div>
		<button
			onclick={startCreate}
			class="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
		>
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
		{#snippet adminCard(item: any)}
			<div
				class="bg-ash-800 border-ash-700 rounded-xl border border-l-4 p-4 transition-opacity"
				class:opacity-60={item.enabled === false && item.usable === false}
				style="--cat: var(--effect-{item.effect_type}, var(--effect-default)); border-left-color: var(--cat)"
			>
				<div class="flex items-start justify-between gap-2">
					<div class="flex min-w-0 items-start gap-2.5">
						<span
							class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
							style="color: var(--cat); background: color-mix(in srgb, var(--cat) 16%, transparent)"
						>
							<i class="fas {effectIcon(item.effect_type)}"></i>
						</span>
						<div class="min-w-0">
							<div class="text-ash-100 truncate text-sm font-semibold">{item.name}</div>
							<div class="text-ash-500 mt-1 flex flex-wrap gap-1 text-[10px]">
								<span class="bg-ash-700 rounded px-1.5 py-0.5">{effectLabel(item.effect_type)}</span>
							</div>
						</div>
					</div>
					<div class="shrink-0 text-sm font-semibold text-teal-400">{item.cost} XP</div>
				</div>
				{#if item.description}<p class="text-ash-400 mt-2 line-clamp-2 text-xs">{item.description}</p>{/if}
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<div class="flex items-center gap-1.5" title="Allow members to buy this item">
						<button
							type="button"
							role="switch"
							aria-checked={item.enabled !== false}
							aria-label={item.enabled !== false ? 'Disable buying' : 'Enable buying'}
							disabled={togglingId === item.id}
							onclick={() => toggleEnabled(item)}
							class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 {item.enabled !== false
								? 'bg-teal-600'
								: 'bg-ash-700'}"
						>
							<span
								class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {item.enabled !== false ? 'translate-x-6' : 'translate-x-1'}"
							></span>
						</button>
						<span class="text-ash-400 text-[10px] leading-tight">Buy</span>
					</div>
					<div class="flex items-center gap-1.5" title="Allow members to use copies they already own">
						<button
							type="button"
							role="switch"
							aria-checked={item.usable !== false}
							aria-label={item.usable !== false ? 'Disable use' : 'Enable use'}
							disabled={togglingId === item.id}
							onclick={() => toggleUsable(item)}
							class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 {item.usable !== false
								? 'bg-teal-600'
								: 'bg-ash-700'}"
						>
							<span
								class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {item.usable !== false ? 'translate-x-6' : 'translate-x-1'}"
							></span>
						</button>
						<span class="text-ash-400 text-[10px] leading-tight">Use</span>
					</div>
					<button onclick={() => startEdit(item)} class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex-1 rounded-lg py-1.5 text-xs">Edit</button>
					<button
						onclick={() => startGift(item)}
						title="Give to a member"
						aria-label="Give to a member"
						class="rounded-lg bg-teal-900/40 px-3 py-1.5 text-xs text-teal-300 hover:bg-teal-900/60"
					>
						<i class="fas fa-gift"></i>
					</button>
					<button
						onclick={() => (confirmDelete = item)}
						title="Delete item"
						aria-label="Delete item"
						class="rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/60"
					>
						<i class="fas fa-trash-can"></i>
					</button>
				</div>
			</div>
		{/snippet}

		<div class="space-y-6">
			{#each adminGroups as group (group.key)}
				<div>
					<h2 class="text-ash-300 mb-2.5 flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
						<i class="fas {group.icon}" style="color: var(--effect-{group.key}, var(--effect-default))"></i>{group.label}
						<span class="bg-ash-700 text-ash-400 rounded-full px-2 py-0.5 text-[10px] font-semibold">{group.items.length}</span>
					</h2>
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each group.items as item (item.id)}
							{@render adminCard(item)}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if editing}
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={() => (editing = null)} role="presentation">
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label={form.id ? 'Edit item' : 'Add item'}
		>
			<div class="border-ash-700 flex items-center justify-between border-b px-4 py-4 sm:px-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-store text-teal-400"></i>{form.id ? 'Edit Item' : 'Add Item'}
				</h3>
				<button type="button" onclick={() => (editing = null)} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
				<div class="space-y-4">
					<div>
						<label for="item-name" class="text-ash-300 mb-1.5 block text-xs font-medium">Name</label>
						<input
							id="item-name"
							bind:value={form.name}
							class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
							placeholder="Mega Bomb"
						/>
					</div>

					<div>
						<span class="text-ash-300 mb-1.5 block text-xs font-medium">Effect type</span>
						<LabeledSelect id="item-effect" appearance="form-inline" selectClass="w-full" options={effectOptions} bind:value={form.effect_type} />
					</div>

					<div>
						<label for="item-desc" class="text-ash-300 mb-1.5 block text-xs font-medium">Description</label>
						<textarea
							id="item-desc"
							bind:value={form.description}
							rows="2"
							class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
							placeholder="Shown on the item hover card"
						></textarea>
					</div>

					<div>
						<label for="item-cost" class="text-ash-300 mb-1.5 block text-xs font-medium">Cost (XP)</label>
						<input
							id="item-cost"
							type="number"
							bind:value={form.cost}
							class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
						/>
					</div>
				</div>

				<div class="border-ash-700 bg-ash-900/40 space-y-3 rounded-xl border p-4">
					<p class="text-ash-400 text-[11px] font-semibold tracking-wide uppercase">Effect settings</p>
					{#if form.effect_type === 'steal' || form.effect_type === 'bomb'}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="text-ash-300 text-xs"
								>Min %<input
									type="number"
									bind:value={form.cfg.min_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Max %<input
									type="number"
									bind:value={form.cfg.max_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Cooldown (min)<input
									type="number"
									bind:value={form.cfg.cooldown_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Victim immunity (min)<input
									type="number"
									bind:value={form.cfg.immunity_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">
							{form.effect_type === 'steal' ? 'Steals a random % of XP to the buyer.' : 'Destroys a random % of XP (vanishes).'}
						</p>
					{:else if form.effect_type === 'boost'}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="text-ash-300 text-xs"
								>Multiplier<input
									type="number"
									step="0.1"
									bind:value={form.cfg.multiplier}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs sm:col-span-2"
								>Scope
								<select bind:value={form.cfg.scope} class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm">
									<option value="all">All XP</option>
									<option value="message">Message only</option>
									<option value="voice">Voice only</option>
								</select>
							</label>
						</div>
						<p class="text-ash-500 text-[11px]">Multiplies earned XP for the duration.</p>
					{:else if form.effect_type === 'shield' || form.effect_type === 'reflect' || form.effect_type === 'disguise'}
						<label class="text-ash-300 text-xs"
							>Duration (min)<input
								type="number"
								bind:value={form.cfg.effect_duration_minutes}
								class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
							/></label
						>
						<p class="text-ash-500 text-[11px]">
							{#if form.effect_type === 'reflect'}Bounces the next attack back at the attacker.{:else if form.effect_type === 'disguise'}Go anonymous in attack
								messages, invisible to spies, and off the XP leaderboard while active.{:else}Blocks incoming attacks while active.{/if}
						</p>
					{:else if form.effect_type === 'insurance'}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="text-ash-300 text-xs"
								>Refund %<input
									type="number"
									min="0"
									max="100"
									bind:value={form.cfg.refund_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs sm:col-span-2"
								>Cooldown (min)<input
									type="number"
									bind:value={form.cfg.cooldown_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">Refunds that % of a loss once. Cooldown in minutes (1440 = 1 day).</p>
					{:else if form.effect_type === 'gift'}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="text-ash-300 text-xs"
								>Gift amount (XP)<input
									type="number"
									bind:value={form.cfg.gift_amount}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Tax %<input
									type="number"
									bind:value={form.cfg.tax_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">Sends fixed XP to a member, minus the tax (burned).</p>
					{:else if form.effect_type === 'leech'}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="text-ash-300 text-xs"
								>Skim %<input
									type="number"
									bind:value={form.cfg.skim_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">Skims a % of the target's XP while active.</p>
					{:else if form.effect_type === 'bounty'}
						<label class="text-ash-300 text-xs"
							>Bounty amount (XP)<input
								type="number"
								bind:value={form.cfg.bounty_amount}
								class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
							/></label
						>
						<p class="text-ash-500 text-[11px]">XP on a member's head, claimed by whoever hits them next.</p>
					{:else if form.effect_type === 'spy'}
						<label class="text-ash-300 text-xs"
							>Spy success chance %<input
								type="number"
								min="1"
								max="100"
								bind:value={form.cfg.spy_chance}
								class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
							/></label
						>
						<p class="text-ash-500 text-[11px]">
							Chance the spy succeeds (sees through disguise too). On a miss, the target is publicly alerted and the spy is named — 100% means it always works.
						</p>
					{:else if form.effect_type === 'luck'}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="text-ash-300 text-xs"
								>Luck %<input
									type="number"
									min="0"
									bind:value={form.cfg.luck_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">
							Boosts minigame odds, spy chance, leech skim, insurance refund and friend boost by this %, cuts gift tax by this %, and discounts every shop price
							by this % while active.
						</p>
					{:else}
						<p class="text-ash-500 text-[11px]">No extra settings for this effect type yet.</p>
					{/if}
				</div>

				<div class="border-ash-700 bg-ash-900/40 space-y-3 rounded-xl border p-4">
					<p class="text-ash-400 text-[11px] font-semibold tracking-wide uppercase">Availability (optional, UTC)</p>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<label class="text-ash-300 text-xs">
							From
							<div
								class="bg-ash-700 border-ash-600 hover:border-ash-500 mt-1 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors focus-within:border-teal-500"
							>
								<i class="fas fa-calendar-day text-ash-400 text-xs"></i>
								<input
									type="datetime-local"
									bind:value={form.available_from}
									class="text-ash-100 m-date min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
								/>
								{#if form.available_from}
									<button type="button" onclick={() => (form.available_from = '')} aria-label="Clear" class="text-ash-500 hover:text-ash-200 text-xs">
										<i class="fas fa-times"></i>
									</button>
								{/if}
							</div>
						</label>
						<label class="text-ash-300 text-xs">
							To
							<div
								class="bg-ash-700 border-ash-600 hover:border-ash-500 mt-1 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors focus-within:border-teal-500"
							>
								<i class="fas fa-calendar-day text-ash-400 text-xs"></i>
								<input
									type="datetime-local"
									bind:value={form.available_to}
									class="text-ash-100 m-date min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
								/>
								{#if form.available_to}
									<button type="button" onclick={() => (form.available_to = '')} aria-label="Clear" class="text-ash-500 hover:text-ash-200 text-xs">
										<i class="fas fa-times"></i>
									</button>
								{/if}
							</div>
						</label>
					</div>
					<div>
						<p class="text-ash-300 mb-1.5 text-xs">Recurring days (UTC)</p>
						<div class="flex flex-wrap gap-1">
							{#each DAYS as d}
								<button
									type="button"
									onclick={() => toggleDay(d.v)}
									class="rounded-lg px-2.5 py-1 text-[11px] transition-colors {form.cfg.recur_days.includes(d.v)
										? 'bg-teal-600 text-white'
										: 'bg-ash-700 text-ash-300 hover:bg-ash-600'}">{d.l}</button
								>
							{/each}
						</div>
						<div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
							<label class="text-ash-300 text-xs"
								>From (HH:MM)<input
									bind:value={form.cfg.recur_from}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
									placeholder="18:00"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>To (HH:MM)<input
									bind:value={form.cfg.recur_to}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
									placeholder="21:00"
								/></label
							>
						</div>
					</div>
				</div>

				<div class="border-ash-700 bg-ash-900/40 space-y-3 rounded-xl border p-4">
					<ConfigToggleRow
						label="Allow buy"
						description="When off, the Buy button is disabled so members can't buy it. Copies members already own still work."
						labelIconClass="fas fa-cart-plus text-teal-400"
						bind:enabled={form.enabled}
					/>
					<ConfigToggleRow
						label="Allow use"
						description="When off, members can't use copies they already own — it becomes dead weight in their items."
						labelIconClass="fas fa-hand-pointer text-teal-400"
						bind:enabled={form.usable}
					/>
				</div>

				{#if isTargeted}<p class="text-ash-500 text-[11px]">
						<i class="fas fa-crosshairs mr-1"></i>Targeted — members pick a target on use.
					</p>{/if}
			</div>

			<div class="border-ash-700 flex gap-3 border-t px-4 py-4 sm:px-6">
				<button onclick={() => (editing = null)} class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
					>Cancel</button
				>
				<button
					onclick={save}
					disabled={saving}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
				>
					{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<ConfirmModal
	open={confirmDelete !== null}
	title="Delete item"
	message={confirmDelete ? `Delete "${confirmDelete.name}"? This removes it from every server's items.` : ''}
	confirmLabel="Delete"
	dangerous
	loading={deleting}
	onconfirm={remove}
	oncancel={() => (confirmDelete = null)}
/>

{#if giftItem}
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={() => (giftItem = null)} role="presentation">
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="Give item to a member"
		>
			<div class="border-ash-700 flex items-center justify-between border-b px-4 py-4 sm:px-6">
				<h3 class="text-ash-100 flex min-w-0 items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-gift text-teal-400"></i><span class="truncate">Give “{giftItem.name}”</span>
				</h3>
				<button type="button" onclick={() => (giftItem = null)} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="border-ash-700 border-b px-4 py-3 sm:px-6">
				<div class="relative">
					<i class="fas fa-search text-ash-500 absolute top-1/2 left-3 -translate-y-1/2 text-xs"></i>
					<input
						type="search"
						bind:value={giftSearch}
						oninput={onGiftSearchInput}
						placeholder="Search members by name…"
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border py-2.5 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
					/>
				</div>
				<p class="text-ash-500 mt-2 text-[11px]">Only members in servers with the items module enabled are shown. Same person can appear per server.</p>
			</div>

			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
				{#if giftLoading}
					<p class="text-ash-400 text-sm"><i class="fas fa-spinner fa-spin mr-1"></i>Loading…</p>
				{:else if giftGroups.length === 0}
					<p class="text-ash-400 py-6 text-center text-sm">No members found.</p>
				{:else}
					{#each giftGroups as group}
						<div>
							<div class="text-ash-400 mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
								<i class="fas fa-server text-ash-500"></i>{group.server}
								<span class="text-ash-600 normal-case">· {group.members.length}</span>
							</div>
							<div class="space-y-1">
								{#each group.members as m}
									<div class="bg-ash-700/50 flex items-center gap-3 rounded-lg p-2">
										<img src={giftAvatar(m)} alt={giftMemberName(m)} loading="lazy" class="h-9 w-9 shrink-0 rounded-full object-cover" />
										<div class="min-w-0 flex-1">
											<div class="text-ash-100 truncate text-sm font-medium">{giftMemberName(m)}</div>
											<div class="text-ash-500 text-[11px]"><i class="fas fa-bag-shopping mr-1"></i>{Number(m.inventory_total || 0)} owned</div>
										</div>
										<button
											onclick={() => giveTo(m)}
											disabled={giftingMemberId === m.id}
											class="flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
										>
											{#if giftingMemberId === m.id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-gift"></i>{/if}Give
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.m-date::-webkit-calendar-picker-indicator {
		filter: invert(0.7);
		cursor: pointer;
	}
	.m-date::-webkit-datetime-edit {
		color: inherit;
	}
</style>
