<script lang="ts">
	import '../home.css';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath, COMMUNITY_DISCORD_URL, DISCORD_APP_DIRECTORY_URL, OFFICIAL_BOT_INVITE_URL, SOURCE_REPO_URL } from '$lib/url.js';
	import { DiscordIcon, PageMeta, PageShell, reveal, REVEAL_CLASS } from '$lib/frontend/components/shell';
	import GlobeScene from '$lib/frontend/components/landing/GlobeScene.svelte';
	import LazyScenePlayer from '$lib/frontend/components/landing/scenes/LazyScenePlayer.svelte';
	import { nearView } from '$lib/frontend/nearView.js';
	import { effectIcon, effectLabel, effectAccentHex } from '$lib/items.js';
	import { createLiveGlobalStatistics } from '$lib/frontend/public/statistics/liveGlobal.svelte.js';
	import { onFirstInteraction } from '$lib/frontend/firstInteraction.js';
	import { faq, features, fmt, LANDING_DESCRIPTION, LANDING_FACTS, LANDING_TITLE } from '$lib/landing.js';
	import { faqNode, softwareNodes } from '$lib/structuredData.js';

	let { data }: PageProps = $props();

	const feed = createLiveGlobalStatistics(data.totals);
	let marqueeOn = $state(false);
	$effect(() => {
		let disconnect: (() => void) | null = null;
		const stop = onFirstInteraction(() => (disconnect = feed.connect()));
		return () => {
			stop();
			disconnect?.();
		};
	});

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

	const heroStats = $derived(
		[
			{ label: 'Members', raw: feed.totals.members_total },
			{ label: 'XP tracked', raw: feed.totals.leveling_total_xp },
			{ label: 'Voice hours', raw: feed.totals.leveling_total_voice_minutes / 60 }
		].filter((s) => Math.round(s.raw) > 0)
	);

	const ICON_TONES = ['text-primary', 'text-secondary', 'text-brand-gold-deep'];

	const cards = $derived(
		features.map((f, i) => ({
			...f,
			n: String(i + 1).padStart(2, '0'),
			tone: ICON_TONES[i % ICON_TONES.length],
			live: hasLive && f.stat ? f.stat(data.totals).filter((s) => s.value !== '0') : []
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

	const EYEBROW = 'text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase 2xl:text-[13px]';
	const H2 = 'text-base-content mb-2.5 text-[clamp(21px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase';
	const LEAD = 'text-base-content/70 text-[13.5px] leading-[1.55] sm:max-w-[54ch] 2xl:text-[16px]';
	const BTN = 'btn rounded-sm text-[11.5px] font-extrabold tracking-[0.1em] uppercase 2xl:btn-lg 2xl:text-[13px]';
	const CARD = 'border-base-300 bg-base-100 w-[78vw] shrink-0 rounded-sm border p-4 sm:w-[330px] sm:p-5';
	const FULLBLEED = 'w-screen ml-[calc(50%-50vw)]';
</script>

<PageMeta
	title={LANDING_TITLE}
	description={LANDING_DESCRIPTION}
	path="/"
	jsonLd={[
		...softwareNodes(
			LANDING_DESCRIPTION,
			features.map((f) => f.title)
		),
		faqNode(faq)
	]}
/>

<PageShell>
	<div class="@container">
		<section class="relative isolate flex min-h-[calc(100svh-6rem)] flex-col justify-between gap-6 pb-8 sm:gap-10">
			<GlobeScene gains={feed.gains} avoid={[heroText, heroFoot]} />

			<div bind:this={heroText}>
				<p class="display-line animate-rise text-primary block whitespace-nowrap uppercase" style="--ch: 9; --rise-delay: 80ms">Free MEE6</p>
				<span class="animate-rise block" style="--rise-delay: 200ms">
					<p class="display-line display-fill text-primary block whitespace-nowrap uppercase" style="--ch: 11; --sweep-delay: 720ms">Alternative</p>
				</span>
				<h1 class="animate-rise text-base-content/70 mt-6 text-[14px] leading-[1.55] sm:max-w-[44ch] 2xl:text-[17px]" style="--rise-delay: 380ms">
					<strong class="text-base-content font-extrabold">The free, open-source MEE6 alternative for Discord.</strong>
					Members steal each other's XP, shield it and spend it: the part MEE6 doesn't have. Leveling, role rewards, moderation, giveaways and creator alerts are
					free too, with no premium tier.
				</h1>
			</div>

			<div bind:this={heroFoot} class="flex flex-col gap-8">
				{#if hasLive && heroStats.length > 0}
					<div class="border-base-300 grid grid-cols-3 gap-x-6 gap-y-4 border-t pt-5">
						{#each heroStats as stat, i}
							<div use:reveal class={REVEAL_CLASS} style="transition-delay: {i * 70}ms">
								<p use:countUp={stat.raw} class="text-primary text-[clamp(20px,3.4vw,34px)] leading-none font-black tabular-nums">{fmt(stat.raw)}</p>
								<p class="text-base-content/70 mt-1.5 text-[10px] font-bold tracking-[0.14em] uppercase 2xl:text-[12.5px]">{stat.label}</p>
							</div>
						{/each}
					</div>
				{/if}

				<div class="grid grid-cols-1 items-end gap-6 sm:grid-cols-3">
					<a
						href="#different"
						aria-label="Scroll to what is different"
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

					<p class="text-base-content/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold tracking-[0.14em] uppercase 2xl:text-[12.5px]">
						{#each LANDING_FACTS as item, i}
							{#if i > 0}
								<span aria-hidden="true" class="opacity-50">·</span>
							{/if}
							<span class="whitespace-nowrap">{item}</span>
						{/each}
					</p>

					<div class="flex flex-col gap-2 sm:items-end">
						<a href={OFFICIAL_BOT_INVITE_URL} class="{BTN} btn-primary w-full sm:w-auto" target="_blank" rel="noopener noreferrer">
							<DiscordIcon />
							Add the bot — free
						</a>
						<p class="text-primary flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] sm:justify-end 2xl:text-[14px]">
							<a href="/login" class="hover:text-accent underline underline-offset-[3px]">Open the panel</a>
							<a href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer" class="hover:text-accent underline underline-offset-[3px]">GitHub</a>
							<a href="/docs" class="hover:text-accent underline underline-offset-[3px]">Docs</a>
							<a href={DISCORD_APP_DIRECTORY_URL} target="_blank" rel="noopener noreferrer" class="hover:text-accent underline underline-offset-[3px]"
								>App Directory</a
							>
						</p>
					</div>
				</div>
			</div>
		</section>

		<section class="border-base-300 scroll-mt-20 border-t py-10 sm:py-13 lg:py-16" id="different">
			<div class="mb-6">
				<p class={EYEBROW}>01 — Beyond MEE6</p>
				<h2 class={H2}>Members play it</h2>
				<p class={LEAD}>
					On most leveling bots, XP only ever goes up. Here members take it from each other and fight to keep it, and that gives them a reason to come back
					tomorrow.
				</p>
			</div>
			<LazyScenePlayer set="beyond" label="See what MEE6 doesn't do" variant="phone" />
		</section>

		<section class="border-base-300 scroll-mt-20 border-t py-10 sm:py-13 lg:py-16" id="essentials">
			<div class="mb-6">
				<p class={EYEBROW}>02 — The essentials</p>
				<h2 class={H2}>Free, no premium</h2>
				<p class={LEAD}>The features servers usually add MEE6 for, with no paid tier on any of them. The code is open source, so it stays that way.</p>
			</div>
			<LazyScenePlayer set="essentials" label="See the essentials work" />
		</section>

		<section class="border-base-300 scroll-mt-20 border-t py-10 sm:py-13 lg:py-16" id="features">
			<div class="mb-7">
				<p class={EYEBROW}>03 — Modules</p>
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
						<span class="text-base-content/55 text-[22px] leading-none font-black tabular-nums">{card.n}</span>
					</div>
					<p class="text-base-content mb-1.5 text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{card.title}</p>
					<p class="text-base-content/70 text-[12.5px] leading-[1.5]">{card.desc}</p>
					<p class="text-base-content/70 mt-1.5 hidden text-[12px] leading-[1.5] sm:block">{card.more}</p>
					{#if card.live.length > 0}
						<dl class="border-base-300 mt-4 flex flex-wrap gap-x-5 gap-y-2.5 border-t pt-3">
							{#each card.live as stat}
								<div>
									<dt class="text-base-content/70 text-[9.5px] font-bold tracking-[0.12em] uppercase">{stat.label}</dt>
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

			{#if marqueeOn}
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
			{:else}
				<div use:nearView={() => (marqueeOn = true)} class="min-h-[520px]" aria-hidden="true"></div>
			{/if}

			<ul class="sr-only">
				{#each cards as card}
					<li>{card.title} — {card.desc} {card.more}</li>
				{/each}
			</ul>
		</section>

		{#if data.topServers.length > 0}
			<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>04 — Communities</p>
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
								<span class="text-base-content/70 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] tabular-nums">
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

		{#if data.topForwarderSources.length > 0}
			<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>05 — Forwarder sources</p>
						<h2 class={H2}>Forward from here</h2>
						<p class={LEAD}>
							Pull drops, jobs and announcements out of {data.forwarderSourceCount} servers reaching {fmt(data.forwarderSourceMembers)} members, straight into your
							own channels. Filter by keyword so only what you care about lands.
						</p>
					</div>
					<a href="/forwarder-servers" class="{BTN} btn-outline btn-primary shrink-0">
						All {data.forwarderSourceCount} sources
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<div class="border-base-300 grid grid-cols-1 gap-3 border-t pt-6 min-[420px]:grid-cols-2 lg:grid-cols-3">
					{#each data.topForwarderSources as source, i (source.discord_server_id)}
						<div
							use:reveal
							class="{REVEAL_CLASS} border-base-300 bg-base-100 flex items-center gap-3 rounded-sm border p-3.5"
							style="transition-delay: {i * 60}ms"
						>
							<span class="bg-base-200 text-primary grid size-10 shrink-0 place-items-center overflow-hidden rounded-sm text-[14px] leading-none">
								{#if source.server_icon && !broken[source.discord_server_id]}
									<img
										src={source.server_icon}
										alt={source.name}
										loading="lazy"
										decoding="async"
										width="40"
										height="40"
										class="size-full object-cover"
										onerror={() => (broken[source.discord_server_id] = true)}
									/>
								{:else}
									<i class="fas fa-satellite-dish"></i>
								{/if}
							</span>
							<span class="min-w-0">
								<span class="text-base-content block truncate text-[12.5px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">{source.name}</span>
								<span class="text-base-content/55 mt-1 block text-[11.5px] tabular-nums">{fmt(source.members)} members</span>
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.topQuests.length > 0}
			<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>06 — Discord Quests</p>
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
								<span class="text-base-content/70 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px]">
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
			<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>07 — Roblox catalog</p>
						<h2 class={H2}>Items under watch</h2>
						<p class={LEAD}>
							The most notified, then the most favourited, of {data.robloxCount} catalog items the notifier tracks for price and stock changes.
						</p>
					</div>
					<a href="/roblox" class="{BTN} btn-outline btn-primary shrink-0">
						Browse all
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
									<span class="mt-auto flex flex-col gap-0.5">
										<span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
											<span class="text-primary text-[11.5px] font-black tabular-nums">
												{item.price > 0 ? `${fmt(item.price)} R$` : 'Free'}
											</span>
											{#if item.notification_count > 0}
												<span class="text-base-content/70 text-[10.5px] font-bold tabular-nums">
													<i class="fas fa-bell text-[9px]"></i>
													{fmt(item.notification_count)}
												</span>
											{/if}
										</span>
										{#if item.resale_price > 0}
											<span class="text-base-content/55 text-[10.5px] font-bold tabular-nums">
												<i class="fas fa-repeat text-[9px]"></i>
												{fmt(item.resale_price)} R$ resale
											</span>
										{/if}
									</span>
								</span>
							</a>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.topWikis.length > 0}
			<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>08 — Wiki knowledge</p>
						<h2 class={H2}>What it can look up</h2>
						<p class={LEAD}>
							{data.activeWikiCount} of {data.wikiCount} connected wikis answer questions right now. Every server the bot is in can ask about all of them.
						</p>
					</div>
					<a href="/wikis" class="{BTN} btn-outline btn-primary shrink-0">
						All {data.wikiCount} wikis
						<i class="fas fa-arrow-right"></i>
					</a>
				</div>
				<dl class="border-base-300 border-t">
					{#each data.topWikis as wiki, i (wiki.id)}
						<div
							use:reveal
							class="{REVEAL_CLASS} border-base-300 grid grid-cols-1 gap-x-6 gap-y-2 border-b py-4 sm:grid-cols-[1fr_1.15fr] sm:items-baseline"
							style="transition-delay: {i * 60}ms"
						>
							<dt class="min-w-0">
								<span class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
									<span class="text-base-content text-[clamp(15px,2.4cqw,24px)] leading-[1.05] font-black tracking-[-0.02em] uppercase">{wiki.name}</span>
									<span class="text-base-content/35 text-[11px] tracking-[0.04em] lowercase">{wiki.site_host ?? 'no public site'}</span>
								</span>
								<span class="mt-1.5 flex items-center gap-1.5">
									<span class="size-1.5 {wiki.active ? 'bg-primary' : 'bg-base-content/20'}"></span>
									<span class="text-[9.5px] font-extrabold tracking-[0.16em] uppercase {wiki.active ? 'text-primary' : 'text-base-content/35'}">
										{wiki.active ? 'Active' : 'Disabled'}
									</span>
								</span>
							</dt>
							<dd class="text-base-content/70 min-w-0 text-[12.5px] leading-[1.5]">
								{#if wiki.description}
									{wiki.description}
								{:else}
									<span class="text-base-content/35">No description yet.</span>
								{/if}
							</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}

		{#if data.topTasks.length > 0}
			<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
				<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>09 — Tasks</p>
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
			<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
				<div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
					<div class="min-w-0">
						<p class={EYEBROW}>10 — Items</p>
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
								<p class="text-base-content/70 text-[10px] font-bold tracking-[0.14em] uppercase">{effectLabel(item.effect_type)}</p>
								<p class="text-primary mt-4 text-[15px] leading-none font-black tabular-nums">{fmt(item.cost)} XP</p>
							</a>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
			<div class="mb-6">
				<p class={EYEBROW}>11 — The panel</p>
				<h2 class={H2}>Configured in a browser</h2>
				<p class={LEAD}>Sign in and you land in the panel. Where a module supports it, you see live bot and server state as it happens.</p>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
				{#each panel as item, i}
					<p use:reveal class="{REVEAL_CLASS} text-base-content/70 text-[12.5px] leading-[1.5] sm:max-w-[30ch]" style="transition-delay: {i * 70}ms">
						<strong class="text-base-content mb-0.5 block text-[12px] font-extrabold tracking-[0.08em] uppercase">{item.title}</strong>
						{item.desc}
					</p>
				{/each}
			</div>
		</section>

		<section class="border-base-300 border-t py-10 [contain-intrinsic-size:auto_640px] [content-visibility:auto] sm:py-13 lg:py-16">
			<div class="mb-6">
				<p class={EYEBROW}>12 — Questions</p>
				<h2 class={H2}>Before you add it</h2>
			</div>
			<dl class="border-base-300 border-t">
				{#each faq as item, i}
					<div
						use:reveal
						class="{REVEAL_CLASS} border-base-300 grid grid-cols-1 gap-x-6 gap-y-2 border-b py-4 sm:grid-cols-[1fr_1.15fr] sm:items-baseline"
						style="transition-delay: {i * 60}ms"
					>
						<dt class="text-base-content min-w-0 text-[clamp(15px,2.4cqw,24px)] leading-[1.05] font-black tracking-[-0.02em] uppercase">{item.q}</dt>
						<dd class="text-base-content/70 min-w-0 text-[12.5px] leading-[1.5]">{item.a}</dd>
					</div>
				{/each}
			</dl>
		</section>

		<section class="bleed bg-primary text-primary-content mt-10 -mb-10 py-12 sm:mt-13 sm:py-15 lg:mt-16 lg:py-19">
			<p class="text-primary-content mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">13 — Start</p>
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
					<DiscordIcon />
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
