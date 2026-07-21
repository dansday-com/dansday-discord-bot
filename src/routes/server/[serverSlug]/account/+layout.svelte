<script lang="ts">
	import { onDestroy, onMount, setContext } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll, goto } from '$app/navigation';
	import MemberCard from '$lib/frontend/components/MemberCard.svelte';
	import { publicServerPath } from '$lib/url.js';
	import { ITEM_EFFECTS, effectLabel, effectIcon, effectAccentHex, actionVerb, BAG_CAPACITY, formatDuration } from '$lib/items.js';
	import type { PublicMembersStreamPayload } from '$lib/frontend/public/members/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const pd = $derived(page.data as any);

	const accountBase = $derived(`${publicServerPath(data.server.slug)}/account`);
	const readOnly = $derived(!!pd.readOnly || !pd.memberCard);
	const navHash = $derived(pd.hash || 'guest');
	const pathNorm = $derived(page.url.pathname.replace(/\/$/, ''));
	const isHistory = $derived(/\/account\/history\//.test(pathNorm));
	const isGuide = $derived(/\/account\/guide\//.test(pathNorm));
	const isAssets = $derived(/\/account\/assets\//.test(pathNorm));
	const isShop = $derived(!isHistory && !isGuide && !isAssets);
	const activeCat = $derived.by(() => {
		const m = pathNorm.match(/\/account\/(?:items|history|assets)\/([^/]+)\/[^/]+$/);
		return m ? m[1] : 'all';
	});

	const historyTabs = [
		{ id: 'all', label: 'All', icon: 'fa-grip' },
		{ id: 'items', label: 'Items', icon: 'fa-bag-shopping' },
		{ id: 'assets', label: 'Assets', icon: 'fa-chart-line' },
		{ id: 'level', label: 'Level', icon: 'fa-star' }
	];

	const assetTabs = $derived([
		{ id: 'top', label: 'Top 50', icon: 'fa-ranking-star' },
		{ id: 'gainers', label: 'Gainers', icon: 'fa-arrow-trend-up' },
		{ id: 'losers', label: 'Losers', icon: 'fa-arrow-trend-down' },
		{ id: 'search', label: 'Search', icon: 'fa-magnifying-glass' },
		...(readOnly ? [] : [{ id: 'mine', label: 'My Assets', icon: 'fa-wallet' }])
	]);

	let assetSummaryLive = $state<{ invested: number; value: number; pnl: number; pnlPct: number; count: number } | null>(null);
	function setAssetSummary(s: any) {
		assetSummaryLive = s;
	}
	const assetSummary = $derived.by(() => {
		if (assetSummaryLive) return assetSummaryLive;
		const invested = Number(pd.totalInvested) || 0;
		const value = Number(pd.totalValue) || 0;
		const pnl = value - invested;
		return { invested, value, pnl, pnlPct: invested > 0 ? (pnl / invested) * 100 : 0, count: (pd.positions ?? []).length };
	});

	let now = $state(Date.now());
	let busy = $state<number | null>(null);

	let liveXp = $state(pd.balance?.experience ?? 0);
	let level = $state(pd.balance?.level ?? 1);
	let rank = $state(pd.balance?.rank ?? null);

	$effect(() => {
		liveXp = pd.balance?.experience ?? 0;
		level = pd.balance?.level ?? 1;
		rank = pd.balance?.rank ?? null;
	});

	function fmt(n: number): string {
		return Number(n ?? 0).toLocaleString();
	}

	const memberAvatar = $derived(pd.memberAvatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(pd.memberDiscordId) % 5 || 0}.png`);

	function xpForLevel(lvl: number): number {
		if (lvl <= 1) return 0;
		const { baseXp, multiplier } = pd.levelReq ?? { baseXp: 100, multiplier: 1.2 };
		if (multiplier === 1) return baseXp * (lvl - 1);
		return Math.floor((baseXp * (Math.pow(multiplier, lvl - 1) - 1)) / (multiplier - 1));
	}

	const levelInfo = $derived.by(() => {
		const floor = xpForLevel(level);
		const next = xpForLevel(level + 1);
		const span = Math.max(1, next - floor);
		const gained = Math.max(0, liveXp - floor);
		const pct = Math.max(0, Math.min(100, Math.round((gained / span) * 100)));
		return { floor, next, span, gained, pct, toNext: Math.max(0, next - liveXp) };
	});

	const activeChips = $derived.by(() => {
		const chips: { key: string; icon: string; label: string; until: number; accent: string; text?: string }[] = [];
		for (const e of (pd.activeEffects ?? []) as any[]) {
			if (!e.expiresAt || e.expiresAt <= now) continue;
			let label = effectLabel(e.effect_type);
			let accent = effectAccentHex(e.effect_type);
			if (e.effect_type === 'leech' && e.leechRole) {
				label = e.leechRole === 'victim' ? `Leeched by ${e.leechWith}` : `Leeching ${e.leechWith}`;
				if (e.leechRole === 'victim') accent = effectAccentHex('steal');
			}
			chips.push({
				key: `eff-${e.effect_type}-${e.leechWith ?? ''}-${e.expiresAt}`,
				icon: effectIcon(e.effect_type),
				label,
				until: e.expiresAt,
				accent
			});
		}
		if (pd.immuneUntil && pd.immuneUntil > now)
			chips.push({ key: 'immune', icon: 'fa-shield-halved', label: 'Immune', until: pd.immuneUntil, accent: effectAccentHex('insurance') });
		for (const cd of (pd.attackCooldowns ?? []) as { action: 'steal' | 'bomb'; until: number }[]) {
			if (!cd.until || cd.until <= now) continue;
			chips.push({
				key: `cd-${cd.action}`,
				icon: cd.action === 'steal' ? 'fa-hand' : 'fa-bomb',
				label: cd.action === 'steal' ? 'Steal cooldown' : 'Bomb cooldown',
				until: cd.until,
				accent: effectAccentHex(cd.action)
			});
		}
		if (pd.insuranceCooldownUntil && pd.insuranceCooldownUntil > now)
			chips.push({
				key: 'cd-insurance',
				icon: effectIcon('insurance'),
				label: 'Insurance cooldown',
				until: pd.insuranceCooldownUntil,
				accent: effectAccentHex('insurance')
			});
		chips.sort((a, b) => a.until - b.until);
		if ((pd.bountyTotal ?? 0) > 0)
			chips.push({
				key: 'bounty',
				icon: effectIcon('bounty'),
				label: 'Bounty on you',
				until: 0,
				accent: effectAccentHex('bounty'),
				text: `${fmt(pd.bountyTotal)} XP`
			});
		return chips;
	});

	function remainingLabel(untilMs: number): string {
		const secs = Math.max(0, Math.floor((untilMs - now) / 1000));
		if (secs < 60) return `${secs}s`;
		return formatDuration(Math.floor(secs / 60));
	}

	const typeTabs = $derived.by(() => {
		const source = pd.categories ?? [];
		const present = new Set(source as string[]);
		const ordered = ITEM_EFFECTS.filter((e) => present.has(e.id));
		return [{ id: 'all', label: 'All', icon: 'fa-grip' }, ...ordered.map((e) => ({ id: e.id, label: e.label, icon: e.icon }))];
	});

	const sessionKey = $derived(`items_card_${data.server.slug}`);

	function syncTabSession() {
		if (typeof sessionStorage === 'undefined') return;
		const urlHash = pd.hash && pd.hash !== 'guest' ? String(pd.hash) : '';
		if (urlHash) {
			sessionStorage.setItem(sessionKey, urlHash);
			return;
		}
		const stored = sessionStorage.getItem(sessionKey);
		if (stored) {
			if (isGuide) {
				goto(`${accountBase}/guide/${stored}`, { replaceState: true });
				return;
			}
			const section = isHistory ? 'history' : isAssets ? 'assets' : 'items';
			const cat = activeCat && activeCat !== 'guest' ? activeCat : isAssets ? 'top' : 'all';
			goto(`${accountBase}/${section}/${cat}/${stored}`, { replaceState: true });
		}
	}

	let es: EventSource | null = null;
	onMount(() => {
		syncTabSession();
		const t = setInterval(() => (now = Date.now()), 1000);
		if (pd.memberDiscordId) {
			const url = `/api/public-statistics/${encodeURIComponent(data.server.slug)}/members-stream`;
			const source = new EventSource(url);
			es = source;
			source.onmessage = (e) => {
				try {
					const payload = JSON.parse(e.data) as PublicMembersStreamPayload;
					const me = payload?.members?.find((m: any) => String(m.discord_member_id) === pd.memberDiscordId);
					if (me) {
						if (me.experience != null) liveXp = Number(me.experience) || 0;
						if (me.level != null) level = Number(me.level) || 1;
						if (me.rank != null) rank = Number(me.rank);
					}
				} catch (_) {}
			};
			source.onerror = () => {};
		}
		return () => clearInterval(t);
	});
	onDestroy(() => es?.close());

	let showCard = $state(false);

	let tabsEl: HTMLDivElement | undefined = $state();
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function updateTabScroll() {
		const el = tabsEl;
		if (!el) return;
		canScrollLeft = el.scrollLeft > 1;
		canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
	}

	function scrollTabs(dir: -1 | 1) {
		const el = tabsEl;
		if (!el) return;
		el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' });
	}

	$effect(() => {
		typeTabs;
		isShop;
		isHistory;
		isAssets;
		requestAnimationFrame(updateTabScroll);
	});

	let bagTabEl: HTMLAnchorElement | undefined = $state();
	let bagPulse = $state(false);
	let burstId = $state<number | null>(null);

	function flyToBag(fromEl: HTMLElement | null, iconClass: string) {
		if (!fromEl || !bagTabEl || typeof document === 'undefined') return;
		const start = fromEl.getBoundingClientRect();
		const end = bagTabEl.getBoundingClientRect();
		const clone = document.createElement('div');
		clone.className = 'm-fly';
		const ic = document.createElement('i');
		ic.className = `fas ${iconClass || 'fa-cube'}`;
		clone.appendChild(ic);
		clone.style.left = `${start.left + start.width / 2}px`;
		clone.style.top = `${start.top + start.height / 2}px`;
		document.body.appendChild(clone);
		const dx = end.left + end.width / 2 - (start.left + start.width / 2);
		const dy = end.top + end.height / 2 - (start.top + start.height / 2);
		const anim = clone.animate(
			[
				{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0 },
				{ transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) scale(1.15)`, opacity: 1, offset: 0.6 },
				{ transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`, opacity: 0.2, offset: 1 }
			],
			{ duration: 620, easing: 'cubic-bezier(0.5, 0, 0.7, 1)' }
		);
		anim.onfinish = () => {
			clone.remove();
			bagPulse = false;
			requestAnimationFrame(() => (bagPulse = true));
			setTimeout(() => (bagPulse = false), 520);
		};
	}

	function canAfford(item: any): boolean {
		return liveXp >= (Number(item.cost) || 0);
	}

	function setLiveXp(n: number) {
		liveXp = n;
	}
	function setBusy(v: number | null) {
		busy = v;
	}
	function setBurst(id: number | null) {
		burstId = id;
	}

	const SELF_BUFFS = new Set(['boost', 'shield', 'reflect', 'insurance', 'disguise']);
	function isBuffActive(effectType: string): boolean {
		if (!SELF_BUFFS.has(effectType)) return false;
		return ((pd.activeEffects ?? []) as any[]).some((e) => e.effect_type === effectType && e.expiresAt && e.expiresAt > now);
	}

	setContext('items', {
		fmt,
		canAfford,
		isBuffActive,
		effectIcon,
		effectLabel,
		actionVerb,
		flyToBag,
		setLiveXp,
		setBusy,
		setBurst,
		setAssetSummary,
		invalidateAll,
		get busy() {
			return busy;
		},
		get burstId() {
			return burstId;
		},
		get now() {
			return now;
		},
		get liveXp() {
			return liveXp;
		},
		bagCapacity: BAG_CAPACITY,
		get bagStock() {
			return pd.bagStock ?? 0;
		},
		get bagFull() {
			return (pd.bagStock ?? 0) >= BAG_CAPACITY;
		},
		get hash() {
			return pd.hash;
		},
		get readOnly() {
			return readOnly;
		},
		get serverSlug() {
			return data.server.slug;
		},
		remainingLabel
	});
</script>

<div class="m-items">
	{#if !readOnly}
		<div class="m-xp">
			<div class="m-xp-glow"></div>
			{#if pd.memberCard && !(isAssets && assetSummary.count === 0)}
				<button class="m-xp-card-btn" onclick={() => (showCard = true)} aria-label="Share your card" title="Share card">
					<i class="fas fa-share-nodes"></i>
					<span class="m-xp-card-btn-label">Share</span>
				</button>
			{/if}
			<div class="m-xp-avatar">
				<img src={memberAvatar} alt={pd.memberName ?? ''} loading="lazy" />
			</div>
			<div class="m-xp-figures">
				<span class="m-xp-wallet"><i class="fas {isAssets ? 'fa-chart-line' : 'fa-wallet'}"></i>{isAssets ? 'Invested in Assets' : 'Wallet'}</span>
				{#if pd.memberName}<span class="m-xp-name">{pd.memberName}</span>{/if}
				<span class="m-xp-amount">{fmt(isAssets ? assetSummary.invested : liveXp)}<span class="m-xp-unit">XP</span></span>
				<div class="m-xp-bar" class:m-xp-bar--hidden={isAssets}>
					<div class="m-xp-bar-fill" style="width: {levelInfo.pct}%"></div>
				</div>
				<span class="m-xp-bar-meta">
					{#if isAssets}
						<span>{assetSummary.count} asset{assetSummary.count === 1 ? '' : 's'}</span>
						<span>Worth {fmt(assetSummary.value)} XP</span>
					{:else}
						<span>Lvl {level}</span>
						<span>{levelInfo.toNext > 0 ? `${fmt(levelInfo.toNext)} XP to Lvl ${level + 1}` : 'Max progress'}</span>
					{/if}
				</span>
			</div>
			<div class="m-xp-stats">
				{#if isAssets}
					<div class="m-xp-stat m-xp-stat--pnl" data-dir={assetSummary.pnl > 0 ? 'up' : assetSummary.pnl < 0 ? 'down' : 'flat'}>
						<span class="m-xp-stat-val">
							<i class="fas fa-caret-{assetSummary.pnl >= 0 ? 'up' : 'down'}"></i>{assetSummary.pnlPct >= 0 ? '+' : ''}{assetSummary.pnlPct.toFixed(2)}%
						</span>
						<span class="m-xp-stat-lbl">{assetSummary.pnl >= 0 ? '+' : ''}{fmt(assetSummary.pnl)} XP</span>
					</div>
				{:else}
					<div class="m-xp-stat">
						<span class="m-xp-stat-val">{levelInfo.pct}%</span>
						<span class="m-xp-stat-lbl">Level {level}</span>
					</div>
					{#if rank}
						<div class="m-xp-stat">
							<span class="m-xp-stat-val">#{rank}</span>
							<span class="m-xp-stat-lbl">Rank</span>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}

	{#if activeChips.length > 0}
		<div class="m-active">
			{#each activeChips as chip (chip.key)}
				<span class="m-active-chip" style="--chip-accent: {chip.accent}">
					<i class="fas {chip.icon}"></i>
					<span class="m-active-label">{chip.label}</span>
					<span class="m-active-time">{chip.text ?? remainingLabel(chip.until)}</span>
				</span>
			{/each}
		</div>
	{/if}

	<div class="m-items-bar">
		<div class="m-items-toggle">
			<a
				bind:this={bagTabEl}
				class="m-items-seg"
				class:m-items-seg--active={isShop}
				class:m-items-seg--pulse={bagPulse}
				href="{accountBase}/items/all/{navHash}"
				data-sveltekit-preload-data="hover"
			>
				<i class="fas fa-store"></i>Items{#if !readOnly}<span class="m-items-count" class:m-items-count--bump={bagPulse}>{pd.bagStock ?? 0}/{BAG_CAPACITY}</span
					>{/if}
			</a>
			<a class="m-items-seg" class:m-items-seg--active={isAssets} href="{accountBase}/assets/top/{navHash}" data-sveltekit-preload-data="hover">
				<i class="fas fa-chart-line"></i>Assets
			</a>
			{#if !readOnly}
				<a class="m-items-seg" class:m-items-seg--active={isHistory} href="{accountBase}/history/all/{navHash}" data-sveltekit-preload-data="hover">
					<i class="fas fa-clock-rotate-left"></i>History
				</a>
			{/if}
			<a class="m-items-seg" class:m-items-seg--active={isGuide} href="{accountBase}/guide/{navHash}" data-sveltekit-preload-data="hover">
				<i class="fas fa-circle-question"></i>Guide
			</a>
		</div>
	</div>

	{#snippet tabStrip(tabs: { id: string; label: string; icon: string }[], section: 'items' | 'history' | 'assets', hash: string)}
		<div class="m-items-tabswrap">
			<button
				type="button"
				class="m-items-arrow m-items-arrow--left"
				class:m-items-arrow--show={canScrollLeft}
				aria-label="Scroll categories left"
				tabindex={canScrollLeft ? 0 : -1}
				onclick={() => scrollTabs(-1)}
			>
				<i class="fas fa-chevron-left"></i>
			</button>
			<div bind:this={tabsEl} class="m-items-tabs" onscroll={updateTabScroll}>
				{#each tabs as cat}
					<a
						class="m-items-tab"
						class:m-items-tab--active={activeCat === cat.id}
						href="{accountBase}/{section}/{cat.id}/{hash}"
						data-sveltekit-preload-data="hover"
					>
						<i class="fas {cat.icon}"></i>{cat.label}
					</a>
				{/each}
			</div>
			<button
				type="button"
				class="m-items-arrow m-items-arrow--right"
				class:m-items-arrow--show={canScrollRight}
				aria-label="Scroll categories right"
				tabindex={canScrollRight ? 0 : -1}
				onclick={() => scrollTabs(1)}
			>
				<i class="fas fa-chevron-right"></i>
			</button>
		</div>
	{/snippet}

	{#if isShop}
		{@render tabStrip(typeTabs, 'items', navHash)}
	{:else if isHistory}
		{@render tabStrip(historyTabs, 'history', pd.hash)}
	{:else if isAssets}
		{@render tabStrip(assetTabs, 'assets', navHash)}
	{/if}

	{#if readOnly && (isShop || isAssets)}
		<div class="m-guest">
			<div class="m-guest-ic"><i class="fas fa-lock"></i></div>
			<div class="m-guest-body">
				<h3>You're browsing as a guest</h3>
				<p>
					{isAssets ? 'Trading assets' : 'Buying and using items'} is locked. Open the account page from the
					<strong>account button</strong> in your Discord server to log in and play.
				</p>
			</div>
		</div>
	{/if}

	{#if readOnly && !isGuide}
		<div class="m-readonly" inert>
			{@render children()}
		</div>
	{:else}
		{@render children()}
	{/if}
</div>

{#if showCard && pd.memberCard}
	<MemberCard
		member={{ ...pd.memberCard, level, experience: liveXp, rank }}
		mode={isAssets ? 'assets' : 'level'}
		assets={{ invested: assetSummary.invested, value: assetSummary.value, pnl: assetSummary.pnl, pnlPct: assetSummary.pnlPct, count: assetSummary.count }}
		serverName={data.server.name || data.server.slug}
		serverIcon={data.server.server_icon}
		onclose={() => (showCard = false)}
	/>
{/if}
