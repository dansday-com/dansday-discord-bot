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

	function grp(n: number | null): string {
		return n == null || !Number.isFinite(n) ? '' : Math.floor(n).toLocaleString();
	}
	function onAmountInput(e: Event, set: (v: number | null) => void) {
		const digits = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '');
		set(digits === '' ? null : Number(digits));
	}

	const byCost = (a: any, b: any) => (Number(a.cost) || 0) - (Number(b.cost) || 0);

	const shopItems = $derived(
		(data.visibleItems ?? [])
			.map((item: any) => {
				const a = itemAvailability(item, ctx.now, tzOffset());
				return { ...item, availableUntil: a.availableUntil, _visible: a.visible };
			})
			.filter((item: any) => item._visible)
			.filter((item: any) => item.enabled !== false || item.usable !== false || (Number(item.owned_quantity) || 0) > 0)
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
			} else showToast(d.error || 'Failed to use item', 'error');
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

	const WAGER_PERCENTS = [25, 50, 75, 100];
	let gambleItem = $state<any | null>(null);
	let gamblePercent = $state<number | 'custom'>(25);
	let gambleCustom = $state<number | null>(null);
	let gambleRolling = $state(false);
	let reel = $state<string[]>([]);
	let reelOffset = $state(0);
	let reelResult = $state<'win' | 'lose' | null>(null);
	let reelSpinning = $state(false);
	let reelAnimating = $state(false);
	let gambleShake = $state(false);
	let coins = $state<{ id: number; x: number; delay: number }[]>([]);
	let winCount = $state(0);
	let lostAmount = $state(0);
	let reelWrapEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (gambleItem === null) return;
		document.body.style.overflow = 'hidden';
		return () => (document.body.style.overflow = '');
	});

	function randomCells(n: number): ('win' | 'lose')[] {
		return Array.from({ length: n }, () => (Math.random() < 0.5 ? 'win' : 'lose'));
	}

	function centerCell(index: number) {
		requestAnimationFrame(() => {
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cell = reelWrapEl?.querySelectorAll<HTMLElement>('.m-gamble-cell')?.[index];
			if (!cell) return;
			const cellCenter = cell.offsetLeft + cell.offsetWidth / 2;
			reelOffset = wrapW / 2 - cellCenter;
		});
	}

	function openGamble(item: any) {
		gambleItem = item;
		gamblePercent = 25;
		gambleCustom = null;
		reel = randomCells(12);
		reelOffset = 0;
		reelResult = null;
		reelSpinning = false;
		reelAnimating = false;
		gambleShake = false;
		coins = [];
		winCount = 0;
		lostAmount = 0;
		centerCell(2);
	}

	function resetGamble() {
		gamblePercent = 25;
		gambleCustom = null;
		reel = randomCells(12);
		reelOffset = 0;
		reelResult = null;
		reelAnimating = false;
		coins = [];
		winCount = 0;
		lostAmount = 0;
		centerCell(2);
	}

	const wagerXp = $derived(
		gamblePercent === 'custom'
			? Math.min(Math.max(0, Math.floor(Number(gambleCustom) || 0)), ctx.liveXp)
			: Math.floor((ctx.liveXp * (gamblePercent as number)) / 100)
	);
	const payoutMultiplier = $derived(Number(gambleItem?.config?.payout_multiplier ?? 2) || 2);
	const potentialWin = $derived(Math.floor(wagerXp * payoutMultiplier));

	function spawnCoins() {
		coins = Array.from({ length: 14 }, (_, i) => ({ id: i, x: (i / 13) * 100, delay: (i % 7) * 55 }));
		setTimeout(() => (coins = []), 1600);
	}

	function countUpWin(target: number) {
		winCount = 0;
		const steps = 28;
		let i = 0;
		const t = setInterval(() => {
			i++;
			winCount = Math.round(target * (1 - Math.pow(1 - i / steps, 2)));
			if (i >= steps) {
				winCount = target;
				clearInterval(t);
			}
		}, 22);
	}

	async function playGamble() {
		const item = gambleItem;
		if (!item || gambleRolling) return;
		if (wagerXp <= 0) {
			showToast('Not enough XP to wager', 'error');
			return;
		}
		gambleRolling = true;
		reelResult = null;
		coins = [];
		winCount = 0;
		lostAmount = 0;
		reel = randomCells(12);
		reelAnimating = false;
		reelOffset = 0;
		reelSpinning = true;
		try {
			const body =
				gamblePercent === 'custom'
					? { card: ctx.hash, item_id: item.id, amount: wagerXp, tz_offset: tzOffset() }
					: { card: ctx.hash, item_id: item.id, percent: gamblePercent, tz_offset: tzOffset() };
			const res = await fetch(`/api/items/${encodeURIComponent(ctx.serverSlug)}/gamble`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const d = await res.json();
			if (!d.success) {
				showToast(d.error || 'Gamble failed', 'error');
				gambleRolling = false;
				reelSpinning = false;
				return;
			}
			const won = !!d.result?.won;
			const landIndex = 32;
			const cells = randomCells(40);
			cells[landIndex] = won ? 'win' : 'lose';
			cells[landIndex - 1] = won ? 'lose' : 'win';
			cells[landIndex + 1] = won ? 'lose' : 'win';
			reel = cells;
			reelAnimating = false;
			reelOffset = 0;
			await new Promise((r) => requestAnimationFrame(() => r(null)));
			const wrapW = reelWrapEl?.clientWidth ?? 360;
			const cellEls = reelWrapEl?.querySelectorAll<HTMLElement>('.m-gamble-cell');
			const target = cellEls?.[landIndex];
			if (target) {
				const cellCenter = target.offsetLeft + target.offsetWidth / 2;
				reelAnimating = true;
				reelOffset = wrapW / 2 - cellCenter;
			}
			const net = Number(d.result?.net);
			const newXp = Number.isFinite(net) ? Math.max(0, ctx.liveXp + net) : ctx.liveXp;
			setTimeout(() => {
				reelSpinning = false;
				reelAnimating = false;
				gambleRolling = false;
				reelResult = won ? 'win' : 'lose';
				gambleShake = true;
				setTimeout(() => (gambleShake = false), 480);
				if (won) {
					spawnCoins();
					countUpWin(Math.floor(Number(d.result?.payout) || potentialWin));
				} else {
					lostAmount = Math.floor(Number(d.result?.wager) || wagerXp);
				}
				ctx.setLiveXp(newXp);
				ctx.invalidateAll();
			}, 3700);
		} catch {
			showToast('Gamble failed', 'error');
			gambleRolling = false;
			reelSpinning = false;
		}
	}
</script>

<svelte:head><title>{data.server.name || data.server.slug} Items | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet card(item: any)}
	{@const affordable = canAfford(item)}
	{@const owned = Number(item.owned_quantity) || 0}
	{@const buffActive = isBuffActive(item.effect_type)}
	{@const canBuy = item.enabled !== false}
	{@const canUse = item.usable !== false}
	<article
		class="m-card"
		class:m-card--locked={!ctx.readOnly && !affordable && owned === 0}
		class:m-card--owned={owned > 0}
		class:m-card--burst={ctx.burstId === item.id}
		data-cat={item.effect_type}
	>
		<div class="m-card-glow"></div>
		<div class="m-card-top">
			<span class="m-card-medallion">
				<i class="fas {effectIcon(item.effect_type)}"></i>
				{#if owned > 0}<span class="m-card-qty">×{owned}</span>{/if}
			</span>
			{#if owned > 0 && !ctx.readOnly}
				<button
					class="m-card-remove"
					aria-label="Remove one"
					title="Remove one"
					disabled={discardingId === item.member_item_id || ctx.busy === item.member_item_id}
					onclick={() => discard({ member_item_id: item.member_item_id })}
				>
					{#if discardingId === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-trash-can"></i>{/if}
				</button>
			{/if}
		</div>
		{#if item.availableUntil && item.availableUntil > ctx.now}
			<span class="m-card-timer"><i class="fas fa-hourglass-half"></i>Ends in {ctx.remainingLabel(item.availableUntil)}</span>
		{/if}
		<h3 class="m-card-name">{item.name}</h3>
		<p class="m-card-desc">{item.description || effectSummary(item)}</p>
		{#if effectMeta(item).length > 0}
			<div class="m-card-meta">
				{#each effectMeta(item) as chip}
					<span class="m-card-stat" title={chip.label}><i class="fas {chip.icon}"></i>{chip.label}</span>
				{/each}
			</div>
		{/if}

		<div class="m-card-foot">
			{#if item.effect_type === 'gamble'}
				<span class="m-card-price m-card-price--wager"><i class="fas fa-dice"></i>Wager</span>
				<button
					class="m-card-btn m-card-btn--play"
					disabled={ctx.readOnly || !canBuy || !canUse}
					title={ctx.readOnly ? 'Open your card to play' : !canBuy || !canUse ? 'Unavailable right now' : 'Play'}
					onclick={() => !ctx.readOnly && openGamble(item)}
				>
					<i class="fas fa-dice"></i>Play
				</button>
			{:else}
				<span class="m-card-price" class:m-card-price--short={!ctx.readOnly && !affordable}>{fmt(item.cost)}<span class="m-card-price-unit">XP</span></span>

				{#if ctx.readOnly}
					<div class="m-card-actions">
						<button class="m-card-btn m-card-btn--buy" disabled title="Open your card to buy"><i class="fas fa-cart-plus"></i>Buy</button>
					</div>
				{:else}
					<div class="m-card-actions">
						<button
							class="m-card-btn m-card-btn--buy"
							disabled={ctx.busy === item.id || !canBuy || !affordable || ctx.bagFull}
							title={!canBuy ? 'Buying is turned off' : ctx.bagFull ? 'Items full' : !affordable ? 'Not enough XP' : 'Buy one'}
							onclick={(e) => buy(item, e)}
						>
							{#if ctx.busy === item.id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas fa-cart-plus"></i>{/if}
							Buy
						</button>

						{#if owned > 0}
							{#if buffActive}
								<button class="m-card-btn m-card-btn--use" disabled title="Already active"><i class="fas fa-check"></i>Active</button>
							{:else}
								<button
									class="m-card-btn m-card-btn--use"
									disabled={ctx.busy === item.member_item_id || !canUse}
									title={!canUse ? 'Using is turned off' : actionVerb(item.effect_type).label}
									onclick={() => onUse({ ...item, member_item_id: item.member_item_id, quantity: owned, usable: canUse })}
								>
									{#if ctx.busy === item.member_item_id}<i class="fas fa-spinner fa-spin"></i>{:else}<i class="fas {actionVerb(item.effect_type).icon}"
										></i>{/if}
									{actionVerb(item.effect_type).label}
								</button>
							{/if}
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</article>
{/snippet}

{#if shopItems.length === 0}
	<div class="m-members-empty">No items in this category.</div>
{:else if data.category !== 'all'}
	<div class="m-cards">
		{#each shopItems.slice().sort(byCost) as item (item.id)}
			{@render card(item)}
		{/each}
	</div>
{:else}
	{#each groups as group (group.key)}
		<div class="m-group">
			<h2 class="m-group-head" class:m-group-head--limited={group.key === 'limited'}>
				<i class="fas {group.icon}"></i>{group.label}
				<span class="m-group-count">{group.items.length}</span>
			</h2>
			<div class="m-cards">
				{#each group.items as item (item.id)}
					{@render card(item)}
				{/each}
			</div>
		</div>
	{/each}
{/if}

{#if pickingTargetFor}
	<div class="m-tgt-overlay" role="presentation" onclick={() => (pickingTargetFor = null)}>
		<div class="m-tgt-modal" role="dialog" aria-modal="true" aria-label="Pick a target" onclick={(e) => e.stopPropagation()}>
			<button class="m-items-back" onclick={() => (pickingTargetFor = null)}><i class="fas fa-arrow-left"></i>Back</button>
			<p class="m-items-pick-label">Pick a target for <strong>{pickingTargetFor.name}</strong>:</p>
			{#if (data.targets ?? []).length === 0}
				<div class="m-members-empty">No eligible targets in this server.</div>
			{:else}
				<div class="m-tgt-search">
					<i class="fas fa-search m-tgt-search-ic" aria-hidden="true"></i>
					<input
						type="search"
						class="m-tgt-search-inp"
						placeholder="Search a member to {actionVerb(pickingTargetFor.effect_type).label.toLowerCase()}…"
						bind:value={targetSearch}
					/>
				</div>
				{#if visibleTargets.length === 0}
					<div class="m-members-empty">No members match “{targetSearch}”.</div>
				{:else}
					<ul class="m-tgt-list">
						{#each visibleTargets as t (t.hash)}
							<li>
								<button class="m-tgt" disabled={ctx.busy === pickingTargetFor.member_item_id} onclick={() => pickTarget(pickingTargetFor, t.hash)}>
									<span class="m-tgt-rank">{t.rank != null ? `#${t.rank}` : '—'}</span>
									<img
										class="m-tgt-av"
										src={targetAvatar(t)}
										alt={t.name}
										loading="lazy"
										onerror={(e) => ((e.currentTarget as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png')}
									/>
									<span class="m-tgt-body">
										<span class="m-tgt-name">{t.name}</span>
										<span class="m-tgt-stats"><span>Lv.{t.level}</span><span class="m-tgt-dot">·</span><span>{fmt(t.experience)} XP</span></span>
										{#if t.roles.length > 0}
											<span class="m-tgt-roles">
												{#each t.roles.slice(0, 3) as role}
													<span class="m-tgt-role" style="--rc: {role.color || '#888'}">{role.name}</span>
												{/each}
											</span>
										{/if}
									</span>
									<i class="fas fa-crosshairs m-tgt-aim"></i>
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
	<div class="m-out-overlay" role="presentation" onclick={dismissOutcome}>
		<div
			class="m-out m-out--{outcome.tone}"
			class:m-out--spy={outcome.spyReport}
			role="dialog"
			aria-modal="true"
			aria-label={outcome.title}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="m-out-icon"><i class="fas {outcome.icon}"></i></div>
			<div class="m-out-title">{outcome.title}</div>
			{#if outcome.deltaXp != null && outcome.deltaXp !== 0}
				<div class="m-out-delta {outcome.deltaXp >= 0 ? 'm-out-delta--up' : 'm-out-delta--down'}">
					{outcome.deltaXp >= 0 ? '+' : '−'}{fmt(Math.abs(outcome.deltaXp))} XP
				</div>
			{/if}
			<p class="m-out-line">{outcome.line}</p>
			{#if outcome.spyReport}
				{@const rep = outcome.spyReport}
				<div class="m-spy">
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-briefcase"></i>Bag</div>
						{#if rep.bag.length === 0}
							<div class="m-spy-empty">Their bag is empty.</div>
						{:else}
							<div class="m-spy-chips">
								{#each rep.bag as b}
									<span class="m-spy-chip"><i class="fas {effectIcon(b.effect_type)}"></i>{b.name} ×{b.quantity}</span>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-wand-magic-sparkles"></i>Active effects</div>
						{#if rep.effects.length === 0}
							<div class="m-spy-empty">No active effects.</div>
						{:else}
							<div class="m-spy-chips">
								{#each rep.effects as e}
									<span class="m-spy-chip"
										><i class="fas {effectIcon(e.effect_type)}"></i>{effectLine(e)}{#if e.expiresAt}<span class="m-spy-rel">· {relUntil(e.expiresAt)}</span
											>{/if}</span
									>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-stopwatch"></i>Cooldowns</div>
						{#if rep.cooldowns.length === 0}
							<div class="m-spy-empty">No active cooldowns.</div>
						{:else}
							<div class="m-spy-chips">
								{#each rep.cooldowns as c}
									<span class="m-spy-chip" class:m-spy-chip--shield={c.kind === 'immunity'}>
										<i class="fas {c.kind === 'immunity' ? 'fa-shield-halved' : 'fa-clock'}"></i>{cooldownLabels[c.kind] ?? c.kind}<span class="m-spy-rel"
											>· {relUntil(c.until)}</span
										>
									</span>
								{/each}
							</div>
						{/if}
					</div>
					<div class="m-spy-sec">
						<div class="m-spy-head"><i class="fas fa-crosshairs"></i>Bounty</div>
						{#if (rep.bounty ?? 0) > 0}
							<div class="m-spy-chips">
								<span class="m-spy-chip m-spy-chip--bounty"><i class="fas fa-crosshairs"></i>{fmt(rep.bounty)} XP on their head</span>
							</div>
						{:else}
							<div class="m-spy-empty">No bounty on them.</div>
						{/if}
					</div>
					<div class="m-spy-sec">
						<div class="m-spy-head">
							<i class="fas fa-chart-line"></i>Assets
							{#if (rep.assets?.length ?? 0) > 0}
								<span class="m-spy-total">{fmt(rep.assetsInvested)} XP invested · worth {fmt(rep.assetsValue)}</span>
							{/if}
						</div>
						{#if (rep.assets?.length ?? 0) === 0}
							<div class="m-spy-empty">No assets held.</div>
						{:else}
							<div class="m-spy-chips">
								{#each rep.assets as a}
									<span class="m-spy-chip m-spy-chip--asset" data-dir={a.pnl > 0 ? 'up' : a.pnl < 0 ? 'down' : 'flat'}>
										{#if a.asset_image}<img class="m-spy-asset-logo" src={a.asset_image} alt="" />{:else}<i class="fas fa-coins"></i>{/if}
										{a.symbol}
										<span class="m-spy-rel">· {fmt(a.xp_invested)} XP ({a.pnl >= 0 ? '+' : ''}{a.pnl_percent.toFixed(1)}%)</span>
									</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
			{#if outcome.untilMs}
				<div class="m-out-until"><i class="fas fa-clock"></i>Active until {untilLabel(outcome.untilMs)}</div>
			{/if}
			{#if outcome.spyReport}
				<button class="m-out-close" onclick={dismissOutcome}><i class="fas fa-check"></i>Done</button>
			{/if}
		</div>
	</div>
{/if}

{#if gambleItem}
	<div class="m-gamble-overlay" role="presentation" onclick={() => (!gambleRolling ? (gambleItem = null) : null)}>
		<div
			class="m-gamble"
			class:m-gamble--shake={gambleShake}
			class:m-gamble--won={reelResult === 'win'}
			class:m-gamble--lost={reelResult === 'lose'}
			role="dialog"
			aria-modal="true"
			aria-label="Gamble"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="m-gamble-aura"></div>
			<div class="m-gamble-head">
				<span class="m-gamble-title"><span class="m-gamble-ico"><i class="fas {effectIcon(gambleItem.effect_type)}"></i></span>{gambleItem.name}</span>
				{#if !gambleRolling}<button class="m-gamble-x" aria-label="Close" onclick={() => (gambleItem = null)}><i class="fas fa-times"></i></button>{/if}
			</div>

			<div
				bind:this={reelWrapEl}
				class="m-gamble-reelwrap"
				class:m-gamble-reelwrap--win={reelResult === 'win'}
				class:m-gamble-reelwrap--lose={reelResult === 'lose'}
				class:m-gamble-reelwrap--spinning={reelSpinning}
			>
				<div class="m-gamble-frame"></div>
				<div class="m-gamble-pointer"></div>
				<div
					class="m-gamble-reel"
					class:m-gamble-reel--spin={reelSpinning}
					style="transform: translateX({reelOffset}px); transition: {reelAnimating ? 'transform 3.6s cubic-bezier(0.09, 0.62, 0.12, 1)' : 'none'};"
				>
					{#each reel as cell, i (i)}
						<div class="m-gamble-cell m-gamble-cell--{cell}">
							<i class="fas {cell === 'win' ? 'fa-sack-dollar' : 'fa-skull'}"></i>
						</div>
					{/each}
				</div>

				{#if coins.length > 0}
					<div class="m-gamble-coins">
						{#each coins as c (c.id)}
							<span class="m-gamble-coin" style="left: {c.x}%; animation-delay: {c.delay}ms"><i class="fas fa-coins"></i></span>
						{/each}
					</div>
				{/if}

				{#if reelResult}
					<div class="m-gamble-verdict m-gamble-verdict--{reelResult}">
						{#if reelResult === 'win'}
							<span class="m-gamble-verdict-label">WIN</span>
							<span class="m-gamble-verdict-amt">+{fmt(winCount)} XP</span>
						{:else}
							<span class="m-gamble-verdict-label">BUST</span>
							<span class="m-gamble-verdict-amt">−{fmt(lostAmount)} XP</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if reelResult && !gambleRolling}
				<div class="m-gamble-again">
					<button class="m-gamble-reset" onclick={resetGamble}><i class="fas fa-sliders"></i>Change bet</button>
					<button class="m-gamble-play m-gamble-play--charged" disabled={wagerXp <= 0 || wagerXp > ctx.liveXp} onclick={playGamble}>
						<i class="fas fa-rotate-right"></i>Spin again · {fmt(wagerXp)}
					</button>
				</div>
			{:else}
				<div class="m-gamble-picker">
					{#each WAGER_PERCENTS as p}
						<button class="m-gamble-pct" class:m-gamble-pct--active={gamblePercent === p} disabled={gambleRolling} onclick={() => (gamblePercent = p)}
							>{p}%</button
						>
					{/each}
					<button
						class="m-gamble-pct"
						class:m-gamble-pct--active={gamblePercent === 'custom'}
						disabled={gambleRolling}
						onclick={() => (gamblePercent = 'custom')}>Custom</button
					>
				</div>
				{#if gamblePercent === 'custom'}
					<input
						class="m-gamble-custom"
						type="text"
						inputmode="numeric"
						placeholder="Enter XP to wager"
						value={grp(gambleCustom)}
						oninput={(e) => onAmountInput(e, (v) => (gambleCustom = v))}
						disabled={gambleRolling}
					/>
				{/if}

				<div class="m-gamble-stakes">
					<div class="m-gamble-stake">
						<span class="m-gamble-stake-k">Wager</span>
						<span class="m-gamble-stake-v m-gamble-stake-v--bet">{fmt(wagerXp)}</span>
					</div>
					<i class="fas fa-arrow-right m-gamble-stake-arrow"></i>
					<div class="m-gamble-stake">
						<span class="m-gamble-stake-k">Win pays</span>
						<span class="m-gamble-stake-v m-gamble-stake-v--win">{fmt(potentialWin)}</span>
					</div>
				</div>

				<button
					class="m-gamble-play"
					class:m-gamble-play--charged={!gambleRolling && wagerXp > 0}
					disabled={gambleRolling || wagerXp <= 0}
					onclick={playGamble}
				>
					{#if gambleRolling}<i class="fas fa-circle-notch fa-spin"></i>Rolling…{:else}<i class="fas fa-dice"></i>Spin {gamblePercent === 'custom'
							? ''
							: `${gamblePercent}%`}{/if}
				</button>
			{/if}
		</div>
	</div>
{/if}
