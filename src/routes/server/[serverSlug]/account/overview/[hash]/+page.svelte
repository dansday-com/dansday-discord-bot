<script lang="ts">
	import { getContext } from 'svelte';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { effectLabel, effectIcon, effectAccentHex } from '$lib/items.js';
	import {
		BarList,
		CHART_PALETTE,
		ColumnChart,
		DashGrid,
		DonutChart,
		EntityRow,
		FILL,
		MiniGrid,
		MiniStat,
		RingStat,
		SectionTitle,
		SegBar,
		SparkArea,
		StatCard,
		StatHero,
		TrendChip,
		buildArea,
		buildPie,
		compact,
		growOnMount,
		sharePct
	} from '$lib/frontend/components/dash';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ctx = getContext('items') as any;
	const { fmt } = ctx;

	const growth = growOnMount();
	const grow = $derived(growth.value);

	const p = $derived(data.profile);
	const d = $derived((data.dashboard ?? {}) as Record<string, number>);
	const ins = $derived(data.insights ?? { favorite_items: [], interactions: {}, effect_usage: [], asset_holdings: [] });

	const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}`;

	const xpSources = $derived((p.xpSources ?? []) as { key: string; label: string; icon: string; color: string; xp: number }[]);
	const xpSourceTotal = $derived(xpSources.reduce((s, x) => s + x.xp, 0));

	const xpSourceSegments = $derived(
		xpSources.map((s) => ({
			label: undefined,
			pct: xpSourceTotal > 0 ? (s.xp / xpSourceTotal) * 100 : 0,
			color: s.color
		}))
	);

	const xpSourceBars = $derived(
		xpSources.map((s) => ({
			label: s.label,
			icon: s.icon,
			color: s.color,
			pct: sharePct(
				s.xp,
				xpSources.map((x) => x.xp),
				3
			),
			value: fmt(s.xp)
		}))
	);

	const voiceSegments = $derived.by(() => {
		const rows = [
			{ label: 'Active', value: Math.max(0, p.voiceActive || 0), color: '#1f8a4c' },
			{ label: 'AFK', value: Math.max(0, p.voiceAfk || 0), color: '#b23b3b' },
			{ label: 'Video', value: Math.max(0, p.voiceVideo || 0), color: '#6d5bd0' },
			{ label: 'Stream', value: Math.max(0, p.voiceStreaming || 0), color: '#c8911a' }
		];
		const total = rows.reduce((s, r) => s + r.value, 0);
		if (total <= 0) return null;
		return { total, segments: rows.map((r) => ({ label: r.label, pct: (r.value / total) * 100, color: r.color })) };
	});

	const activityBars = $derived.by(() => {
		const rows = [
			{ label: 'Messages', value: Math.max(0, p.chatTotal || 0), icon: 'fa-comments', color: '#245f73' },
			{ label: 'Voice', value: Math.max(0, p.voiceActive || 0), icon: 'fa-microphone', color: '#1f8a4c' },
			{ label: 'Video', value: Math.max(0, p.voiceVideo || 0), icon: 'fa-video', color: '#6d5bd0' },
			{ label: 'Stream', value: Math.max(0, p.voiceStreaming || 0), icon: 'fa-desktop', color: '#c8911a' },
			{ label: 'AFK', value: Math.max(0, p.voiceAfk || 0), icon: 'fa-moon', color: '#b23b3b' }
		];
		return rows.map((r) => ({
			label: r.label,
			icon: r.icon,
			color: r.color,
			pct: sharePct(
				r.value,
				rows.map((x) => x.value),
				2
			),
			value: fmt(r.value)
		}));
	});

	const interactions = $derived((ins.interactions ?? {}) as Record<string, { out: any[]; in: any[] }>);
	const defense = $derived((ins.defense ?? {}) as Record<string, number>);
	const relationships = $derived((ins.relationships ?? {}) as Record<string, { name: string; hits: number; xp: number } | null>);

	const relationCards = $derived(
		[
			{ title: 'Nemesis', sub: 'attacks you most', icon: 'fa-skull-crossbones', accent: '#b23b3b', row: relationships.nemesis },
			{ title: 'Favorite target', sub: 'you attack most', icon: 'fa-crosshairs', accent: '#733e24', row: relationships.favorite_target },
			{ title: 'Best ally', sub: 'gifts exchanged', icon: 'fa-handshake', accent: '#1f8a4c', row: relationships.best_ally }
		].filter((r) => r.row && r.row.name)
	);

	const INTERACTION_LISTS = [
		{ key: 'steal', dir: 'out', group: 'offense', title: 'Robbed most', icon: 'fa-hand', fill: FILL.primary },
		{ key: 'bomb', dir: 'out', group: 'offense', title: 'Bombed most', icon: 'fa-bomb', fill: FILL.primary },
		{ key: 'leech', dir: 'out', group: 'offense', title: 'Leeched most', icon: 'fa-droplet', fill: FILL.primary },
		{ key: 'spy', dir: 'out', group: 'offense', title: 'Spied on most', icon: 'fa-magnifying-glass', fill: FILL.primary },
		{ key: 'gift', dir: 'out', group: 'offense', title: 'Gifted to most', icon: 'fa-gift', fill: FILL.success },
		{ key: 'bounty', dir: 'out', group: 'offense', title: 'Bounties placed on', icon: 'fa-crown', fill: FILL.primary },
		{ key: 'bounty_collected', dir: 'out', group: 'offense', title: 'Bounties collected on', icon: 'fa-sack-dollar', fill: FILL.success },
		{ key: 'my_spy_caught', dir: 'out', group: 'offense', title: 'Caught spying on them', icon: 'fa-user-secret', fill: FILL.error },
		{ key: 'my_blocked', dir: 'out', group: 'offense', title: 'They blocked you', icon: 'fa-shield-halved', fill: FILL.error },
		{ key: 'my_reflected', dir: 'out', group: 'offense', title: 'They reflected you', icon: 'fa-arrows-rotate', fill: FILL.error },
		{ key: 'steal', dir: 'in', group: 'defense', title: 'Robbed by', icon: 'fa-skull-crossbones', fill: FILL.error },
		{ key: 'bomb', dir: 'in', group: 'defense', title: 'Bombed by', icon: 'fa-burst', fill: FILL.error },
		{ key: 'leech', dir: 'in', group: 'defense', title: 'Leeched by', icon: 'fa-droplet', fill: FILL.error },
		{ key: 'gift', dir: 'in', group: 'defense', title: 'Gifted from', icon: 'fa-hand-holding-heart', fill: FILL.success },
		{ key: 'bounty', dir: 'in', group: 'defense', title: 'Bounties on you from', icon: 'fa-skull', fill: FILL.error },
		{ key: 'spy_caught', dir: 'out', group: 'defense', title: 'Caught spying on you', icon: 'fa-user-secret', fill: FILL.success },
		{ key: 'blocked', dir: 'out', group: 'defense', title: 'Blocked their attack', icon: 'fa-shield-halved', fill: FILL.success },
		{ key: 'reflected', dir: 'out', group: 'defense', title: 'Reflected back at', icon: 'fa-arrows-rotate', fill: FILL.success },
		{ key: 'bounty_paid_out', dir: 'out', group: 'defense', title: 'Bounty claimed on you by', icon: 'fa-sack-dollar', fill: FILL.error },
		{ key: 'leech_blocked', dir: 'out', group: 'defense', title: 'Leech bounced off you', icon: 'fa-droplet', fill: FILL.success }
	];

	const interactionLists = $derived(
		INTERACTION_LISTS.map((l) => {
			const raw = (interactions[l.key]?.[l.dir as 'out' | 'in'] ?? []) as any[];
			const weights = raw.map((r) => r.xp || r.hits);
			return {
				...l,
				rows: raw.map((t) => ({
					label: t.name,
					color: l.fill,
					pct: sharePct(t.xp || t.hits, weights),
					value: t.xp > 0 ? `${fmt(t.xp)} XP` : `${fmt(t.hits)}×`
				}))
			};
		})
	);

	const offenseLists = $derived(interactionLists.filter((l) => l.group === 'offense'));
	const defenseLists = $derived(interactionLists.filter((l) => l.group === 'defense'));
	const favorite = $derived((ins.favorite_items ?? [])[0] ?? null);

	const positions = $derived(
		(data.positions ?? []) as {
			symbol: string;
			name: string;
			image: string | null;
			change24h: number;
			invested: number;
			value: number;
			pnl: number;
			pnlPercent: number;
		}[]
	);

	const assetsPnl = $derived(Number(d.assets_pnl) || 0);
	const minigamesNet = $derived(Number(d.minigames_net) || 0);
	const minigamesWinRate = $derived((d.minigames_plays ?? 0) > 0 ? Math.round((Number(d.minigames_wins) / Number(d.minigames_plays)) * 100) : 0);

	const usagePie = $derived.by(() => {
		const rows = (ins.effect_usage ?? []) as { effect_type: string; uses: number }[];
		return buildPie(
			rows.map((r, i) => {
				const accent = effectAccentHex(r.effect_type);
				return {
					value: Number(r.uses) || 0,
					color: accent === '#245f73' && i > 0 ? CHART_PALETTE[i % CHART_PALETTE.length] : accent,
					label: effectLabel(r.effect_type),
					icon: effectIcon(r.effect_type)
				};
			})
		);
	});

	const usageColumns = $derived(
		usagePie.segments.map((seg) => ({
			label: seg.label,
			icon: seg.icon,
			color: seg.color,
			pct: seg.pct,
			value: fmt(seg.value)
		}))
	);

	const allocationPie = $derived.by(() => {
		const rows = (ins.asset_holdings ?? []) as { symbol: string; name: string; invested: number }[];
		return buildPie(
			rows.map((r, i) => ({
				value: Number(r.invested) || 0,
				color: CHART_PALETTE[i % CHART_PALETTE.length],
				label: r.symbol || r.name,
				icon: 'fa-coins'
			}))
		);
	});

	const hasPortfolio = $derived(allocationPie.total > 0 || positions.length > 0);
	const stealNet = $derived((Number(d.items_stolen) || 0) - (Number(d.items_stolen_from) || 0));

	const duelSegments = $derived.by(() => {
		const won = Number(d.items_stolen) || 0;
		const lost = Number(d.items_stolen_from) || 0;
		const weights = [won, lost];
		return [
			{ label: undefined, pct: sharePct(won, weights), color: FILL.success },
			{ label: undefined, pct: sharePct(lost, weights), color: FILL.error }
		];
	});

	const flowChart = $derived.by(() => {
		const flow = (ins.xp_flow ?? []) as { day: string; net: number }[];
		let cum = 0;
		return buildArea(
			flow.map((f) => (cum += f.net)),
			300,
			90
		);
	});

	const buddies = $derived((data.levelFriends ?? []) as { name: string; avatar: string | null; ticks: number; minutes: number; xp: number }[]);
	const buddyWeights = $derived(buddies.map((b) => b.ticks));
</script>

<svelte:head><title>{data.server.name || data.server.slug} Account | {APP_NAME} Discord Bot</title></svelte:head>

{#snippet listGroup(lists: typeof offenseLists)}
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		{#each lists as list}
			<div class="flex flex-col gap-2">
				<span class="text-base-content/70 inline-flex items-center gap-2 text-xs font-bold">
					<i class="fas {list.icon} text-[var(--tone)]"></i>{list.title}
				</span>
				<BarList rows={list.rows} layout="stacked" {grow} />
			</div>
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-4 sm:gap-5">
	<StatCard icon="fa-star" title="Total XP" tone="amber">
		<StatHero label="lifetime XP" value={fmt(p.totalXp)} countTo={p.totalXp} />
		{#if xpSourceBars.length > 0}
			<SegBar head="Where your XP came from" meta="{fmt(xpSourceTotal)} tracked" title="XP by source" segments={xpSourceSegments} {grow} />
			<BarList rows={xpSourceBars} {grow} />
		{/if}
	</StatCard>

	{#if flowChart}
		<StatCard icon="fa-chart-line" title="XP flow · last 14 days" tone="teal">
			<div class="flex items-baseline justify-between gap-3">
				<span class="text-base-content/60 text-xs font-semibold">Cumulative net XP</span>
				<TrendChip value={flowChart.last} text={signed(flowChart.last)} />
			</div>
			<SparkArea chart={flowChart} id="xp-flow-grad" ariaLabel="XP flow over time" />
		</StatCard>
	{/if}

	<StatCard icon="fa-microphone-alt" title="Activity" tone="lime">
		{#if voiceSegments}
			<SegBar head="Voice time split" meta="{fmt(voiceSegments.total)} min" title="Active · AFK · Video · Stream" segments={voiceSegments.segments} {grow} />
		{/if}
		<BarList rows={activityBars} {grow} />
	</StatCard>

	{#if buddies.length > 0}
		<StatCard icon="fa-people-group" title="Voice buddies" tone="sky" note="Members you level up with most in voice">
			<div class="flex flex-col gap-2">
				{#each buddies as b, i}
					<EntityRow rank={i + 1} image={b.avatar} icon="fa-user" round title={b.name} subtitle="{fmt(b.minutes)}m · {fmt(b.xp)} XP together">
						<div class="bg-base-content/10 mt-1.5 h-2 overflow-hidden rounded-full">
							<div
								class="h-full rounded-full transition-[width] duration-700 ease-out"
								style="width: {sharePct(b.ticks, buddyWeights) * grow}%; background: {FILL.primary};"
							></div>
						</div>
					</EntityRow>
				{/each}
			</div>
		</StatCard>
	{/if}

	{#if hasPortfolio}
		<StatCard icon="fa-briefcase" title="Portfolio" tone="emerald">
			{#if allocationPie.total > 0}
				<DonutChart segments={allocationPie.segments} total={compact(allocationPie.total)} totalLabel="invested" ariaLabel="Invested XP by asset" />
			{/if}
			{#if positions.length > 0}
				<div class="flex flex-col gap-2">
					{#each positions as pos}
						<EntityRow image={pos.image} icon="fa-coins" round title={pos.symbol} subtitle="{compact(pos.value)} · from {compact(pos.invested)}">
							{#snippet trailing()}
								<span class="flex flex-col items-end gap-0.5">
									<span class="text-xs font-bold tabular-nums {pos.pnl >= 0 ? 'text-success' : 'text-error'}">
										<i class="fas fa-caret-{pos.pnl >= 0 ? 'up' : 'down'}"></i>{pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
									</span>
									<span class="text-base-content/50 text-[11px] font-semibold tabular-nums">
										{pos.pnl >= 0 ? '+' : '−'}{compact(Math.abs(pos.pnl))}
									</span>
								</span>
							{/snippet}
						</EntityRow>
					{/each}
				</div>
			{/if}
		</StatCard>
	{/if}

	<DashGrid cols={3}>
		<StatCard icon="fa-chart-line" title="Market" tone="teal">
			<StatHero label="assets value · XP" value={fmt(d.assets_market_value)} countTo={d.assets_market_value}>
				{#snippet trailing()}
					<TrendChip value={assetsPnl} text={signed(assetsPnl)} label="open P/L" />
				{/snippet}
			</StatHero>
			<MiniGrid cols={2}>
				<MiniStat icon="fa-right-left" value={fmt(d.assets_trade_count)} label="Trades" />
				<MiniStat icon="fa-briefcase" value={fmt(d.assets_open_positions)} label="Open assets" />
			</MiniGrid>
		</StatCard>

		<StatCard icon="fa-dice" title="Minigames" tone="pink">
			<RingStat pct={minigamesWinRate} label="win rate" {grow} color={minigamesWinRate >= 50 ? 'var(--color-success)' : 'var(--color-warning)'}>
				{#snippet side()}
					<div>
						<span class="text-base-content block text-lg font-extrabold tabular-nums">{fmt(d.minigames_plays)}</span>
						<small class="text-base-content/50 text-[10px] font-semibold tracking-[0.06em] uppercase">plays</small>
					</div>
					<div>
						<span class="block text-lg font-extrabold tabular-nums {minigamesNet >= 0 ? 'text-success' : 'text-error'}">{signed(minigamesNet)}</span>
						<small class="text-base-content/50 text-[10px] font-semibold tracking-[0.06em] uppercase">net winnings</small>
					</div>
				{/snippet}
			</RingStat>
			<MiniGrid cols={2}>
				<MiniStat icon="fa-coins" value={fmt(d.minigames_wagered)} label="XP wagered" />
				<MiniStat icon="fa-trophy" value={fmt(d.minigames_biggest_win)} label="Biggest win" />
			</MiniGrid>
		</StatCard>

		<StatCard icon="fa-bag-shopping" title="Items" tone="orange">
			<StatHero label="items bought" value={fmt(d.items_buys)} countTo={d.items_buys} />
			<MiniGrid cols={2}>
				<MiniStat icon="fa-coins" value={fmt(d.items_buy_spend)} label="XP spent" />
				<MiniStat icon="fa-wand-magic-sparkles" value={fmt(d.items_activations)} label="Activations" />
			</MiniGrid>
		</StatCard>
	</DashGrid>

	<StatCard icon="fa-fire-flame-curved" title="Highlights" tone="rose">
		{#if relationCards.length > 0}
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each relationCards as r}
					<EntityRow
						icon={r.icon}
						accent={r.accent}
						eyebrow={r.title}
						title={r.row?.name ?? ''}
						subtitle="{r.sub} · {r.row && r.row.xp > 0 ? `${compact(r.row.xp)} XP` : `${fmt(r.row?.hits ?? 0)}×`}"
					/>
				{/each}
			</div>
		{/if}

		{#if favorite}
			<SectionTitle icon="fa-star" title="Favorite item" />
			<EntityRow
				icon={favorite.effect_type ? effectIcon(favorite.effect_type) : 'fa-cube'}
				accent={favorite.effect_type ? effectAccentHex(favorite.effect_type) : '#245f73'}
				title={favorite.name}
				subtitle="most used{favorite.effect_type ? ` · ${effectLabel(favorite.effect_type)}` : ''}"
			>
				{#snippet trailing()}
					<span class="text-base-content text-sm font-extrabold tabular-nums">{fmt(favorite.uses)}×</span>
				{/snippet}
			</EntityRow>
		{/if}

		{#if offenseLists.length > 0}
			<SectionTitle icon="fa-crosshairs" title="Offense · who you hit" tone="error" />
			{@render listGroup(offenseLists)}
		{/if}

		{#if defenseLists.length > 0}
			<SectionTitle icon="fa-shield-halved" title="Defense · done to you & blocked" tone="success" />
			{@render listGroup(defenseLists)}
		{/if}
	</StatCard>

	{#if usagePie.total > 0}
		<StatCard icon="fa-chart-pie" title="Item usage by type" tone="violet" note="How often you've used each item effect — attacks, buffs and utility combined.">
			<DonutChart
				segments={usagePie.segments}
				total={fmt(usagePie.total)}
				totalLabel="uses"
				ariaLabel="Item usage by type"
				showIcons
				valueFormat={(seg) => `${fmt(seg.value)}× · ${seg.pct.toFixed(0)}%`}
			/>
			<ColumnChart columns={usageColumns} {grow} />
		</StatCard>
	{/if}

	<DashGrid cols={2}>
		<StatCard icon="fa-crosshairs" title="Your PvP record" tone="rose">
			<div>
				<div class="text-base-content/60 mb-2 flex items-baseline justify-between gap-2 text-xs font-semibold">
					<span>You stole {fmt(d.items_stolen)}</span>
					<span class="font-bold tabular-nums {stealNet >= 0 ? 'text-success' : 'text-error'}">
						{stealNet >= 0 ? 'net +' : 'net −'}{fmt(Math.abs(stealNet))}
					</span>
					<span>{fmt(d.items_stolen_from)} lost</span>
				</div>
				<SegBar segments={duelSegments} {grow} spaced />
			</div>
			<MiniGrid cols={3}>
				<MiniStat icon="fa-hand" value={fmt(d.items_stolen)} label="XP stolen" />
				<MiniStat icon="fa-shield-halved" value={fmt(d.items_stolen_from)} label="Stolen from you" />
				<MiniStat icon="fa-bomb" value={fmt(d.items_bombed)} label="XP bombed" />
				<MiniStat icon="fa-burst" value={fmt(d.items_bombed_by)} label="Bombed you" />
				<MiniStat icon="fa-droplet" value={fmt(d.items_leeched)} label="XP leeched" />
				<MiniStat icon="fa-droplet" value={fmt(d.items_leeched_by)} label="Leeched off you" />
				<MiniStat icon="fa-gift" value={fmt(d.items_gifted)} label="Gifted out" />
				<MiniStat icon="fa-hand-holding-heart" value={fmt(d.items_gifts_received)} label="Received" />
				<MiniStat icon="fa-magnifying-glass" value={fmt(d.items_spies)} label="Spy reports" />
				<MiniStat icon="fa-crown" value={fmt(d.items_bounties_placed)} label="Bounties set" />
				<MiniStat icon="fa-skull" value={fmt(d.bounty_on_me)} label="Bounty on you" dir="down" />
				<MiniStat icon="fa-sack-dollar" value={fmt(d.items_bounty_collected)} label="Bounty collected" dir="up" />
				<MiniStat icon="fa-user-secret" value={fmt(defense.spies_caught)} label="Spies caught" dir="up" />
				<MiniStat icon="fa-shield-halved" value={fmt(defense.blocked)} label="Attacks blocked" dir="up" />
				<MiniStat icon="fa-arrows-rotate" value={fmt(defense.reflected)} label="Attacks reflected" dir="up" />
				<MiniStat icon="fa-handcuffs" value={fmt(defense.my_steals_caught)} label="Caught stealing" dir="down" />
				<MiniStat icon="fa-umbrella" value={fmt(defense.insurance_covers)} label="Insurance covers" dir="up" />
				<MiniStat icon="fa-hand-holding-dollar" value={fmt(defense.insurance_xp)} label="XP recovered" dir="up" />
			</MiniGrid>
		</StatCard>

		<StatCard icon="fa-fire" title="Your engagement" tone="cyan">
			<MiniGrid cols={3}>
				<MiniStat icon="fa-ticket" value={fmt(d.giveaways_entered)} label="Giveaways entered" />
				<MiniStat icon="fa-medal" value={fmt(d.giveaways_won)} label="Giveaways won" />
				<MiniStat icon="fa-gift" value={fmt(d.giveaways_hosted)} label="Hosted" />
				<MiniStat icon="fa-scroll" value={fmt(d.quests_claimed)} label="Quests" />
				<MiniStat icon="fa-tower-broadcast" value={fmt(d.streams_total)} label="Streams" />
				<MiniStat icon="fa-eye" value={fmt(d.streams_peak_viewers)} label="Peak viewers" />
				<MiniStat icon="fa-heart" value={fmt(d.streams_likes)} label="Likes" />
				<MiniStat icon="fa-comment-dots" value={fmt(d.feedback_submitted)} label="Feedback given" />
			</MiniGrid>
		</StatCard>
	</DashGrid>
</div>
