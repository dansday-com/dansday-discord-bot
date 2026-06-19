<script lang="ts">
	import { onDestroy, onMount, setContext } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import MemberCard from '$lib/frontend/components/MemberCard.svelte';
	import { publicServerPath } from '$lib/url.js';
	import { ITEM_EFFECTS, effectLabel, effectIcon, actionVerb } from '$lib/items.js';
	import type { PublicMembersStreamPayload } from '$lib/frontend/public/members/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const pd = $derived(page.data as any);

	const itemsBase = $derived(`${publicServerPath(data.server.slug)}/items`);
	const pathNorm = $derived(page.url.pathname.replace(/\/$/, ''));
	const isBag = $derived(/\/items\/bag\//.test(pathNorm));
	const isHistory = $derived(/\/items\/history\//.test(pathNorm));
	const isShop = $derived(!isBag && !isHistory);
	const activeCat = $derived.by(() => {
		const m = pathNorm.match(/\/items\/(?:shop|bag|history)\/([^/]+)\/[^/]+$/);
		return m ? m[1] : 'all';
	});

	const historyTabs = [
		{ id: 'all', label: 'All', icon: 'fa-grip' },
		{ id: 'items', label: 'Items', icon: 'fa-bag-shopping' },
		{ id: 'level', label: 'Level', icon: 'fa-star' }
	];

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

	const EFFECT_ICON: Record<string, { icon: string; label: string }> = Object.fromEntries(ITEM_EFFECTS.map((e) => [e.id, { icon: e.icon, label: e.label }]));

	const EFFECT_ACCENT: Record<string, string> = {
		steal: '#c0392b',
		bomb: '#d35400',
		boost: '#d9a528',
		shield: '#1d6f8a',
		leech: '#5a8a1f',
		reflect: '#7b5ea7',
		insurance: '#1f9e8f',
		gamble: '#c8911a',
		gift: '#2f8f4e',
		bounty: '#a8327d'
	};
	const NEUTRAL_ACCENT = '#1d6f8a';

	const activeChips = $derived.by(() => {
		const chips: { key: string; icon: string; label: string; until: number; accent: string }[] = [];
		for (const e of (pd.activeEffects ?? []) as any[]) {
			if (!e.expiresAt || e.expiresAt <= now) continue;
			const meta = EFFECT_ICON[e.effect_type];
			chips.push({
				key: `eff-${e.effect_type}-${e.expiresAt}`,
				icon: meta?.icon ?? 'fa-star',
				label: meta?.label ?? e.effect_type,
				until: e.expiresAt,
				accent: EFFECT_ACCENT[e.effect_type] ?? NEUTRAL_ACCENT
			});
		}
		if (pd.immuneUntil && pd.immuneUntil > now)
			chips.push({ key: 'immune', icon: 'fa-shield-halved', label: 'Immune', until: pd.immuneUntil, accent: '#1f9e8f' });
		for (const cd of (pd.attackCooldowns ?? []) as { action: 'steal' | 'bomb'; until: number }[]) {
			if (!cd.until || cd.until <= now) continue;
			chips.push({
				key: `cd-${cd.action}`,
				icon: cd.action === 'steal' ? 'fa-hand' : 'fa-bomb',
				label: cd.action === 'steal' ? 'Steal cooldown' : 'Bomb cooldown',
				until: cd.until,
				accent: EFFECT_ACCENT[cd.action]
			});
		}
		return chips.sort((a, b) => a.until - b.until);
	});

	function remainingLabel(untilMs: number): string {
		const s = Math.max(0, Math.floor((untilMs - now) / 1000));
		const m = Math.floor(s / 60);
		const h = Math.floor(m / 60);
		if (h > 0) return `${h}h ${m % 60}m`;
		if (m > 0) return `${m}m ${s % 60}s`;
		return `${s}s`;
	}

	const typeTabs = $derived.by(() => {
		const source = isBag ? (pd.bagCategories ?? []) : (pd.categories ?? []);
		const present = new Set(source as string[]);
		const ordered = ITEM_EFFECTS.filter((e) => present.has(e.id));
		return [{ id: 'all', label: 'All', icon: 'fa-grip' }, ...ordered.map((e) => ({ id: e.id, label: e.label, icon: e.icon }))];
	});

	let es: EventSource | null = null;
	onMount(() => {
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

	const SELF_BUFFS = new Set(['boost', 'shield', 'reflect', 'insurance']);
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
		get hash() {
			return pd.hash;
		},
		get serverSlug() {
			return data.server.slug;
		},
		remainingLabel
	});
</script>

<div class="m-items">
	<div class="m-xp">
		<div class="m-xp-glow"></div>
		{#if pd.memberCard}
			<button class="m-xp-card-btn" onclick={() => (showCard = true)} aria-label="View and share your card" title="My card">
				<i class="fas fa-id-card"></i>
			</button>
		{/if}
		<div class="m-xp-avatar">
			<img src={memberAvatar} alt={pd.memberName ?? ''} loading="lazy" />
		</div>
		<div class="m-xp-figures">
			<span class="m-xp-wallet"><i class="fas fa-wallet"></i>Wallet</span>
			{#if pd.memberName}<span class="m-xp-name">{pd.memberName}</span>{/if}
			<span class="m-xp-amount">{fmt(liveXp)}<span class="m-xp-unit">XP</span></span>
			<div class="m-xp-bar">
				<div class="m-xp-bar-fill" style="width: {levelInfo.pct}%"></div>
			</div>
			<span class="m-xp-bar-meta">
				<span>Lvl {level}</span>
				<span>{levelInfo.toNext > 0 ? `${fmt(levelInfo.toNext)} XP to Lvl ${level + 1}` : 'Max progress'}</span>
			</span>
		</div>
		<div class="m-xp-stats">
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
		</div>
	</div>

	{#if activeChips.length > 0}
		<div class="m-active">
			{#each activeChips as chip (chip.key)}
				<span class="m-active-chip" style="--chip-accent: {chip.accent}">
					<i class="fas {chip.icon}"></i>
					<span class="m-active-label">{chip.label}</span>
					<span class="m-active-time">{remainingLabel(chip.until)}</span>
				</span>
			{/each}
		</div>
	{/if}

	<div class="m-items-bar">
		<div class="m-items-toggle">
			<a class="m-items-seg" class:m-items-seg--active={isShop} href="{itemsBase}/shop/all/{pd.hash}" data-sveltekit-preload-data="hover"
				><i class="fas fa-store"></i>Shop</a
			>
			<a
				bind:this={bagTabEl}
				class="m-items-seg"
				class:m-items-seg--active={isBag}
				class:m-items-seg--pulse={bagPulse}
				href="{itemsBase}/bag/all/{pd.hash}"
				data-sveltekit-preload-data="hover"
			>
				<i class="fas fa-bag-shopping"></i>Bag<span class="m-items-count" class:m-items-count--bump={bagPulse}>{pd.bagStock ?? 0}</span>
			</a>
			<a class="m-items-seg" class:m-items-seg--active={isHistory} href="{itemsBase}/history/all/{pd.hash}" data-sveltekit-preload-data="hover">
				<i class="fas fa-clock-rotate-left"></i>History
			</a>
		</div>
	</div>

	{#if isShop}
		<div class="m-items-tabs">
			{#each typeTabs as cat}
				<a class="m-items-tab" class:m-items-tab--active={activeCat === cat.id} href="{itemsBase}/shop/{cat.id}/{pd.hash}" data-sveltekit-preload-data="hover">
					<i class="fas {cat.icon}"></i>{cat.label}
				</a>
			{/each}
		</div>
	{:else if isBag && typeTabs.length > 1}
		<div class="m-items-tabs">
			{#each typeTabs as cat}
				<a class="m-items-tab" class:m-items-tab--active={activeCat === cat.id} href="{itemsBase}/bag/{cat.id}/{pd.hash}" data-sveltekit-preload-data="hover">
					<i class="fas {cat.icon}"></i>{cat.label}
				</a>
			{/each}
		</div>
	{:else if isHistory}
		<div class="m-items-tabs">
			{#each historyTabs as cat}
				<a
					class="m-items-tab"
					class:m-items-tab--active={activeCat === cat.id}
					href="{itemsBase}/history/{cat.id}/{pd.hash}"
					data-sveltekit-preload-data="hover"
				>
					<i class="fas {cat.icon}"></i>{cat.label}
				</a>
			{/each}
		</div>
	{/if}

	{@render children()}
</div>

{#if showCard && pd.memberCard}
	<MemberCard
		member={{ ...pd.memberCard, level, experience: liveXp, rank }}
		serverName={data.server.name || data.server.slug}
		serverIcon={data.server.server_icon}
		onclose={() => (showCard = false)}
	/>
{/if}
