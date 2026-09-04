<script lang="ts">
	import { onDestroy, onMount, setContext } from 'svelte';
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import MemberCard from '$lib/frontend/components/MemberCard.svelte';
	import FeatureDisabled from '$lib/frontend/components/FeatureDisabled.svelte';
	import { NavTabs, type NavTab } from '$lib/frontend/components/shell';
	import { publicServerPath } from '$lib/url.js';
	import { ITEM_EFFECTS, effectLabel, effectIcon, effectAccentHex, actionVerb, BAG_CAPACITY, formatDuration } from '$lib/items.js';
	import type { PublicMembersStreamPayload } from '$lib/frontend/public/members/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const pd = $derived(page.data as any);

	const accountBase = $derived(`${publicServerPath(data.server.slug)}/account`);
	const readOnly = false;
	const navHash = $derived(pd.hash || '');
	const pathNorm = $derived(page.url.pathname.replace(/\/$/, ''));
	const isOverview = $derived(/\/account\/overview\//.test(pathNorm));
	const isHistory = $derived(/\/account\/history\//.test(pathNorm));
	const isGuide = $derived(/\/account\/guide\//.test(pathNorm));
	const isAssets = $derived(/\/account\/assets\//.test(pathNorm));
	const isMinigames = $derived(/\/account\/minigames\//.test(pathNorm));
	const isTask = $derived(/\/account\/task\//.test(pathNorm));
	const isItems = $derived(!isOverview && !isHistory && !isGuide && !isAssets && !isMinigames && !isTask);
	const activeCat = $derived.by(() => {
		const m = pathNorm.match(/\/account\/(?:items|assets|minigames)\/([^/]+)\/[^/]+$/);
		return m ? m[1] : 'all';
	});
	const historyCat = $derived.by(() => {
		const m = pathNorm.match(/\/account\/history\/([^/]+)\/[^/]+$/);
		return m ? m[1] : 'all';
	});

	const tasksEnabled = $derived(data.tasksEnabled === true);
	const itemsEnabled = $derived(data.itemsEnabled === true);
	const assetsEnabled = $derived(data.assetsEnabled === true);
	const minigamesEnabled = $derived(data.minigamesEnabled === true);

	const disabledFeature = $derived.by(() => {
		if (isTask && !tasksEnabled)
			return { title: 'Tasks are turned off', message: 'This server has not enabled daily and weekly tasks.', icon: 'fa-list-check' };
		if (isItems && !itemsEnabled) return { title: 'Items are turned off', message: 'This server has not enabled the item shop and bag.', icon: 'fa-store' };
		if (isMinigames && !minigamesEnabled) return { title: 'Minigames are turned off', message: 'This server has not enabled minigames.', icon: 'fa-dice' };
		if (isAssets && !assetsEnabled) return { title: 'Assets are turned off', message: 'This server has not enabled the assets market.', icon: 'fa-chart-line' };
		return null;
	});

	const historyTabs = $derived([
		{ id: 'all', label: 'All', icon: 'fa-grip' },
		...(data.itemsEnabled === true ? [{ id: 'items', label: 'Items', icon: 'fa-bag-shopping' }] : []),
		...(data.minigamesEnabled === true ? [{ id: 'minigames', label: 'Minigames', icon: 'fa-dice' }] : []),
		...(data.assetsEnabled === true ? [{ id: 'assets', label: 'Assets', icon: 'fa-chart-line' }] : []),
		{ id: 'level', label: 'Level', icon: 'fa-star' }
	]);

	const assetTabs = $derived([
		{ id: 'top', label: 'Top 50', icon: 'fa-ranking-star' },
		{ id: 'gainers', label: 'Gainers', icon: 'fa-arrow-trend-up' },
		{ id: 'losers', label: 'Losers', icon: 'fa-arrow-trend-down' },
		{ id: 'search', label: 'Search', icon: 'fa-magnifying-glass' },
		{ id: 'mine', label: 'My Assets', icon: 'fa-wallet' }
	]);

	const minigameTabs = [
		{ id: 'all', label: 'All', icon: 'fa-grip' },
		{ id: 'gamble', label: 'Gamble', icon: 'fa-dice' }
	];

	let assetSummaryLive = $state<{ invested: number; value: number; pnl: number; pnlPct: number; count: number } | null>(null);
	function setAssetSummary(s: any) {
		assetSummaryLive = s;
	}

	let taskSummaryLive = $state<any>(null);
	function setTaskSummary(s: any) {
		taskSummaryLive = s;
	}
	const taskSummary = $derived(taskSummaryLive ?? pd.tasks?.streak ?? null);
	const streakPct = $derived.by(() => {
		const cur = Number(taskSummary?.current) || 0;
		const next = Number(taskSummary?.nextMilestone?.at) || 7;
		const prevMarks = [0, 7, 30, 100, 365].filter((m) => m < next);
		const prev = prevMarks.length ? prevMarks[prevMarks.length - 1] : 0;
		return Math.max(0, Math.min(100, ((cur - prev) / Math.max(1, next - prev)) * 100));
	});
	const assetSummary = $derived.by(() => {
		if (assetSummaryLive) return assetSummaryLive;
		const invested = Number(pd.totalInvested) || 0;
		const value = Number(pd.totalValue) || 0;
		const pnl = value - invested;
		return { invested, value, pnl, pnlPct: invested > 0 ? (pnl / invested) * 100 : 0, count: (pd.positions ?? []).length };
	});

	let now = $state(Date.now());
	let busy = $state<number | null>(null);

	let liveXp = $state(pd.balance?.xp ?? 0);
	let level = $state(pd.balance?.level ?? 1);
	let rank = $state(pd.balance?.rank ?? null);

	$effect(() => {
		liveXp = pd.balance?.xp ?? 0;
		level = pd.balance?.level ?? 1;
		rank = pd.balance?.rank ?? null;
	});

	function fmt(n: number): string {
		return Number(n ?? 0).toLocaleString();
	}

	const memberAvatar = $derived(pd.memberAvatar ?? `https://cdn.discordapp.com/embed/avatars/${Number(pd.memberDiscordId) % 5 || 0}.png`);

	const joinedDate = $derived.by(() => {
		const joined = pd.profile?.joined;
		if (!joined) return null;
		const d = new Date(String(joined).replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return null;
		return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
	});

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

	const sectionTabs: NavTab[] = $derived([
		{ label: 'Overview', icon: 'fa-gauge-high', href: `${accountBase}/overview/${navHash}`, active: isOverview },
		{ label: 'Task', icon: 'fa-list-check', href: `${accountBase}/task/${navHash}`, active: isTask },
		{
			id: 'items',
			label: 'Items',
			icon: 'fa-store',
			href: `${accountBase}/items/all/${navHash}`,
			active: isItems,
			badge: itemsEnabled ? `${pd.bagStock ?? 0}/${BAG_CAPACITY}` : undefined,
			badgeBump: bagPulse
		},
		{ label: 'Minigames', icon: 'fa-dice', href: `${accountBase}/minigames/all/${navHash}`, active: isMinigames },
		{ label: 'Assets', icon: 'fa-chart-line', href: `${accountBase}/assets/top/${navHash}`, active: isAssets },
		{ label: 'History', icon: 'fa-clock-rotate-left', href: `${accountBase}/history/all/${navHash}`, active: isHistory },
		{ label: 'Guide', icon: 'fa-circle-question', href: `${accountBase}/guide/${navHash}`, active: isGuide }
	]);

	const catTabs: NavTab[] | null = $derived.by(() => {
		const build = (kind: string, tabs: { id: string; label: string; icon: string }[], activeId: string) =>
			tabs.map((t) => ({ label: t.label, icon: t.icon, href: `${accountBase}/${kind}/${t.id}/${navHash}`, active: activeId === t.id }));
		if (isHistory) return build('history', historyTabs, historyCat);
		if (isItems) return build('items', typeTabs, activeCat);
		if (isAssets) return build('assets', assetTabs, activeCat);
		if (isMinigames) return build('minigames', minigameTabs, activeCat);
		return null;
	});

	const sessionKey = $derived(`items_card_${data.server.slug}`);

	function syncTabSession() {
		if (typeof sessionStorage === 'undefined') return;
		const urlHash = pd.hash ? String(pd.hash) : '';
		if (urlHash) sessionStorage.setItem(sessionKey, urlHash);
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
						if (me.xp != null) liveXp = Number(me.xp) || 0;
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

	let bagPulse = $state(false);
	let burstId = $state<number | null>(null);

	function flyToBag(fromEl: HTMLElement | null, iconClass: string) {
		if (!fromEl || typeof document === 'undefined') return;
		const bagTab = document.querySelector('[data-tab-id="items"]');
		if (!bagTab) return;
		const start = fromEl.getBoundingClientRect();
		const end = bagTab.getBoundingClientRect();
		const clone = document.createElement('div');
		clone.className = 'fixed z-9999 text-[26px] leading-none text-[#d9a528] pointer-events-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]';
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

	const SELF_BUFFS = new Set(['boost', 'shield', 'reflect', 'insurance', 'disguise', 'luck']);
	function isBuffActive(effectType: string): boolean {
		if (!SELF_BUFFS.has(effectType)) return false;
		return ((pd.activeEffects ?? []) as any[]).some((e) => e.effect_type === effectType && e.expiresAt && e.expiresAt > now);
	}
	function activeLuckPercent(): number {
		const luck = ((pd.activeEffects ?? []) as any[]).find((e) => e.effect_type === 'luck' && e.expiresAt && e.expiresAt > now);
		return luck ? Number(luck.effect_value) || 0 : 0;
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
		setTaskSummary,
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
		get luckPercent() {
			return activeLuckPercent();
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

<svelte:head>
	<meta name="robots" content="noindex, nofollow, noarchive" />
	<meta name="googlebot" content="noindex, nofollow, noarchive" />
</svelte:head>

<div class="mt-4.5">
	{#snippet walletHero()}
		<div
			class="relative isolate mb-4 flex h-35 items-center gap-3.5 overflow-hidden rounded-2xl bg-linear-to-br from-[#e43d12] to-[#7a1e06] px-4.5 py-3.5 shadow-[0_10px_26px_-16px_rgba(228,61,18,0.8)]"
		>
			<div
				class="pointer-events-none absolute -top-[60%] -right-[10%] size-55 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)]"
			></div>

			{#if pd.memberCard && !(isAssets && assetSummary.count === 0)}
				<button
					class="absolute top-2.5 right-3 z-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/30 bg-white/15 px-2.75 text-[13px] font-bold text-white transition-colors hover:bg-white/25"
					onclick={() => (showCard = true)}
					aria-label="Share your card"
					title="Share card"
				>
					<i class="fas fa-share-nodes"></i>
					<span class="hidden sm:inline">Share</span>
				</button>
			{/if}

			<div class="relative size-11.5 shrink-0 rounded-full bg-linear-to-br from-white/90 to-white/35 p-0.5 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)]">
				<img class="size-full rounded-full object-cover" src={memberAvatar} alt={pd.memberName ?? ''} loading="lazy" />
			</div>

			<div class="relative min-w-0 flex-1">
				<span class="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.08em] text-white/60 uppercase">
					<i class="fas {isOverview ? 'fa-user' : isAssets ? 'fa-chart-line' : isTask ? 'fa-fire' : 'fa-wallet'}"></i>{isOverview
						? 'Profile'
						: isAssets
							? 'Assets Value'
							: isTask
								? 'Daily streak'
								: 'Wallet'}
				</span>

				{#if pd.memberName}<span class="mt-px block truncate text-[15px] font-extrabold tracking-tight text-white">{pd.memberName}</span>{/if}

				{#if isTask}
					<span class="mt-0.5 flex items-baseline gap-1.5 text-2xl leading-tight font-extrabold tracking-tight text-white tabular-nums">
						{taskSummary?.current ?? 0}<span class="text-[13px] font-bold tracking-[0.04em] text-white/70"
							>{(taskSummary?.current ?? 0) === 1 ? 'DAY' : 'DAYS'}</span
						>
					</span>
				{:else if !isOverview}
					<span class="mt-0.5 flex items-baseline gap-1.5 text-2xl leading-tight font-extrabold tracking-tight text-white tabular-nums">
						{fmt(isAssets ? assetSummary.value : liveXp)}<span class="text-[13px] font-bold tracking-[0.04em] text-white/70">XP</span>
					</span>
				{/if}

				{#if !isAssets && !isOverview}
					<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
						<div
							class="h-full rounded-full bg-linear-to-r from-[#5eead4] to-[#fbbf24] shadow-[0_0_10px_-1px_rgba(94,234,212,0.6)] transition-[width] duration-500"
							style="width: {isTask ? streakPct : levelInfo.pct}%"
						></div>
					</div>
				{/if}

				<span class="mt-1.5 flex flex-nowrap items-baseline justify-between gap-2 text-[10.5px] font-semibold text-white/65">
					{#if isOverview}
						<span>Joined {joinedDate ?? '—'}</span>
						{#if pd.profile?.isBooster || pd.profile?.isAfk}
							<span>{pd.profile?.isBooster ? 'Booster' : ''}{pd.profile?.isBooster && pd.profile?.isAfk ? ' · ' : ''}{pd.profile?.isAfk ? 'AFK' : ''}</span>
						{/if}
					{:else if isAssets}
						<span>{assetSummary.count} asset{assetSummary.count === 1 ? '' : 's'}</span>
						<span>Invested {fmt(assetSummary.invested)} XP</span>
					{:else if isTask}
						<span>{taskSummary?.toNextMilestone ?? 0} to {taskSummary?.nextMilestone?.emoji ?? '🔥'} {taskSummary?.nextMilestone?.label ?? 'One week'}</span>
						<span>Best {taskSummary?.longest ?? 0} days</span>
					{:else}
						<span>Lvl {level}</span>
						<span>{levelInfo.toNext > 0 ? `${fmt(levelInfo.toNext)} XP to Lvl ${level + 1}` : 'Max progress'}</span>
					{/if}
				</span>

				{#if isOverview && pd.profile?.roles?.[0]}
					<div class="mt-2 flex flex-wrap gap-1.5">
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-2.25 py-[3px] text-[10.5px] font-semibold text-white"
						>
							<i class="fas fa-circle text-[6px]" style={pd.profile.roles[0].color ? `color: ${pd.profile.roles[0].color};` : undefined}></i>
							<span>{pd.profile.roles[0].name || 'Role'}</span>
						</span>
					</div>
				{/if}
			</div>

			<div class="relative flex shrink-0 items-center gap-4.5 border-l border-white/15 pt-4.5 pl-4.5">
				{#if isAssets}
					<div class="flex flex-col items-center leading-tight">
						<span class="text-lg font-extrabold text-white tabular-nums">
							<i class="fas fa-caret-{assetSummary.pnl >= 0 ? 'up' : 'down'}"></i>{assetSummary.pnlPct >= 0 ? '+' : ''}{assetSummary.pnlPct.toFixed(2)}%
						</span>
						<span class="mt-0.5 text-[10px] font-bold tracking-[0.06em] text-white/60 uppercase">
							{assetSummary.pnl >= 0 ? '+' : ''}{fmt(assetSummary.pnl)} XP
						</span>
					</div>
				{:else if isTask}
					<div class="flex flex-col items-center leading-tight">
						<span class="text-lg font-extrabold text-white tabular-nums">{taskSummary?.freezes ?? 0}/{taskSummary?.freezeMax ?? 2}</span>
						<span class="mt-0.5 text-[10px] font-bold tracking-[0.06em] text-white/60 uppercase">Freezes</span>
					</div>
					{#if rank}
						<div class="flex flex-col items-center leading-tight">
							<span class="text-lg font-extrabold text-white tabular-nums">#{rank}</span>
							<span class="mt-0.5 text-[10px] font-bold tracking-[0.06em] text-white/60 uppercase">Rank</span>
						</div>
					{/if}
				{:else}
					<div class="flex flex-col items-center leading-tight">
						<span class="text-lg font-extrabold text-white tabular-nums">{levelInfo.pct}%</span>
						<span class="mt-0.5 text-[10px] font-bold tracking-[0.06em] text-white/60 uppercase">Level {level}</span>
					</div>
					{#if rank}
						<div class="flex flex-col items-center leading-tight">
							<span class="text-lg font-extrabold text-white tabular-nums">#{rank}</span>
							<span class="mt-0.5 text-[10px] font-bold tracking-[0.06em] text-white/60 uppercase">Rank</span>
						</div>
					{/if}
				{/if}
			</div>
		</div>

		{#if activeChips.length > 0}
			<div class="-mt-1.5 mb-4 flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{#each activeChips as chip (chip.key)}
					<span
						class="inline-flex shrink-0 items-center gap-[7px] rounded-full border px-2.75 py-1.5 text-xs font-bold whitespace-nowrap text-(--chip)"
						style="--chip: {chip.accent}; background: color-mix(in srgb, var(--chip) 11%, transparent); border-color: color-mix(in srgb, var(--chip) 30%, transparent);"
					>
						<i class="fas {chip.icon}"></i>
						<span class="text-base-content">{chip.label}</span>
						<span class="tabular-nums opacity-85">{chip.text ?? remainingLabel(chip.until)}</span>
					</span>
				{/each}
			</div>
		{/if}
	{/snippet}

	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<NavTabs variant="segment" tabs={sectionTabs} />
	</div>

	{#if isOverview || isItems || isMinigames || isAssets || isHistory || isTask}
		{@render walletHero()}
	{/if}

	{#if disabledFeature}
		{''}
	{:else if catTabs}
		<div class="mb-4">
			<NavTabs tabs={catTabs} arrows />
		</div>
	{/if}

	{#if disabledFeature}
		<FeatureDisabled title={disabledFeature.title} message={disabledFeature.message} icon={disabledFeature.icon} />
	{:else}
		{@render children()}
	{/if}
</div>

{#if showCard && pd.memberCard}
	<MemberCard
		member={{ ...pd.memberCard, level, xp: liveXp, rank }}
		mode={isAssets ? 'assets' : 'level'}
		assets={{ invested: assetSummary.invested, value: assetSummary.value, pnl: assetSummary.pnl, pnlPct: assetSummary.pnlPct, count: assetSummary.count }}
		serverName={data.server.name || data.server.slug}
		serverIcon={data.server.server_icon}
		onclose={() => (showCard = false)}
	/>
{/if}
