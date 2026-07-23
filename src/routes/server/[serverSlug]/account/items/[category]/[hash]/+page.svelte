<script lang="ts">
	import { getContext } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import {
		effectSummary,
		effectIcon,
		effectLabel,
		effectMeta,
		itemAvailability,
		actionVerb,
		describeItemOutcome,
		formatDuration,
		TARGETED_EFFECTS as TARGETED,
		ITEM_EFFECTS,
		type ItemOutcome
	} from '$lib/items.js';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
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
		const card = (ev?.currentTarget as HTMLElement | undefined)?.closest('.m-card');
		const medallion = card?.querySelector('.m-card-medallion') as HTMLElement | null;
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
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
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

	async function discard(item: any) {
		discardingId = item.member_item_id;
		try {
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/discard`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card: ctx.hash, member_item_id: item.member_item_id, quantity: 1 })
			});
			const d = await res.json();
			if (d.success) await ctx.invalidateAll();
			else showToast(d.error || 'Failed to remove item', 'error');
		} catch {
			showToast('Failed to remove item', 'error');
		} finally {
			discardingId = null;
		}
	}

	const visibleTargets = $derived.by(() => {
		const q = targetSearch.trim().toLowerCase();
		const list = q ? (data.targets ?? []).filter((t: any) => (t.name ?? '').toLowerCase().includes(q)) : (data.targets ?? []);
		return [...list].sort((a: any, b: any) => (b.experience ?? 0) - (a.experience ?? 0));
	});

	function targetAvatar(t: any): string {
		return t.avatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(t.discord_member_id) % 5 || 0}.png`;
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Items | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet card(item: any)}
	{@const affordable = canAfford(item)}
	{@const owned = Number(item.owned_quantity) || 0}
	{@const buffActive = isBuffActive(item.effect_type)}
	{@const notStarted = item._state === 'upcoming'}
	{@const canBuy = item._buyable}
	{@const canUse = item.usable !== false}
	<article
		class="m-card relative flex flex-col gap-2 overflow-hidden rounded-2xl px-4 pt-4 pb-4"
		class:m-card--locked={!ctx.readOnly && !affordable && owned === 0}
		class:m-card--owned={owned > 0}
		class:m-card--burst={ctx.burstId === item.id}
		data-cat={item.effect_type}
	>
		<div class="m-card-glow pointer-events-none z-1 opacity-0"></div>
		<div class="m-card-top flex items-start justify-between gap-2">
			<span class="m-card-medallion relative grid h-12 h-14 w-12 w-14 place-items-center rounded-2xl text-lg text-xl">
				<i class="fas {effectIcon(item.effect_type)}"></i>
				{#if owned > 0}<span class="m-card-qty grid h-5 min-w-5 place-items-center rounded-[999px] px-1 py-0 text-xs font-extrabold text-white">×{owned}</span
					>{/if}
			</span>
			{#if owned > 0 && !ctx.readOnly}
				<button
					class="m-card-remove text-lb-text-muted relative z-4 ml-auto grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-lg text-base"
					aria-label="Remove one"
					title="Remove one"
					disabled={discardingId === item.member_item_id || ctx.busy === item.member_item_id}
					onclick={() => discard({ member_item_id: item.member_item_id })}
				>
					{#if discardingId === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-trash-can"></i>{/if}
				</button>
			{/if}
		</div>
		{#if item._state === 'upcoming' && item._startsAt}
			<span class="m-card-timer m-card-timer--soon text-warning-deep inline-flex items-center gap-1 rounded-[999px] px-2 py-1 text-xs font-bold tabular-nums"
				><i class="fas fa-hourglass-start"></i>Starts in {ctx.remainingLabel(item._startsAt)}</span
			>
		{:else if item.availableUntil && item.availableUntil > ctx.now}
			<span class="m-card-timer text-warning-deep inline-flex items-center gap-1 rounded-[999px] px-2 py-1 text-xs font-bold tabular-nums"
				><i class="fas fa-hourglass-half"></i>Ends in {ctx.remainingLabel(item.availableUntil)}</span
			>
		{/if}
		<h3 class="m-card-name text-lb-text mx-0 mt-1 mb-0 text-base font-extrabold">{item.name}</h3>
		<p class="m-card-desc text-lb-text-muted m-0 min-h-[2.9em] text-base text-xs">{item.description || effectSummary(item, ctx.luckPercent)}</p>
		{#if effectMeta(item, ctx.luckPercent).length > 0}
			<div class="m-card-meta mx-0 mt-2 mb-1 flex flex-wrap gap-1">
				{#each effectMeta(item, ctx.luckPercent) as chip}
					<span class="m-card-stat inline-flex items-center gap-1 rounded-[999px] px-2 py-1 text-xs font-bold whitespace-nowrap tabular-nums" title={chip.label}
						><i class="fas {chip.icon}"></i>{chip.label}</span
					>
				{/each}
			</div>
		{/if}

		<div class="m-card-foot relative z-2 mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
			<span
				class="m-card-price text-warning inline-flex min-w-0 flex-auto items-baseline gap-1 text-base font-extrabold whitespace-nowrap"
				class:m-card-price--short={!ctx.readOnly && !affordable}
			>
				{#if item.original_cost != null && item.original_cost > item.cost}
					<span class="m-card-price-strike text-xs font-semibold">{fmt(item.original_cost)}</span>
				{/if}
				{fmt(item.cost)}<span class="m-card-price-unit text-xs font-bold opacity-70">XP</span>
			</span>

			{#if ctx.readOnly}
				<div class="m-card-actions ml-auto flex flex-[1_1_100%] items-center justify-end gap-2">
					<button
						class="m-card-btn m-card-btn--buy inline-flex flex-none cursor-pointer items-center justify-center gap-1 rounded-lg px-3 px-4 py-2 text-base font-bold whitespace-nowrap text-white"
						disabled
						title="Open your card to buy"><i class="fas fa-cart-plus"></i>Buy</button
					>
				</div>
			{:else}
				<div class="m-card-actions ml-auto flex flex-[1_1_100%] items-center justify-end gap-2">
					<button
						class="m-card-btn m-card-btn--buy inline-flex flex-none cursor-pointer items-center justify-center gap-1 rounded-lg px-3 px-4 py-2 text-base font-bold whitespace-nowrap text-white"
						disabled={ctx.busy === item.id || !canBuy || !affordable || ctx.bagFull}
						title={notStarted
							? 'Not available yet'
							: item.enabled === false
								? 'Buying is turned off'
								: ctx.bagFull
									? 'Items full'
									: !affordable
										? 'Not enough XP'
										: 'Buy one'}
						onclick={(e) => buy(item, e)}
					>
						{#if ctx.busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-cart-plus"></i>{/if}
						Buy
					</button>

					{#if owned > 0}
						{#if buffActive}
							<button
								class="m-card-btn m-card-btn--use inline-flex flex-none cursor-pointer items-center justify-center gap-1 rounded-lg px-3 px-4 py-2 text-base font-bold whitespace-nowrap text-white"
								disabled
								title="Already active"><i class="fas fa-check"></i>Active</button
							>
						{:else}
							<button
								class="m-card-btn m-card-btn--use inline-flex flex-none cursor-pointer items-center justify-center gap-1 rounded-lg px-3 px-4 py-2 text-base font-bold whitespace-nowrap text-white"
								disabled={ctx.busy === item.member_item_id || !canUse}
								title={!canUse ? 'Using is turned off' : actionVerb(item.effect_type).label}
								onclick={() => onUse({ ...item, member_item_id: item.member_item_id, quantity: owned, usable: canUse })}
							>
								{#if ctx.busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas {actionVerb(item.effect_type).icon}"></i>{/if}
								{actionVerb(item.effect_type).label}
							</button>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	</article>
{/snippet}

{#if shopItems.length === 0}
	<div class="m-members-empty px-4 py-12 text-center">No items in this category.</div>
{:else if data.category !== 'all'}
	<div class="m-cards grid gap-2 gap-4">
		{#each shopItems.slice().sort(byCost) as item (item.id)}
			{@render card(item)}
		{/each}
	</div>
{:else}
	{#each groups as group (group.key)}
		<div class="m-group mb-4">
			<h2
				class="m-group-head text-lb-text-muted mx-0 mt-0 mb-2 flex items-center gap-2 text-base font-extrabold uppercase"
				class:m-group-head--limited={group.key === 'limited'}
			>
				<i class="fas {group.icon}"></i>{group.label}
				<span class="m-group-count text-lb-text-muted rounded-[999px] px-2 py-1 text-xs font-bold tabular-nums">{group.items.length}</span>
			</h2>
			<div class="m-cards grid gap-2 gap-4">
				{#each group.items as item (item.id)}
					{@render card(item)}
				{/each}
			</div>
		</div>
	{/each}
{/if}

{#if pickingTargetFor}
	<div class="m-tgt-overlay z-60 flex items-center justify-center p-4" role="presentation" onclick={() => (pickingTargetFor = null)}>
		<div
			class="m-tgt-modal max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-[18px] p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Pick a target"
			onclick={(e) => e.stopPropagation()}
		>
			<button class="m-items-back text-lb-text-muted mb-2 inline-flex cursor-pointer items-center gap-2 text-base" onclick={() => (pickingTargetFor = null)}
				><i class="fas fa-arrow-left"></i>Back</button
			>
			<p class="m-items-pick-label text-lb-text mb-3 text-base">Pick a target for <strong>{pickingTargetFor.name}</strong>:</p>
			{#if (data.targets ?? []).length === 0}
				<div class="m-members-empty px-4 py-12 text-center">No eligible targets in this server.</div>
			{:else}
				<div class="m-tgt-search relative mb-2">
					<i class="fas fa-search m-tgt-search-ic text-lb-text-muted pointer-events-none text-base" aria-hidden="true"></i>
					<input
						type="search"
						class="m-tgt-search-inp text-lb-text w-full rounded-lg pt-2 pr-3 pb-2 pl-8 text-base"
						placeholder="Search a member to {actionVerb(pickingTargetFor.effect_type).label.toLowerCase()}…"
						bind:value={targetSearch}
					/>
				</div>
				{#if visibleTargets.length === 0}
					<div class="m-members-empty px-4 py-12 text-center">No members match “{targetSearch}”.</div>
				{:else}
					<ul class="m-tgt-list m-0 flex max-h-[440px] flex-col gap-2 overflow-x-hidden overflow-y-auto p-1">
						{#each visibleTargets as t (t.hash)}
							<li>
								<button
									class="m-tgt text-lb-text flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left"
									disabled={ctx.busy === pickingTargetFor.member_item_id}
									onclick={() => pickTarget(pickingTargetFor, t.hash)}
								>
									<span class="m-tgt-rank text-lb-text-muted min-w-8 flex-none text-center text-base font-bold">{t.rank != null ? `#${t.rank}` : '—'}</span>
									<img
										class="m-tgt-av h-10 w-10 flex-none rounded-full object-cover"
										src={targetAvatar(t)}
										alt={t.name}
										loading="lazy"
										onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
									/>
									<span class="m-tgt-body flex min-w-0 flex-auto flex-col gap-1">
										<span class="m-tgt-name overflow-hidden text-base font-semibold text-ellipsis whitespace-nowrap">{t.name}</span>
										<span class="m-tgt-stats text-lb-text-muted flex items-center gap-2 text-xs"
											><span>Lv.{t.level}</span><span class="m-tgt-dot opacity-60">·</span><span>{fmt(t.experience)} XP</span></span
										>
										{#if t.roles.length > 0}
											<span class="m-tgt-roles mt-1 flex flex-wrap gap-1">
												{#each t.roles.slice(0, 3) as role}
													<span class="m-tgt-role rounded-[999px] px-2 py-1 text-xs font-semibold whitespace-nowrap" style="--rc: {role.color || '#888'}"
														>{role.name}</span
													>
												{/each}
											</span>
										{/if}
									</span>
									<i class="fas fa-crosshairs m-tgt-aim text-danger flex-none text-base opacity-70"></i>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</div>
{/if}

{#if outcome}
	<div class="m-out-overlay z-99999 flex items-center justify-center overflow-hidden p-4" role="presentation" onclick={dismissOutcome}>
		<div
			class="m-out m-out--{outcome.tone} p-4"
			class:m-out--spy={outcome.spyReport}
			role="dialog"
			aria-modal="true"
			aria-label={outcome.title}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="m-out-icon text-yacht-teal mx-auto mt-0 mb-3 grid h-[76px] w-[76px] place-items-center rounded-full text-3xl">
				<i class="fas {outcome.icon}"></i>
			</div>
			<div class="m-out-title text-lb-text text-xl font-extrabold">{outcome.title}</div>
			{#if outcome.deltaXp != null && outcome.deltaXp !== 0}
				<div class="m-out-delta {outcome.deltaXp >= 0 ? 'm-out-delta--up' : 'm-out-delta--down'} mt-2 text-xl font-extrabold tabular-nums">
					{outcome.deltaXp >= 0 ? '+' : '−'}{fmt(Math.abs(outcome.deltaXp))} XP
				</div>
			{/if}
			<p class="m-out-line text-lb-text-muted mx-0 mt-2 mb-0 text-base">{outcome.line}</p>
			{#if outcome.spyReport}
				{@const rep = outcome.spyReport}
				<div class="m-spy mt-4 flex flex-col gap-3 text-left">
					<div class="m-spy-sec rounded-[14px] px-4 py-3">
						<div class="m-spy-head text-lb-text-muted mb-2 flex items-center gap-2 text-xs font-extrabold uppercase"><i class="fas fa-briefcase"></i>Bag</div>
						{#if rep.bag.length === 0}
							<div class="m-spy-empty text-lb-text-muted text-base">Their bag is empty.</div>
						{:else}
							<div class="m-spy-chips flex flex-wrap gap-2">
								{#each rep.bag as b}
									<span class="m-spy-chip text-lb-text inline-flex items-center gap-2 rounded-full px-2 py-1 text-base font-semibold"
										><i class="fas {effectIcon(b.effect_type)}"></i>{b.name} ×{b.quantity}</span
									>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec rounded-[14px] px-4 py-3">
						<div class="m-spy-head text-lb-text-muted mb-2 flex items-center gap-2 text-xs font-extrabold uppercase">
							<i class="fas fa-wand-magic-sparkles"></i>Active effects
						</div>
						{#if rep.effects.length === 0}
							<div class="m-spy-empty text-lb-text-muted text-base">No active effects.</div>
						{:else}
							<div class="m-spy-chips flex flex-wrap gap-2">
								{#each rep.effects as e}
									<span class="m-spy-chip text-lb-text inline-flex items-center gap-2 rounded-full px-2 py-1 text-base font-semibold"
										><i class="fas {effectIcon(e.effect_type)}"></i>{effectLine(e)}{#if e.expiresAt}<span class="m-spy-rel font-medium opacity-65"
												>· {relUntil(e.expiresAt)}</span
											>{/if}</span
									>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec rounded-[14px] px-4 py-3">
						<div class="m-spy-head text-lb-text-muted mb-2 flex items-center gap-2 text-xs font-extrabold uppercase">
							<i class="fas fa-stopwatch"></i>Cooldowns
						</div>
						{#if rep.cooldowns.length === 0}
							<div class="m-spy-empty text-lb-text-muted text-base">No active cooldowns.</div>
						{:else}
							<div class="m-spy-chips flex flex-wrap gap-2">
								{#each rep.cooldowns as c}
									<span
										class="m-spy-chip text-lb-text inline-flex items-center gap-2 rounded-full px-2 py-1 text-base font-semibold"
										class:m-spy-chip--shield={c.kind === 'immunity'}
									>
										<i class="fas {c.kind === 'immunity' ? 'fa-shield-halved' : 'fa-clock'}"></i>{cooldownLabels[c.kind] ?? c.kind}<span
											class="m-spy-rel font-medium opacity-65">· {relUntil(c.until)}</span
										>
									</span>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec rounded-[14px] px-4 py-3">
						<div class="m-spy-head text-lb-text-muted mb-2 flex items-center gap-2 text-xs font-extrabold uppercase">
							<i class="fas fa-crosshairs"></i>Bounty
						</div>
						{#if (rep.bounty ?? 0) > 0}
							<div class="m-spy-chips flex flex-wrap gap-2">
								<span
									class="m-spy-chip m-spy-chip--bounty text-lb-text inline-flex items-center gap-2 rounded-full px-2 py-1 text-base font-semibold text-[#a8327d]"
									><i class="fas fa-crosshairs"></i>{fmt(rep.bounty)} XP on their head</span
								>
							</div>
						{:else}
							<div class="m-spy-empty text-lb-text-muted text-base">No bounty on them.</div>
						{/if}
					</div>
					<div class="m-spy-sec rounded-[14px] px-4 py-3">
						<div class="m-spy-head text-lb-text-muted mb-2 flex items-center gap-2 text-xs font-extrabold uppercase">
							<i class="fas fa-chart-line"></i>Assets
							{#if (rep.assets?.length ?? 0) > 0}
								<span class="m-spy-total text-lb-text ml-auto text-xs font-bold opacity-85"
									>{fmt(rep.assetsInvested)} XP invested · worth {fmt(rep.assetsValue)}</span
								>
							{/if}
						</div>
						{#if (rep.assets?.length ?? 0) === 0}
							<div class="m-spy-empty text-lb-text-muted text-base">No assets held.</div>
						{:else}
							<div class="m-spy-chips flex flex-wrap gap-2">
								{#each rep.assets as a}
									<span
										class="m-spy-chip m-spy-chip--asset text-lb-text inline-flex items-center gap-2 rounded-full px-2 py-1 text-base font-semibold"
										data-dir={a.pnl > 0 ? 'up' : a.pnl < 0 ? 'down' : 'flat'}
									>
										{#if a.asset_image}<img class="m-spy-asset-logo h-4 w-4 shrink-0 rounded-full object-cover" src={a.asset_image} alt="" />{:else}<i
												class="fas fa-coins"
											></i>{/if}
										{a.symbol}
										<span class="m-spy-rel font-medium opacity-65">· {fmt(a.xp_invested)} XP ({a.pnl >= 0 ? '+' : ''}{a.pnl_percent.toFixed(1)}%)</span>
									</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
			{#if outcome.untilMs}
				<div class="m-out-until text-yacht-teal mt-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-base font-bold">
					<i class="fas fa-clock"></i>Active until {untilLabel(outcome.untilMs)}
				</div>
			{/if}
			{#if outcome.spyReport}
				<button
					class="m-out-close mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-2 text-base font-bold text-white"
					onclick={dismissOutcome}><i class="fas fa-check"></i>Done</button
				>
			{/if}
		</div>
	</div>
{/if}
