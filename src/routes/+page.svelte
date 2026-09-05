<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath, COMMUNITY_DISCORD_URL, OFFICIAL_BOT_INVITE_URL, SOURCE_REPO_URL } from '$lib/url.js';
	import type { AggregatedPanelStats } from '$lib/frontend/public/statistics/aggregate.js';
	import { PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';
	import GlobeScene from '$lib/frontend/components/landing/GlobeScene.svelte';
	import { effectIcon, effectLabel, effectAccentHex } from '$lib/items.js';
	import { createLiveGlobalStatistics } from '$lib/frontend/public/statistics/liveGlobal.svelte.js';

	type Totals = AggregatedPanelStats;
	type Live = { label: string; value: string; live?: boolean };
	type Feature = { icon: string; title: string; desc: string; more: string; stat?: (s: Totals) => Live[] };

	let { data }: PageProps = $props();

	const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const fmt = (n: number) => compact.format(Math.max(0, Math.round(n || 0)));

	const feed = createLiveGlobalStatistics(data.totals);
	$effect(() => feed.connect());

	const hasLive = $derived((feed.totals?.servers_counted ?? 0) > 0);

	let broken = $state<Record<string, boolean>>({});
	let heroText = $state<HTMLElement | null>(null);
	let heroFoot = $state<HTMLElement | null>(null);

	const initials = (n: string) =>
		n
			.replace(/[^a-zA-Z0-9 ]/g, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase() || '?';

	let scrolled = $state(false);
	$effect(() => {
		const onScroll = () => (scrolled = window.scrollY > 40);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function countUp(node: HTMLElement, target: number) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const final = node.textContent ?? '';
		let raf = 0;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				const started = performance.now();
				const tick = (now: number) => {
					const t = Math.min(1, (now - started) / 900);
					node.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));
					if (t < 1) raf = requestAnimationFrame(tick);
					else node.textContent = final;
				};
				raf = requestAnimationFrame(tick);
			},
			{ threshold: 0.4 }
		);
		io.observe(node);
		return {
			destroy: () => {
				io.disconnect();
				cancelAnimationFrame(raf);
			}
		};
	}

	const heroStats = $derived([
		{ label: 'Servers', raw: feed.totals.servers_counted },
		{ label: 'Members', raw: feed.totals.members_total },
		{ label: 'XP tracked', raw: feed.totals.leveling_total_xp },
		{ label: 'Voice hours', raw: feed.totals.leveling_total_voice_minutes / 60 }
	]);

	const ICON_TONES = ['text-primary', 'text-secondary', 'text-brand-gold-deep'];

	const features: Feature[] = [
		{
			icon: 'fa-terminal',
			title: 'One-command setup',
			desc: '/setup creates every channel and wires it to the module that uses it.',
			more: 'Nothing to name or pick by hand.',
			stat: (s: Totals): Live[] => [{ label: 'Channels wired', value: fmt(s.channels_total) }]
		},
		{
			icon: 'fa-sliders',
			title: 'Web panel',
			desc: 'Every module configured in the browser, with live bot and server state where it applies.',
			more: 'No slash command trees to memorise.',
			stat: (s: Totals): Live[] => [{ label: 'Servers configured', value: fmt(s.servers_counted) }]
		},
		{
			icon: 'fa-toggle-on',
			title: 'Per-module toggles',
			desc: 'Every feature has its own switch, per server.',
			more: 'Turn a module off and it disappears everywhere, including from the AI.'
		},
		{
			icon: 'fa-shield-halved',
			title: 'Panel permissions',
			desc: 'Owner and staff tiers control who can change what.',
			more: 'Helpers contribute without full control of the server.',
			stat: (s: Totals): Live[] => [{ label: 'Roles mapped', value: fmt(s.roles_total) }]
		},
		{
			icon: 'fa-id-card',
			title: 'Server accounts',
			desc: 'Invite owners and staff into the panel with roles that fit your team.',
			more: 'Separate from who can chat or moderate in Discord.'
		},
		{
			icon: 'fa-robot',
			title: 'Multiple bots',
			desc: 'Run as many bots as you like from one panel, each with its own token and servers.',
			more: 'Start, stop and restart any of them from the browser.'
		},
		{
			icon: 'fa-circle-dot',
			title: 'Bot presence',
			desc: "Set each bot's status and activity from the panel.",
			more: 'Applies live, no restart.'
		},
		{
			icon: 'fa-hand-wave',
			title: 'Join greeting',
			desc: 'The bot introduces itself when it joins, with your docs and support links.',
			more: 'Only the first of your bots greets a shared server. Resend it any time.'
		},
		{
			icon: 'fa-chart-line',
			title: 'Leveling & XP',
			desc: 'Messages, voice, video and streaming time all earn XP.',
			more: 'Drives levels, role rewards and leaderboards. Reactions are tracked for tasks.',
			stat: (s: Totals): Live[] => [
				{ label: 'XP earned', value: fmt(s.leveling_total_xp) },
				{ label: 'Top level', value: fmt(s.leveling_max_level) },
				{ label: 'Voice hours', value: fmt(s.leveling_total_voice_minutes / 60) }
			]
		},
		{
			icon: 'fa-trophy',
			title: 'Role rewards',
			desc: 'Hand out roles automatically as members hit the levels you set.',
			more: 'No manual role assignment.'
		},
		{
			icon: 'fa-store',
			title: 'Items & XP economy',
			desc: 'A per-server shop priced in XP, a 50-slot bag and optional timed availability.',
			more: 'Thirteen effects: steal, bomb, leech, bounty, shield, reflect, insurance, boost, gift, spy, disguise, purifier and luck.',
			stat: (s: Totals): Live[] => [
				{ label: 'Activations', value: fmt(s.items_activations) },
				{ label: 'XP stolen', value: fmt(s.items_stolen) },
				{ label: 'Biggest steal', value: fmt(s.items_biggest_steal) }
			]
		},
		{
			icon: 'fa-clover',
			title: 'Luck',
			desc: 'Raises steal and bomb rolls, minigame odds, spy success, leech skim and insurance refunds.',
			more: 'Cuts gift tax and discounts prices. Timed buffs lock luck in on activation, so use luck first.'
		},
		{
			icon: 'fa-user-secret',
			title: 'Spy & disguise',
			desc: 'Scout a target before you attack, or hide your own name from every public list.',
			more: 'A lucky spy can still unmask a disguise.',
			stat: (s: Totals): Live[] => [{ label: 'Spies', value: fmt(s.items_spies) }]
		},
		{
			icon: 'fa-crosshairs',
			title: 'Bounties',
			desc: "Put XP on a member's head and let the server come collect.",
			more: 'Land the hit yourself before someone else cashes in.',
			stat: (s: Totals): Live[] => [
				{ label: 'Placed', value: fmt(s.bounties_placed) },
				{ label: 'Collected', value: fmt(s.bounties_collected) },
				{ label: 'XP pooled', value: fmt(s.bounties_pooled) }
			]
		},
		{
			icon: 'fa-coins',
			title: 'Assets market',
			desc: 'Lock XP into positions priced from live market data and sell any time.',
			more: 'Thousands of coins, top 50, gainers and losers, live portfolio. No real money.',
			stat: (s: Totals): Live[] => [
				{ label: 'Open positions', value: fmt(s.assets_open_positions), live: true },
				{ label: 'Traders', value: fmt(s.assets_traders) },
				{ label: 'Trades', value: fmt(s.assets_trade_count) }
			]
		},
		{
			icon: 'fa-dice',
			title: 'Minigames',
			desc: 'Gamble picks a multiplier up to 10x, and the win chance is 100 divided by it.',
			more: 'Only XP above your current level can be wagered, so a loss never costs a level.',
			stat: (s: Totals): Live[] => [
				{ label: 'Plays', value: fmt(s.minigames_plays) },
				{ label: 'Wins', value: fmt(s.minigames_wins) },
				{ label: 'Biggest win', value: fmt(s.minigames_biggest_win) }
			]
		},
		{
			icon: 'fa-list-check',
			title: 'Daily & weekly tasks',
			desc: 'Eighteen daily and eighteen weekly, generated per member from a 96-goal catalog.',
			more: "Sized from that member's own last seven days, so no two lists match. No admin setup."
		},
		{
			icon: 'fa-fire',
			title: 'Streaks',
			desc: 'Clear all eighteen daily for two percent more reward XP a day, up to double.',
			more: 'Milestones at 7, 30, 100 and 365. Two freezes cover missed days.'
		},
		{
			icon: 'fa-calendar-check',
			title: 'Daily check-in',
			desc: 'A seven-day cycle, one claim per local day, up to 50,000 XP.',
			more: 'Fifty percent chance of a shop item instead, rolled by rarity tier.'
		},
		{
			icon: 'fa-boxes-stacked',
			title: 'Global item catalog',
			desc: 'Build items once and push them to every server you run.',
			more: 'Per-server pricing and availability on top.'
		},
		{
			icon: 'fa-chart-pie',
			title: 'Public statistics',
			desc: 'Live server totals across every module, at a public URL.',
			more: 'No login. Search engines can index it.',
			stat: (s: Totals): Live[] => [
				{ label: 'Live pages', value: fmt(s.servers_counted), live: true },
				{ label: 'Members listed', value: fmt(s.members_total) },
				{ label: 'Channels', value: fmt(s.channels_total) }
			]
		},
		{
			icon: 'fa-ranking-star',
			title: 'Leaderboard',
			desc: 'All time, month or week, on any metric.',
			more: 'XP, chat, voice, video, streaming, items, minigames.'
		},
		{
			icon: 'fa-users',
			title: 'Members directory',
			desc: 'A searchable directory with levels, roles and activity.',
			more: 'Disguised members stay off it.',
			stat: (s: Totals): Live[] => [
				{ label: 'Tracked members', value: fmt(s.members_with_levels) },
				{ label: 'Messages', value: fmt(s.leveling_total_chat) }
			]
		},
		{
			icon: 'fa-user',
			title: 'Member accounts',
			desc: 'Members sign in to their own page for XP sources, history and portfolio.',
			more: 'Reached by a per-member link.'
		},
		{
			icon: 'fa-id-badge',
			title: 'Shareable member card',
			desc: 'Members render their own card and download it as an image.',
			more: 'Straight to Instagram, X, Facebook or Discord.'
		},
		{
			icon: 'fa-palette',
			title: 'Embed builder',
			desc: 'Rich embeds with live preview, placeholders and images.',
			more: 'Send them to channels from the browser instead of spamming slash commands.'
		},
		{
			icon: 'fa-tower-broadcast',
			title: 'Global embed',
			desc: 'Write one embed and send it to every server at once.',
			more: 'For announcements and downtime notices.'
		},
		{
			icon: 'fa-hand',
			title: 'Welcomer',
			desc: 'Greet new members with your own message and a rich embed.',
			more: 'Placeholders for the member, the server, the member count and account age.'
		},
		{
			icon: 'fa-gift',
			title: 'Giveaways',
			desc: 'Entry tracking, winner selection and role-based eligibility.',
			more: 'Requirements are checked for you when you draw.',
			stat: (s: Totals): Live[] => [
				{ label: 'Running now', value: fmt(s.giveaways_active), live: true },
				{ label: 'Entrants', value: fmt(s.giveaways_entrants) },
				{ label: 'Winners drawn', value: fmt(s.giveaways_winners) }
			]
		},
		{
			icon: 'fa-gavel',
			title: 'Moderation',
			desc: 'Warnings, mutes, bans and staff actions, all from the panel.',
			more: 'Every action stays recorded against the member.'
		},
		{
			icon: 'fa-clipboard-check',
			title: 'Staff rating',
			desc: 'Structured staff evaluation tied to moderation.',
			more: 'Ratings and reviews stay with the staff member.',
			stat: (s: Totals): Live[] => [
				{ label: 'Reviews', value: fmt(s.staff_reviews) },
				{ label: 'Average', value: s.staff_avg_rating > 0 ? s.staff_avg_rating.toFixed(1) : '—' }
			]
		},
		{
			icon: 'fa-moon',
			title: 'AFK',
			desc: 'Members set an AFK status with their own message.',
			more: 'The bot warns anyone who mentions them.',
			stat: (s: Totals): Live[] => [{ label: 'Away now', value: fmt(s.afk_active), live: true }]
		},
		{
			icon: 'fa-gem',
			title: 'Boost messages',
			desc: 'Thank Nitro boosters in a channel you choose.',
			more: 'Placeholders for the member, the boost tier and the boost count.',
			stat: (s: Totals): Live[] => [{ label: 'Boosters', value: fmt(s.members_unique_boosters) }]
		},
		{
			icon: 'fa-star',
			title: 'Custom supporter roles',
			desc: 'Supporters create and personalise their own role.',
			more: 'They pick the name and colour, inside the rules you set.',
			stat: (s: Totals): Live[] => [{ label: 'Custom roles', value: fmt(s.members_with_custom_roles) }]
		},
		{
			icon: 'fa-comment-dots',
			title: 'Feedback',
			desc: 'Collect suggestions and feature requests through Discord flows.',
			more: 'Everything lands in one place instead of scattered threads.',
			stat: (s: Totals): Live[] => [{ label: 'Submissions', value: fmt(s.feedback_submissions) }]
		},
		{
			icon: 'fa-bell',
			title: 'Channel notifications',
			desc: 'Alerts for the channel activity that actually matters.',
			more: 'Pick the events and the channel they post to.'
		},
		{
			icon: 'fa-forward',
			title: 'Message forwarder',
			desc: 'Mirror or sync messages across channels and servers.',
			more: 'Keeps announcements aligned across communities.'
		},
		{
			icon: 'fa-language',
			title: 'Multi-language',
			desc: 'English, Indonesian, German and Spanish across Discord flows.',
			more: 'Buttons, selects and labels all follow the choice.'
		},
		{
			icon: 'fa-scroll',
			title: 'Discord Quest notifier',
			desc: 'Quest activity brought into your server as it appears, with banner and thumbnail.',
			more: 'Enough context to know what to run next.',
			stat: (s: Totals): Live[] => [
				{ label: 'Live quests', value: fmt(s.quests_active), live: true },
				{ label: 'Posted', value: fmt(s.quests_posted) },
				{ label: 'Claimed', value: fmt(s.quests_claimed) },
				{ label: 'Participants', value: fmt(s.quests_participants) }
			]
		},
		{
			icon: 'fa-wand-magic-sparkles',
			title: 'Quest enroll',
			desc: 'Optional per-server automation that enrolls members in quests.',
			more: 'Game items, Nitro trials, in-game currency, whatever the quest pays.'
		},
		{
			icon: 'fa-cube',
			title: 'Roblox catalog watch',
			desc: 'Watch the catalog and post rich embeds when items change.',
			more: 'Built for trading groups and UGC-focused servers.',
			stat: (s: Totals): Live[] => [
				{ label: 'Items watched', value: fmt(s.roblox_items_watched), live: true },
				{ label: 'Embeds posted', value: fmt(s.roblox_items_posted) }
			]
		},
		{
			icon: 'fa-video',
			title: 'Content creator',
			desc: 'Creator applications, approvals and TikTok live session digests.',
			more: 'Tied to the channels you nominate.',
			stat: (s: Totals): Live[] => [
				{ label: 'Live now', value: fmt(s.streams_live_now), live: true },
				{ label: 'Creators', value: fmt(s.streams_creators) },
				{ label: 'Peak viewers', value: fmt(s.streams_peak_viewers) }
			]
		},
		{
			icon: 'fa-comments',
			title: 'AI chat',
			desc: 'Optional. Mention the bot, or reply to keep going without mentioning again.',
			more: 'Any OpenAI-compatible endpoint. Off until you supply URL, model and key.'
		},
		{
			icon: 'fa-microphone',
			title: 'Voice AI',
			desc: 'Optional. Ask it into a voice channel and talk out loud.',
			more: 'Wakes on a phrase, one speaker at a time, mutes itself when idle.'
		},
		{
			icon: 'fa-book',
			title: 'Wiki knowledge',
			desc: 'Point the bot at any MediaWiki or Fandom site from the panel.',
			more: 'Reads the rendered page with infoboxes and tables, in any language.'
		},
		{
			icon: 'fa-magnifying-glass',
			title: 'Search, fetch & images',
			desc: 'Web search, page reading and image generation, each on its own key.',
			more: 'Invisible until configured. The model decides when to use them.'
		},
		{
			icon: 'fa-database',
			title: 'Server knowledge',
			desc: "The AI reads your server's own live data with no extra key.",
			more: "Statistics, leaderboards, the shop, XP rates and the asker's own account only."
		},
		{
			icon: 'fa-code-branch',
			title: 'Self-host',
			desc: 'AGPL-3.0 on GitHub, with Docker Compose and a Node adapter.',
			more: 'Or use the hosted bot and skip the infrastructure.'
		},
		{
			icon: 'fa-user-astronaut',
			title: 'Self-bot path',
			desc: 'An optional self-bot path with panel-managed tokens.',
			more: "Use it in line with Discord's terms and your own risk assessment."
		},
		{
			icon: 'fa-plug',
			title: 'Webhook server',
			desc: 'Incoming hooks for selected automation paths.',
			more: 'For wiring the bot into what you already run.'
		}
	];

	const cards = $derived(
		features.map((f, i) => ({
			...f,
			n: String(i + 1).padStart(2, '0'),
			tone: ICON_TONES[i % ICON_TONES.length],
			live: hasLive && f.stat ? f.stat(data.totals) : []
		}))
	);

	const rowA = $derived(cards.slice(0, Math.ceil(cards.length / 2)));
	const rowB = $derived(cards.slice(Math.ceil(cards.length / 2)));

	const panel = [
		{ title: 'Toggle features', desc: 'Every module sits on its own switch, per server.' },
		{ title: 'Team access', desc: 'Owners and staff manage the panel side by side.' },
		{ title: 'Live monitoring', desc: 'Bot status, uptime and server totals, streaming live.' },
		{ title: 'Mobile ready', desc: 'Phone, tablet or desktop. The same panel.' }
	];

	const META = ['Free forever', 'AGPL-3.0 licensed', 'Hosted or self-hosted', 'Ten minute demo, no signup'];

	const EYEBROW = 'text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase 2xl:text-[13px]';
	const H2 = 'text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase';
	const LEAD = 'text-base-content/60 text-[13.5px] leading-[1.55] sm:max-w-[54ch] 2xl:text-[16px]';
	const BTN = 'btn rounded-sm text-[11.5px] font-extrabold tracking-[0.1em] uppercase 2xl:btn-lg 2xl:text-[13px]';
	const CARD = 'border-base-300 bg-base-100 w-[78vw] shrink-0 rounded-sm border p-4 sm:w-[330px] sm:p-5';
	const FULLBLEED = 'w-screen ml-[calc(50%-50vw)]';
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot | All in one server management</title>
	<meta
		name="description"
		content="Free and open source {APP_NAME} Discord Bot. Add our hosted bot to your server at no cost, or self host from GitHub. Free web panel for leveling, an XP economy, moderation, embed builder, giveaways, public stats, Discord Quest, TikTok tools, Roblox catalog watch, and more. Free ten minute demo on login."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell>
	<div class="@container">
		<section class="relative isolate flex min-h-[calc(100svh-6rem)] flex-col justify-between gap-6 pb-8 sm:gap-10">
			<GlobeScene gains={feed.gains} avoid={[heroText, heroFoot]} />

			<div bind:this={heroText}>
				<p class="display-line animate-rise text-primary block whitespace-nowrap uppercase" style="--ch: 9; --rise-delay: 80ms">One panel</p>
				<p class="display-line animate-rise text-primary block whitespace-nowrap uppercase" style="--ch: 12; --rise-delay: 200ms">Every module</p>
				<h1 class="animate-rise text-base-content/70 mt-6 text-[14px] leading-[1.55] sm:max-w-[44ch] 2xl:text-[17px]" style="--rise-delay: 380ms">
					Leveling, an XP economy, moderation, embeds, giveaways and live public pages — every module configured from one free web panel instead of slash
					commands.
				</h1>
			</div>

			<div bind:this={heroFoot} class="flex flex-col gap-8">
				{#if hasLive}
					<div class="border-base-300 grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
						{#each heroStats as stat, i}
							<div use:reveal class={REVEAL_CLASS} style="transition-delay: {i * 70}ms">
								<p use:countUp={stat.raw} class="text-primary text-[clamp(20px,3.4vw,34px)] leading-none font-black tabular-nums">{fmt(stat.raw)}</p>
								<p class="text-base-content/45 mt-1.5 text-[10px] font-bold tracking-[0.14em] uppercase 2xl:text-[12.5px]">{stat.label}</p>
							</div>
						{/each}
					</div>
				{/if}

				<div class="grid grid-cols-1 items-end gap-6 sm:grid-cols-3">
					<a
						href="#features"
						aria-label="Scroll to the modules"
						class="text-primary hover:text-accent flex w-fit items-center gap-3 text-[11.5px] font-extrabold tracking-[0.16em] uppercase transition-all duration-300 2xl:text-[14px] {scrolled
							? 'pointer-events-none translate-y-1 opacity-0'
							: 'opacity-100'}"
					>
						<span class="border-primary/45 grid size-10 shrink-0 place-items-center rounded-full border-2 motion-safe:animate-bounce 2xl:size-13">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="block size-[15px] 2xl:size-[19px]" aria-hidden="true">
								<path d="M12 3v18M5 14l7 7 7-7" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</span>
						<span class="leading-[1.25]">Scroll<br />to explore</span>
					</a>

					<p class="text-base-content/45 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold tracking-[0.14em] uppercase 2xl:text-[12.5px]">
						{#each META as item, i}
							{#if i > 0}
								<span aria-hidden="true" class="opacity-50">·</span>
							{/if}
							<span class="whitespace-nowrap">{item}</span>
						{/each}
					</p>

					<div class="flex flex-col gap-2 sm:items-end">
						<a href={OFFICIAL_BOT_INVITE_URL} class="{BTN} btn-primary w-full sm:w-auto" target="_blank" rel="noopener noreferrer">
							<i class="fa-brands fa-discord"></i>
							Add the bot — free
						</a>
						<p class="text-primary flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] sm:justify-end 2xl:text-[14px]">
							<a href="/login" class="hover:text-accent underline underline-offset-[3px]">Open the panel</a>
							<a href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer" class="hover:text-accent underline underline-offset-[3px]">GitHub</a>
							<a href="/docs" class="hover:text-accent underline underline-offset-[3px]">Docs</a>
						</p>
					</div>
				</div>
			</div>
		</section>

		<section class="border-base-300 scroll-mt-20 border-t py-10 sm:py-13 lg:py-16" id="features">
			<div class="mb-7">
				<p class={EYEBROW}>01 — Modules</p>
				<h2 class={H2}>Everything your server needs</h2>
				<p class={LEAD}>
					All {features.length} of them, drifting past on their own.
					{#if hasLive}
						Every number is live, aggregated across {fmt(data.totals.servers_counted)} public servers.
					{:else}
						Each one stands on its own. Turn on what you need and ignore the rest.
					{/if}
					Hover to stop.
				</p>
			</div>

			{#snippet moduleCard(card: (typeof cards)[number])}
				<article class="{CARD} hover:border-primary/40 flex flex-col transition-colors">
					<div class="mb-3 flex items-start justify-between gap-3">
						<i class="fas {card.icon} text-[18px] {card.tone}"></i>
						<span class="text-base-content/20 text-[22px] leading-none font-black tabular-nums">{card.n}</span>
					</div>
					<h3 class="text-base-content mb-1.5 text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{card.title}</h3>
					<p class="text-base-content/70 text-[12.5px] leading-[1.5]">{card.desc}</p>
					<p class="text-base-content/45 mt-1.5 hidden text-[12px] leading-[1.5] sm:block">{card.more}</p>
					{#if card.live.length > 0}
						<dl class="border-base-300 mt-4 flex flex-wrap gap-x-5 gap-y-2.5 border-t pt-3">
							{#each card.live as stat}
								<div>
									<dt class="text-base-content/45 text-[9.5px] font-bold tracking-[0.12em] uppercase">{stat.label}</dt>
									<dd class="text-primary mt-1 flex items-center gap-1.5 text-[15px] leading-none font-black tabular-nums">
										{#if stat.live}
											<span class="bg-primary size-1.5 shrink-0 rounded-full motion-safe:animate-pulse"></span>
										{/if}
										{stat.value}
									</dd>
								</div>
							{/each}
						</dl>
					{/if}
				</article>
			{/snippet}

			<div class="{FULLBLEED} marquee" style="--marquee-duration: 120s" aria-hidden="true">
				<div class="marquee-row gap-3 px-1.5">
					{#each [...rowA, ...rowA] as card}
						{@render moduleCard(card)}
					{/each}
				</div>
			</div>
			<div class="{FULLBLEED} marquee mt-3" style="--marquee-duration: 140s" aria-hidden="true">
				<div class="marquee-row marquee-row--reverse gap-3 px-1.5">
					{#each [...rowB, ...rowB] as card}
						{@render moduleCard(card)}
					{/each}
				</div>
			</div>

			<ul class="sr-only">
				{#each cards as card}
					<li>{card.title} — {card.desc} {card.more}</li>
				{/each}
			</ul>
		</section>

		{#if data.topServers.length > 0}
			<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>02 — Communities</p>
						<h2 class={H2}>Top servers by XP</h2>
						<p class={LEAD}>The five busiest communities running it right now. Each has its own live public pages, no login needed.</p>
					</div>
					<a href="/servers" class="{BTN} btn-outline btn-primary shrink-0">
						All {data.serverCount} servers
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<div class="border-base-300 grid grid-cols-1 border-t">
					{#each data.topServers as server, i (server.slug)}
						<a
							href={publicServerPath(server.slug)}
							use:reveal
							class="{REVEAL_CLASS} group border-base-300 grid grid-cols-[1.6rem_34px_1fr_auto] items-center gap-3 border-b px-0.5 py-3"
							style="transition-delay: {i * 60}ms"
						>
							<span class="text-primary/70 text-[13px] font-black tabular-nums">{server.rank}</span>
							<span class="bg-base-200 text-primary grid size-[34px] place-items-center overflow-hidden rounded-sm text-[13px] leading-none">
								{#if server.server_icon}
									<img src={server.server_icon} alt={server.name} loading="lazy" decoding="async" width="34" height="34" class="size-full object-cover" />
								{:else}
									<i class="fas fa-server"></i>
								{/if}
							</span>
							<span class="min-w-0">
								<span
									class="text-base-content group-hover:text-primary block truncate text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase transition-colors"
								>
									{server.name}
								</span>
								<span class="text-base-content/55 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] tabular-nums">
									<span>{fmt(server.xp)} XP</span>
									<span class="opacity-40" aria-hidden="true">·</span>
									<span>{fmt(server.members)} members</span>
								</span>
							</span>
							<i class="fas fa-arrow-right text-primary text-[12px] transition-transform group-hover:translate-x-0.5"></i>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.topTasks.length > 0}
			<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>03 — Tasks</p>
						<h2 class={H2}>A pool of {data.taskCount} tasks</h2>
						<p class={LEAD}>Daily and weekly cards deal from this pool. Goals scale to each member, so nobody gets the same card.</p>
					</div>
					<a href="/tasks" class="{BTN} btn-outline btn-primary shrink-0">
						All {data.taskCount} tasks
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<div use:reveal class="{REVEAL_CLASS} border-base-300 flex flex-wrap gap-2 border-t pt-6">
					{#each data.topTasks as task (task.id)}
						<span class="border-base-300 bg-base-100 flex items-center gap-2 rounded-sm border px-2.5 py-1.5">
							<i class="fas {task.icon} text-[11px] leading-none" style="color: {task.accent}"></i>
							<span class="text-base-content/75 text-[11.5px] leading-none font-bold tracking-[0.04em] uppercase">{task.label}</span>
						</span>
					{/each}
					{#if data.taskCount > data.topTasks.length}
						<a
							href="/tasks"
							class="border-primary/40 text-primary hover:bg-primary hover:text-primary-content flex items-center rounded-sm border px-2.5 py-1.5 text-[11.5px] leading-none font-extrabold tracking-[0.1em] uppercase transition-colors"
						>
							+{data.taskCount - data.topTasks.length} more
						</a>
					{/if}
				</div>
			</section>
		{/if}

		{#if data.topItems.length > 0}
			<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
				<div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>04 — Items</p>
						<h2 class={H2}>The shop catalog</h2>
						<p class={LEAD}>{data.buyableItemCount} of {data.itemCount} items on sale right now. The rest stay usable once they are in a bag.</p>
					</div>
					<a href="/shop" class="{BTN} btn-outline btn-primary shrink-0">
						All {data.itemCount} items
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.topItems as item, i (item.id)}
						<div use:reveal class={REVEAL_CLASS} style="transition-delay: {i * 60}ms">
							<a href="/shop" class="border-base-300 bg-base-100 hover:border-primary/40 flex h-full flex-col rounded-sm border p-4 transition-colors sm:p-5">
								<div class="mb-3 flex items-start justify-between gap-3">
									<i class="fas {effectIcon(item.effect_type)} text-[18px] leading-none" style="color: {effectAccentHex(item.effect_type)}"></i>
									{#if item.buyable}
										<span class="text-primary text-[9.5px] font-extrabold tracking-[0.12em] uppercase">Can buy</span>
									{:else}
										<span class="text-base-content/30 text-[9.5px] font-bold tracking-[0.12em] uppercase">Can't buy</span>
									{/if}
								</div>
								<h3 class="text-base-content mb-1.5 text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{item.name}</h3>
								<p class="text-base-content/45 text-[10px] font-bold tracking-[0.14em] uppercase">{effectLabel(item.effect_type)}</p>
								<p class="text-primary mt-4 text-[15px] leading-none font-black tabular-nums">{fmt(item.cost)} XP</p>
							</a>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.topQuests.length > 0}
			<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>05 — Discord Quests</p>
						<h2 class={H2}>Quests worth running</h2>
						<p class={LEAD}>{data.liveQuestCount} live of {data.questCount} tracked, with the game, the task and the reward.</p>
					</div>
					<a href="/quests" class="{BTN} btn-outline btn-primary shrink-0">
						All {data.questCount} quests
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<div class="border-base-300 grid grid-cols-1 border-t">
					{#each data.topQuests as quest, i (quest.quest_id)}
						<a
							href="/quests"
							use:reveal
							class="{REVEAL_CLASS} group border-base-300 grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b px-0.5 py-3"
							style="transition-delay: {i * 60}ms"
						>
							<span class="bg-base-200 text-primary grid h-[30px] w-[44px] place-items-center overflow-hidden rounded-sm text-[12px] leading-none">
								{#if (quest.thumbnail_url || quest.banner_url) && !broken[quest.quest_id]}
									<img
										src={quest.thumbnail_url || quest.banner_url}
										alt={quest.quest_name}
										loading="lazy"
										decoding="async"
										class="size-full object-cover"
										onerror={() => (broken[quest.quest_id] = true)}
									/>
								{:else}
									<i class="fas fa-scroll"></i>
								{/if}
							</span>
							<span class="min-w-0">
								<span
									class="text-base-content group-hover:text-primary block truncate text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase transition-colors"
								>
									{quest.quest_name}
								</span>
								<span class="text-base-content/55 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px]">
									<span class="truncate">{quest.game_title}</span>
									{#if quest.reward}
										<span class="opacity-40" aria-hidden="true">·</span>
										<span class="truncate">{quest.reward}</span>
									{/if}
								</span>
							</span>
							{#if quest.live}
								<span class="text-primary flex shrink-0 items-center gap-1.5 text-[10px] font-extrabold tracking-[0.12em] uppercase">
									<span class="bg-primary size-1.5 rounded-full motion-safe:animate-pulse"></span>
									Live
								</span>
							{:else}
								<span class="text-base-content/30 shrink-0 text-[10px] font-bold tracking-[0.12em] uppercase">Ended</span>
							{/if}
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.topRoblox.length > 0}
			<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>06 — Roblox catalog</p>
						<h2 class={H2}>Items under watch</h2>
						<p class={LEAD}>The most favourited of {data.robloxCount} catalog items the notifier tracks for price and stock changes.</p>
					</div>
					<a href="/roblox" class="{BTN} btn-outline btn-primary shrink-0">
						All {data.robloxCount} items
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
					{#each data.topRoblox as item, i (item.asset_id)}
						<div use:reveal class={REVEAL_CLASS} style="transition-delay: {i * 60}ms">
							<a
								href="/roblox"
								class="group border-base-300 bg-base-100 hover:border-primary/40 flex h-full flex-col overflow-hidden rounded-sm border transition-colors"
							>
								{#if item.thumbnail_url && !broken[item.asset_id]}
									<img
										src={item.thumbnail_url}
										alt={item.name}
										loading="lazy"
										decoding="async"
										class="bg-base-200 aspect-square w-full object-cover"
										onerror={() => (broken[item.asset_id] = true)}
									/>
								{:else}
									<span class="bg-base-200 grid aspect-square w-full place-items-center">
										<span class="flex flex-col items-center gap-1.5">
											<i class="fas fa-cube text-base-content/20 text-[22px]"></i>
											<span class="text-base-content/35 text-[13px] font-black tracking-[0.1em] uppercase">{initials(item.name)}</span>
										</span>
									</span>
								{/if}
								<span class="flex flex-1 flex-col p-3">
									<span class="text-base-content group-hover:text-primary mb-1 line-clamp-2 text-[12px] leading-[1.35] font-extrabold transition-colors">
										{item.name}
									</span>
									<span class="text-primary mt-auto text-[11.5px] font-black tabular-nums">
										{item.price > 0 ? `${fmt(item.price)} R$` : 'Free'}
									</span>
								</span>
							</a>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
			<div class="mb-6">
				<p class={EYEBROW}>07 — The panel</p>
				<h2 class={H2}>Configured in a browser</h2>
				<p class={LEAD}>Sign in and you land in the panel. Where a module supports it, you see live bot and server state as it happens.</p>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
				{#each panel as item, i}
					<p use:reveal class="{REVEAL_CLASS} text-base-content/60 text-[12.5px] leading-[1.5] sm:max-w-[30ch]" style="transition-delay: {i * 70}ms">
						<strong class="text-base-content mb-0.5 block text-[12px] font-extrabold tracking-[0.08em] uppercase">{item.title}</strong>
						{item.desc}
					</p>
				{/each}
			</div>
		</section>

		<section class="bleed bg-primary text-primary-content mt-10 -mb-10 py-12 sm:mt-13 sm:py-15 lg:mt-16 lg:py-19">
			<p class="text-primary-content mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">06 — Start</p>
			<p class="font-black">
				<span class="display-line text-primary-content block whitespace-nowrap uppercase" style="--ch: 10">Ready to go</span>
			</p>
			<p class="text-primary-content/90 mt-4.5 text-[13.5px] leading-[1.6] sm:max-w-[48ch]">
				Add {APP_NAME} Bot to your server first, then sign in to configure it. The login screen also offers a free
				<strong class="text-primary-content font-bold">ten minute demo</strong> with full panel access and no signup.
			</p>
			<div class="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
				<a
					href={OFFICIAL_BOT_INVITE_URL}
					class="{BTN} border-primary-content bg-primary-content text-primary hover:border-primary-content hover:bg-primary-content/90 w-full sm:w-auto"
					target="_blank"
					rel="noopener noreferrer"
				>
					<i class="fa-brands fa-discord"></i>
					Add {APP_NAME} Bot
				</a>
				<div class="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:contents">
					<a href="/login" class="{BTN} btn-outline border-primary-content/55 text-primary-content hover:bg-primary-content hover:text-primary">
						<i class="fas fa-arrow-right-to-bracket"></i>
						Open login
					</a>
					<a href="/docs" class="{BTN} btn-outline border-primary-content/55 text-primary-content hover:bg-primary-content hover:text-primary">
						<i class="fas fa-book-open"></i>
						Read the docs
					</a>
				</div>
			</div>
		</section>
	</div>
</PageShell>
