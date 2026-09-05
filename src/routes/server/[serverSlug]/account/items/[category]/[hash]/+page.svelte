<script lang="ts">
	import { lockScroll } from '$lib/frontend/scrollLock.js';
	import { getContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import {
		effectSummary,
		effectIcon,
		effectLabel,
		effectMeta,
		effectAccentHex,
		itemAvailability,
		actionVerb,
		describeItemOutcome,
		formatDuration,
		TARGETED_EFFECTS as TARGETED,
		ITEM_EFFECTS,
		type ItemOutcome
	} from '$lib/items.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { EmptyState, OutcomeModal, TargetPicker } from '$lib/frontend/components/public';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt, canAfford, isBuffActive } = ctx;

	const tzOffset = () => -new Date().getTimezoneOffset();

	const byCost = (a: any, b: any) => (Number(a.cost) || 0) - (Number(b.cost) || 0);

	const shopItems = $derived(
		(data.visibleItems ?? [])
			.map((item: any) => {
				const a = itemAvailability(item, ctx.now, tzOffset());
				const buyable = item.enabled !== false && (a.state === 'always' || a.state === 'active');
				return { ...item, availableUntil: a.availableUntil, _state: a.state, _startsAt: a.startsAt, _buyable: buyable };
			})
			.filter((item: any) => item.enabled !== false || item.usable !== false)
			.filter((item: any) => item._state === 'active' || item._state === 'upcoming' || item._buyable || (Number(item.owned_quantity) || 0) > 0)
	);

	const groups = $derived.by(() => {
		const list = [...shopItems].sort(byCost);
		if (data.category !== 'all') {
			return [{ key: 'flat', label: '', icon: '', items: list }];
		}
		const out: { key: string; label: string; icon: string; items: any[] }[] = [];
		const limited = list.filter((i) => i.availableUntil && i.availableUntil > ctx.now);
		if (limited.length > 0) out.push({ key: 'limited', label: 'Limited', icon: 'fa-hourglass-half', items: limited });
		for (const eff of ITEM_EFFECTS) {
			const items = list.filter((i) => i.effect_type === eff.id);
			if (items.length > 0) out.push({ key: eff.id, label: eff.label, icon: eff.icon, items });
		}
		return out;
	});

	async function buy(item: any, ev?: MouseEvent) {
		if (ctx.bagFull) {
			showToast(`Your items are full (max ${ctx.bagCapacity})`, 'error');
			return;
		}
		if (!canAfford(item)) {
			showToast(`Not enough XP — need ${fmt(item.cost)}`, 'error');
			return;
		}
		const card = (ev?.currentTarget as HTMLElement | undefined)?.closest('[data-item-card]');
		const medallion = card?.querySelector('[data-item-medallion]') as HTMLElement | null;
		ctx.setBusy(item.id);
		const optimistic = Math.max(0, ctx.liveXp - (Number(item.cost) || 0));
		try {
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/buy`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, item_id: item.id, quantity: 1, tz_offset: tzOffset() })
			});
			const d = await res.json();
			if (d.success) {
				ctx.setBurst(item.id);
				setTimeout(() => ctx.setBurst(null), 600);
				ctx.setLiveXp(optimistic);
				ctx.flyToBag(medallion, effectIcon(item.effect_type));
				await ctx.invalidateAll();
			} else showToast(d.error || 'Purchase failed', 'error');
		} catch {
			showToast('Purchase failed', 'error');
		} finally {
			ctx.setBusy(null);
		}
	}

	let pickingTargetFor = $state<any | null>(null);
	let targetSearch = $state('');
	let outcome = $state<ItemOutcome | null>(null);
	let outcomeTimer: ReturnType<typeof setTimeout> | null = null;
	let discardingId = $state<number | null>(null);

	$effect(() => {
		if (pickingTargetFor === null && outcome === null) return;
		return lockScroll();
	});

	function showOutcome(effectType: string, result: any) {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = describeItemOutcome(effectType, result);
		if (!outcome.spyReport) outcomeTimer = setTimeout(() => (outcome = null), 3500);
	}
	function showFailOutcome(title: string, line: string) {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = { tone: 'lose', icon: 'fa-triangle-exclamation', title, line, deltaXp: null, untilMs: null };
		outcomeTimer = setTimeout(() => (outcome = null), 3500);
	}
	function dismissOutcome() {
		if (outcomeTimer) clearTimeout(outcomeTimer);
		outcome = null;
	}

	function untilLabel(ms: number | null): string {
		if (!ms) return '';
		return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	}
	function relUntil(ms: number): string {
		const mins = Math.max(0, Math.round((ms - Date.now()) / 60000));
		if (mins <= 0) return 'now';
		return formatDuration(mins);
	}
	function effectLine(e: any): string {
		if (e.effect_type === 'boost') return `${e.effect_value || 2}× Boost`;
		if (e.effect_type === 'leech') {
			if (e.leechRole === 'victim') return `Leeched by ${e.leechWith} (${e.effect_value || 0}%)`;
			return `Leeching ${e.leechWith} (${e.effect_value || 0}%)`;
		}
		if (e.effect_type === 'insurance') return `Insurance (${e.effect_value || 0}% refund)`;
		if (e.effect_type === 'luck') return `+${e.effect_value || 0}% Luck`;
		return effectLabel(e.effect_type);
	}
	const cooldownLabels: Record<string, string> = {
		steal: 'Steal cooldown',
		bomb: 'Bomb cooldown',
		insurance: 'Insurance cooldown',
		immunity: 'Immune to attacks'
	};

	async function useItem(item: any, targetHash?: string) {
		ctx.setBusy(item.member_item_id);
		try {
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/use`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, target_card: targetHash, member_item_id: item.member_item_id })
			});
			const d = await res.json();
			if (d.success) {
				await ctx.invalidateAll();
				showOutcome(item.effect_type, d.result ?? { outcome: d.outcome });
			} else showFailOutcome(`${item.name} failed`, d.error || 'Please try again.');
		} finally {
			ctx.setBusy(null);
		}
	}

	function onUse(item: any) {
		if (item.usable === false) {
			showToast(`${item.name} can't be used right now.`, 'error');
			return;
		}
		if (isBuffActive(item.effect_type)) {
			showToast(`${effectLabel(item.effect_type)} is already active`, 'error');
			return;
		}
		if (TARGETED.has(item.effect_type)) {
			targetSearch = '';
			pickingTargetFor = item;
		} else useItem(item);
	}

	async function pickTarget(item: any, targetHash: string) {
		await useItem(item, targetHash);
		pickingTargetFor = null;
	}

	function poof(fromEl: HTMLElement | null, iconClass: string) {
		if (!fromEl || typeof document === 'undefined') return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const start = fromEl.getBoundingClientRect();
		const clone = document.createElement('div');
		clone.className = 'fixed z-9999 pointer-events-none text-[26px] leading-none text-base-content/45';
		const ic = document.createElement('i');
		ic.className = `fas ${iconClass || 'fa-cube'}`;
		clone.appendChild(ic);
		clone.style.left = `${start.left + start.width / 2}px`;
		clone.style.top = `${start.top + start.height / 2}px`;
		document.body.appendChild(clone);
		const anim = clone.animate(
			[
				{ transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 0.85, offset: 0 },
				{ transform: 'translate(-50%, calc(-50% + 12px)) scale(0.78) rotate(-10deg)', opacity: 0.5, offset: 0.45 },
				{ transform: 'translate(-50%, calc(-50% + 40px)) scale(0.35) rotate(-22deg)', opacity: 0, offset: 1 }
			],
			{ duration: 460, easing: 'cubic-bezier(0.4, 0, 1, 1)' }
		);
		anim.onfinish = () => clone.remove();
	}

	async function discard(item: any, ev?: MouseEvent) {
		const card = (ev?.currentTarget as HTMLElement | undefined)?.closest('[data-item-card]');
		const medallion = card?.querySelector('[data-item-medallion]') as HTMLElement | null;
		discardingId = item.member_item_id;
		try {
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/discard`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, member_item_id: item.member_item_id, quantity: 1 })
			});
			const d = await res.json();
			if (d.success) {
				poof(medallion, effectIcon(item.effect_type));
				showToast(`Removed one ${item.name}`, 'success');
				await ctx.invalidateAll();
			} else showToast(d.error || 'Failed to remove item', 'error');
		} catch {
			showToast('Failed to remove item', 'error');
		} finally {
			discardingId = null;
		}
	}

	const visibleTargets = $derived.by(() => {
		const q = targetSearch.trim().toLowerCase();
		const list = q ? (data.targets ?? []).filter((t: any) => (t.name ?? '').toLowerCase().includes(q)) : (data.targets ?? []);
		return [...list].sort((a: any, b: any) => (b.xp ?? 0) - (a.xp ?? 0));
	});

	function targetAvatar(t: any): string {
		return t.avatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(t.discord_member_id) % 5 || 0}.png`;
	}

	const assetDir = (pnl: number) => (pnl > 0 ? '#1a7f57' : pnl < 0 ? '#b23b2e' : 'var(--color-base-content)');
</script>

<svelte:head><title>{data.server.name || data.server.slug} Items | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet card(item: any)}
	{@const affordable = canAfford(item)}
	{@const owned = Number(item.owned_quantity) || 0}
	{@const buffActive = isBuffActive(item.effect_type)}
	{@const notStarted = item._state === 'upcoming'}
	{@const canBuy = item._buyable}
	{@const blockedReason = ctx.bagFull ? `Items full (max ${ctx.bagCapacity})` : !affordable ? 'Not enough XP' : ''}
	{@const canUse = item.usable !== false}
	<article
		data-item-card
		class="card relative isolate flex min-w-0 flex-col gap-[7px] overflow-hidden border p-[13px] pb-3 transition-transform duration-200 min-[600px]:gap-[9px] min-[600px]:rounded-[18px] min-[600px]:p-4 min-[600px]:pb-3.5 {!ctx.readOnly &&
		!affordable &&
		owned === 0
			? 'opacity-75'
			: ''} {ctx.burstId === item.id ? 'animate-item-burst' : ''}"
		style="--cat: {effectAccentHex(
			item.effect_type
		)}; background: radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--cat) 22%, transparent), transparent 60%), linear-gradient(170deg, color-mix(in srgb, var(--cat) 10%, var(--color-base-100)), var(--color-base-100) 70%); border-color: color-mix(in srgb, var(--cat) 26%, var(--color-base-300));"
	>
		<div class="flex items-start justify-between gap-1.5">
			<span
				data-item-medallion
				class="relative grid size-[46px] place-items-center rounded-[14px] border text-[21px] leading-none text-(--cat) min-[600px]:rounded-2xl min-[600px]:text-[24px]"
				style="background: radial-gradient(circle at 32% 26%, rgba(255,255,255,0.28), transparent 55%), linear-gradient(150deg, color-mix(in srgb, var(--cat) 38%, transparent), color-mix(in srgb, var(--cat) 14%, transparent)); border-color: color-mix(in srgb, var(--cat) 42%, transparent);"
			>
				<i class="fas {effectIcon(item.effect_type)}"></i>
				{#if owned > 0}
					<span
						class="border-base-100 absolute -right-1.5 -bottom-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 bg-(--cat) px-1.5 text-[11px] font-extrabold text-white"
					>
						×{owned}
					</span>
				{/if}
			</span>
			{#if owned > 0 && !ctx.readOnly}
				<button
					class="btn btn-sm btn-square border-base-300 bg-base-200 text-base-content/60 relative z-4 ml-auto size-7 min-h-0"
					aria-label="Remove one"
					title="Remove one"
					disabled={discardingId === item.member_item_id || ctx.busy === item.member_item_id}
					onclick={(e) => discard(item, e)}
				>
					{#if discardingId === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-trash-can"></i>{/if}
				</button>
			{/if}
		</div>

		{#if item._state === 'upcoming' && item._startsAt}
			<span
				class="badge badge-sm h-auto gap-1.5 self-start border-[rgba(184,134,11,0.3)] bg-[rgba(184,134,11,0.12)] py-[3px] text-[10.5px] font-bold text-[#b8860b] tabular-nums"
			>
				<i class="fas fa-hourglass-start"></i>Starts in {ctx.remainingLabel(item._startsAt)}
			</span>
		{:else if item.availableUntil && item.availableUntil > ctx.now}
			<span
				class="badge badge-sm h-auto gap-1.5 self-start border-[rgba(184,134,11,0.3)] bg-[rgba(184,134,11,0.12)] py-[3px] text-[10.5px] font-bold text-[#b8860b] tabular-nums"
			>
				<i class="fas fa-hourglass-half"></i>Ends in {ctx.remainingLabel(item.availableUntil)}
			</span>
		{/if}

		<h3 class="text-base-content mt-px text-sm leading-tight font-extrabold min-[600px]:text-[15.5px]">{item.name}</h3>
		<p class="text-base-content/60 min-h-[2.8em] text-[11.5px] leading-snug [overflow-wrap:anywhere] min-[600px]:text-[12.5px]">
			{item.description || effectSummary(item, ctx.luckPercent)}
		</p>

		{#if effectMeta(item, ctx.luckPercent).length > 0}
			<div class="mt-[7px] mb-0.5 flex flex-wrap gap-[5px]">
				{#each effectMeta(item, ctx.luckPercent) as chip}
					<span
						class="inline-flex items-center gap-1 rounded-full border px-[7px] py-0.5 text-[10.5px] font-bold whitespace-nowrap text-(--cat) tabular-nums"
						style="background: color-mix(in srgb, var(--cat) 12%, transparent); border-color: color-mix(in srgb, var(--cat) 24%, transparent);"
						title={chip.label}
					>
						<i class="fas {chip.icon}"></i>{chip.label}
					</span>
				{/each}
			</div>
		{/if}

		<div class="relative z-2 mt-auto flex flex-wrap items-center gap-1.5">
			<span
				class="inline-flex min-w-0 flex-auto items-baseline gap-1 text-sm leading-none font-extrabold whitespace-nowrap text-[#d9a528] min-[600px]:text-[15px]"
			>
				{#if item.original_cost != null && item.original_cost > item.cost}
					<span class="text-[11px] font-semibold text-current/45 line-through">{fmt(item.original_cost)}</span>
				{/if}
				{fmt(item.cost)}<span class="text-[10px] font-bold tracking-[0.03em] opacity-70">XP</span>
			</span>

			<div class="ml-auto flex flex-[1_1_100%] flex-wrap items-center justify-end gap-1.5">
				{#if ctx.readOnly}
					<button class="btn btn-sm" disabled title="Open your card to buy"><i class="fas fa-cart-plus"></i>Buy</button>
				{:else}
					<button
						class="btn btn-sm border-none font-bold {blockedReason
							? 'bg-base-300 text-base-content/55'
							: 'bg-linear-to-br from-[rgba(214,83,109,0.94)] to-[rgba(228,61,18,0.96)] text-white'}"
						disabled={ctx.busy === item.id || !canBuy}
						title={notStarted ? 'Not available yet' : item.enabled === false ? 'Buying is turned off' : blockedReason || 'Buy one'}
						onclick={(e) => buy(item, e)}
					>
						{#if ctx.busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-cart-plus"></i>{/if}
						Buy
					</button>

					{#if owned > 0}
						{#if buffActive}
							<button class="btn btn-sm" disabled title="Already active"><i class="fas fa-check"></i>Active</button>
						{:else}
							<button
								class="btn btn-sm border-none font-bold text-white"
								style="background: linear-gradient(135deg, var(--cat), color-mix(in srgb, var(--cat) 68%, black 22%));"
								disabled={ctx.busy === item.member_item_id || !canUse}
								title={!canUse ? 'Using is turned off' : actionVerb(item.effect_type).label}
								onclick={() => onUse({ ...item, member_item_id: item.member_item_id, quantity: owned, usable: canUse })}
							>
								{#if ctx.busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas {actionVerb(item.effect_type).icon}"></i>{/if}
								{actionVerb(item.effect_type).label}
							</button>
						{/if}
					{/if}
				{/if}
			</div>
		</div>
	</article>
{/snippet}

{#snippet spySection(icon: string, title: string, total: string | null, empty: string, hasRows: boolean, rows: Snippet)}
	<div class="border-base-300 bg-primary/5 rounded-2xl border px-3.5 py-3">
		<div class="text-base-content/60 mb-2.5 flex items-center gap-[7px] text-[11px] font-extrabold tracking-[0.04em] uppercase">
			<i class="fas {icon}"></i>{title}
			{#if total}<span class="text-base-content ml-auto text-[10.5px] font-bold tracking-normal normal-case opacity-85">{total}</span>{/if}
		</div>
		{#if hasRows}
			<div class="flex flex-wrap gap-1.5">{@render rows()}</div>
		{:else}
			<div class="text-base-content/60 text-[12.5px] italic">{empty}</div>
		{/if}
	</div>
{/snippet}

{#if shopItems.length === 0}
	<EmptyState icon="fa-box-open" message="No items in this category." boxed />
{:else if data.category !== 'all'}
	<div class="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 min-[600px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] min-[600px]:gap-3.5">
		{#each shopItems.slice().sort(byCost) as item (item.id)}
			{@render card(item)}
		{/each}
	</div>
{:else}
	{#each groups as group (group.key)}
		<div class="mb-[18px]">
			<h2
				class="mb-2.5 flex items-center gap-[7px] text-[12.5px] font-extrabold tracking-[0.02em] uppercase {group.key === 'limited'
					? 'text-[#b8860b]'
					: 'text-base-content/60'}"
			>
				<i class="fas {group.icon}"></i>{group.label}
				<span class="bg-base-content/14 text-base-content/60 rounded-full px-[7px] py-px text-[10.5px] font-bold tabular-nums">{group.items.length}</span>
			</h2>
			<div class="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 min-[600px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] min-[600px]:gap-3.5">
				{#each group.items as item (item.id)}
					{@render card(item)}
				{/each}
			</div>
		</div>
	{/each}
{/if}

{#if pickingTargetFor}
	<TargetPicker
		bind:search={targetSearch}
		placeholder="Search a member to {actionVerb(pickingTargetFor.effect_type).label.toLowerCase()}…"
		hasTargets={(data.targets ?? []).length > 0}
		matches={visibleTargets.length}
		onback={() => (pickingTargetFor = null)}
	>
		{#snippet label()}
			Pick a target for <strong>{pickingTargetFor.name}</strong>:
		{/snippet}

		{#each visibleTargets as t (t.hash)}
			<li>
				<button
					class="border-base-300 bg-base-100 text-base-content hover:border-primary/40 flex w-full items-center gap-[11px] rounded-xl border px-3 py-2.5 text-left transition-colors"
					disabled={ctx.busy === pickingTargetFor.member_item_id}
					onclick={() => pickTarget(pickingTargetFor, t.hash)}
				>
					<span class="text-base-content/60 min-w-[30px] shrink-0 text-center text-xs font-bold">{t.rank != null ? `#${t.rank}` : '—'}</span>
					<img
						class="border-base-300 size-[38px] shrink-0 rounded-full border object-cover"
						src={targetAvatar(t)}
						alt={t.name}
						loading="lazy"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
					/>
					<span class="flex min-w-0 flex-auto flex-col gap-0.5">
						<span class="truncate text-[13.5px] font-semibold">{t.name}</span>
						<span class="text-base-content/60 flex items-center gap-1.5 text-[11.5px]">
							<span>Lv.{t.level}</span><span class="opacity-60">·</span><span>{fmt(t.xp)} XP</span>
						</span>
						{#if t.roles.length > 0}
							<span class="mt-0.5 flex flex-wrap gap-1">
								{#each t.roles.slice(0, 3) as role}
									<span
										class="rounded-full border px-[7px] py-[3px] text-[10px] leading-none font-semibold whitespace-nowrap"
										style="--rc: {role.color ||
											'#888'}; color: var(--rc); background: color-mix(in srgb, var(--rc) 14%, transparent); border-color: color-mix(in srgb, var(--rc) 35%, transparent);"
									>
										{role.name}
									</span>
								{/each}
							</span>
						{/if}
					</span>
					<i class="fas fa-crosshairs shrink-0 text-[13px] text-[#c0392b] opacity-70"></i>
				</button>
			</li>
		{/each}
	</TargetPicker>
{/if}

{#if outcome}
	<OutcomeModal
		tone={outcome.tone}
		icon={outcome.icon}
		title={outcome.title}
		line={outcome.line}
		delta={outcome.deltaXp != null && outcome.deltaXp !== 0 ? `${outcome.deltaXp >= 0 ? '+' : '−'}${fmt(Math.abs(outcome.deltaXp))} XP` : null}
		deltaUp={(outcome.deltaXp ?? 0) >= 0}
		until={outcome.untilMs ? untilLabel(outcome.untilMs) : null}
		wide={!!outcome.spyReport}
		showClose={!!outcome.spyReport}
		onclose={dismissOutcome}
	>
		{#if outcome.spyReport}
			{@const rep = outcome.spyReport}
			<div class="mt-4 flex min-h-0 flex-col gap-3 overflow-y-auto text-left">
				{#snippet bagRows()}
					{#each rep.bag as b}
						<span
							class="border-base-300 bg-base-200 text-base-content inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-xs font-semibold"
						>
							<i class="fas {effectIcon(b.effect_type)}"></i>{b.name} ×{b.quantity}
						</span>
					{/each}
				{/snippet}
				{@render spySection('fa-briefcase', 'Bag', null, 'Their bag is empty.', rep.bag.length > 0, bagRows)}

				{#snippet effectRows()}
					{#each rep.effects as e}
						<span
							class="border-base-300 bg-base-200 text-base-content inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-xs font-semibold"
						>
							<i class="fas {effectIcon(e.effect_type)}"></i>{effectLine(e)}{#if e.expiresAt}<span class="font-medium opacity-65"
									>· {relUntil(e.expiresAt)}</span
								>{/if}
						</span>
					{/each}
				{/snippet}
				{@render spySection('fa-wand-magic-sparkles', 'Active effects', null, 'No active effects.', rep.effects.length > 0, effectRows)}

				{#snippet cooldownRows()}
					{#each rep.cooldowns as c}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-xs font-semibold {c.kind === 'immunity'
								? 'border-[rgba(29,111,138,0.28)] bg-[rgba(29,111,138,0.1)] text-[#1d6f8a]'
								: 'border-base-300 bg-base-200 text-base-content'}"
						>
							<i class="fas {c.kind === 'immunity' ? 'fa-shield-halved' : 'fa-clock'}"></i>{cooldownLabels[c.kind] ?? c.kind}<span
								class="font-medium opacity-65">· {relUntil(c.until)}</span
							>
						</span>
					{/each}
				{/snippet}
				{@render spySection('fa-stopwatch', 'Cooldowns', null, 'No active cooldowns.', rep.cooldowns.length > 0, cooldownRows)}

				{#snippet bountyRows()}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-[rgba(168,50,125,0.28)] bg-[rgba(168,50,125,0.1)] px-2.5 py-[5px] text-xs font-semibold text-[#a8327d]"
					>
						<i class="fas fa-crosshairs"></i>{fmt(rep.bounty)} XP on their head
					</span>
				{/snippet}
				{@render spySection('fa-crosshairs', 'Bounty', null, 'No bounty on them.', (rep.bounty ?? 0) > 0, bountyRows)}

				{#snippet assetRows()}
					{#each rep.assets as a}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-xs font-semibold"
							style="--dir: {assetDir(
								a.pnl
							)}; color: var(--dir); background: color-mix(in srgb, var(--dir) 10%, var(--color-base-200)); border-color: color-mix(in srgb, var(--dir) 28%, transparent);"
						>
							{#if a.asset_image}<img class="size-[15px] shrink-0 rounded-full object-cover" src={a.asset_image} alt="" />{:else}<i class="fas fa-coins"
								></i>{/if}
							{a.symbol}
							<span class="font-medium opacity-65">· {fmt(a.xp_invested)} XP ({a.pnl >= 0 ? '+' : ''}{a.pnl_percent.toFixed(1)}%)</span>
						</span>
					{/each}
				{/snippet}
				{@render spySection(
					'fa-chart-line',
					'Assets',
					(rep.assets?.length ?? 0) > 0 ? `${fmt(rep.assetsInvested)} XP invested · value ${fmt(rep.assetsValue)}` : null,
					'No assets held.',
					(rep.assets?.length ?? 0) > 0,
					assetRows
				)}
			</div>
		{/if}
	</OutcomeModal>
{/if}
