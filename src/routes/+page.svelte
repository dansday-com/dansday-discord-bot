<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import 'fullpage.js/dist/fullpage.css';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	let { data }: PageProps = $props();

	let fullpageInstance: any;
	let isFirstSection = $state(true);

	// Interactive "ALL" Feature State
	let activeTab = $state(0);

	// Embed Builder State
	let embedTitle = $state('🚀 New Feature: Roblox Catalog Watcher');
	let embedDesc = $state(
		'We just launched the highly requested Roblox catalog tracker! Configure it directly in your web panel to start receiving live alerts for UGC items.'
	);

	// Web Panel State
	let panelLeveling = $state(true);
	let panelWelcomer = $state(false);
	let panelQuests = $state(true);

	const robloxItems = [
		{ name: 'Valkyrie Helm', price: '50,000', icon: 'fa-hat-wizard', trend: 'down', color: '#00b06f' },
		{ name: 'Dominus Aureus', price: '150,000', icon: 'fa-crown', trend: 'up', color: '#f23f43' },
		{ name: 'Korblox Deathspeaker', price: '17,000', icon: 'fa-shoe-prints', trend: 'down', color: '#00b06f' },
		{ name: 'Super Super Happy Face', price: '85,000', icon: 'fa-face-smile', trend: 'up', color: '#f23f43' }
	];

	// Auto-cycle the tabs if user hasn't clicked
	let userInteracted = false;
	onMount(() => {
		const interval = setInterval(() => {
			if (!userInteracted) {
				activeTab = (activeTab + 1) % 5;
			}
		}, 4000);
		return () => clearInterval(interval);
	});

	onMount(async () => {
		const fullpage = (await import('fullpage.js')).default;

		fullpageInstance = new fullpage('#fullpage', {
			licenseKey: 'gplv3-license',
			autoScrolling: true,
			scrollHorizontally: true,
			navigation: true,
			fitToSection: false,
			scrollOverflow: true,
			verticalCentered: false,
			paddingBottom: '0px',
			paddingTop: '0px',
			onLeave: (origin, destination, direction) => {
				isFirstSection = destination.index === 0;
			}
		});

		return () => {
			if (fullpageInstance) {
				fullpageInstance.destroy('all');
			}
		};
	});

	const officialBotInviteUrl = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';
	const communityDiscordUrl = 'https://discord.gg/7fEqEDSur3';
	const sourceRepoUrl = 'https://github.com/dansday-com/dansday-discord-bot';

	const features = [
		{
			icon: 'fa-shield-halved',
			tone: 'stone',
			title: 'Panel permissions',
			desc: 'Decide who can edit what in the web panel. Owners and staff get their own access levels so helpers can contribute without full control of the server.'
		},
		{
			icon: 'fa-language',
			tone: 'brick',
			title: 'Multi-language interface',
			desc: 'Discord flows use buttons, selects, and clear labels. Pick English (en) or Indonesian (id) for the interface strings, with room to add more languages over time.'
		},
		{
			icon: 'fa-chart-line',
			tone: 'teal',
			title: 'Leveling & XP',
			desc: 'Track messages and voice activity with a full XP system. Members earn levels, compete on leaderboards, and unlock role rewards.'
		},
		{
			icon: 'fa-hand',
			tone: 'brick',
			title: 'Welcomer',
			desc: 'Greet new members with customizable welcome messages and rich embeds. Make every newcomer feel at home.'
		},
		{
			icon: 'fa-palette',
			tone: 'stone',
			title: 'Embed builder',
			desc: 'Build rich Discord embeds in the panel with live preview, images, and placeholders—then send to channels from the browser without spamming slash commands in chat.'
		},
		{
			icon: 'fa-gavel',
			tone: 'teal',
			title: 'Moderation',
			desc: 'Keep your server safe with powerful moderation tools. Manage warnings, mutes, bans, and staff actions from one panel.'
		},
		{
			icon: 'fa-gift',
			tone: 'brick',
			title: 'Giveaways',
			desc: 'Run engaging giveaways with entry tracking, winner selection, and automatic role-based eligibility requirements.'
		},
		{
			icon: 'fa-chart-pie',
			tone: 'teal',
			title: 'Public Statistics',
			desc: 'Showcase your server with a live public stats page. Display member counts, leaderboards, and community insights.'
		},
		{
			icon: 'fa-gem',
			tone: 'brick',
			title: 'Boost messages',
			desc: 'Thank people when they boost your server. Choose channels and message templates in the panel, with placeholders for the member, boost tier, and boost counts. Separate from custom supporter roles.'
		},
		{
			icon: 'fa-scroll',
			tone: 'teal',
			title: 'Discord Quest notifier',
			desc: 'Bring Discord Quest home activity into your server with alerts when new quests show up and enough context to know what to run next.'
		},
		{
			icon: 'fa-wand-magic-sparkles',
			tone: 'brick',
			title: 'Quest enroll',
			desc: 'Discord Quest enrollment and automation for whatever each quest pays out (game items, Nitro trials, in-game currency, and other rewards). Enable and tune auto quest enrollment in the Discord Quest notifier config so it fits your server.'
		},
		{
			icon: 'fa-user-astronaut',
			tone: 'stone',
			title: 'Self-bot',
			desc: 'Optional self-bot path with panel-managed tokens and user-context workflows alongside the main bot.'
		},
		{
			icon: 'fa-id-card',
			tone: 'teal',
			title: 'Server accounts',
			desc: 'Invite owners and staff into the panel with roles that fit how you run the team. This stays separate from who can chat or moderate in Discord.'
		},
		{
			icon: 'fa-video',
			tone: 'brick',
			title: 'Content creator',
			desc: 'Creator applications, approvals, and TikTok live session digests tied to your server.'
		},
		{
			icon: 'fa-cube',
			tone: 'stone',
			title: 'Roblox catalog watch',
			desc: 'Watch the Roblox catalog and post rich embeds when items change. Built for trading groups and UGC focused servers.'
		},
		{
			icon: 'fa-forward',
			tone: 'stone',
			title: 'Message forwarder',
			desc: 'Automatically forward messages between channels or servers. Keep important announcements synced across communities.'
		},
		{
			icon: 'fa-moon',
			tone: 'teal',
			title: 'AFK System',
			desc: 'Let members set AFK statuses with custom messages. The bot notifies others when they mention someone who is away.'
		},
		{
			icon: 'fa-star',
			tone: 'brick',
			title: 'Custom Supporter Roles',
			desc: 'Allow supporters to create and customize their own unique roles with custom names and colors.'
		},
		{
			icon: 'fa-bell',
			tone: 'stone',
			title: 'Channel Notifications',
			desc: 'Set up automatic notifications for specific channel events. Stay informed about activity across your server.'
		},
		{
			icon: 'fa-comment-dots',
			tone: 'teal',
			title: 'Feedback System',
			desc: 'Collect and manage community feedback directly through Discord. Organize suggestions and feature requests.'
		},
		{
			icon: 'fa-clipboard-check',
			tone: 'brick',
			title: 'Staff Rating',
			desc: 'Track and evaluate staff performance with a built-in rating system. Maintain quality across your team.'
		}
	];
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot | All in one server management</title>
	<meta
		name="description"
		content="Free and open source {APP_NAME} Discord Bot. Add our hosted bot to your server at no cost, or self host from GitHub. Free web panel for leveling, moderation, embed builder, giveaways, public stats, Discord Quest, TikTok tools, Roblox catalog watch, and more. Free ten minute demo on login."
	/>
</svelte:head>

<div class="m-root" class:m-first-section={isFirstSection}>
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<div class="m-nav-wrapper" class:m-nav-hidden={isFirstSection}>
		<MainHeader />
	</div>

	<main class="m-main overflow-hidden">
		<div id="fullpage">
			<!-- FIRST SECTION: LITERALLY FULL PAGE, NO HEADER/FOOTER, NO MAX WIDTH -->
			<div class="section m-0 bg-[var(--chili-bg)] p-0">
				<div class="m-hero-ultimate relative flex h-screen w-screen max-w-none items-center justify-between overflow-hidden">
					<!-- Left Side: Copy and Tabs -->
					<div class="m-hero-u-left z-10 flex w-[45vw] flex-col gap-8 pl-[6vw]">
						<div>
							<h1 class="mb-5 text-[3.5vw] leading-[1.1] font-extrabold text-[var(--lb-text)]">
								Supercharge Your<br />
								<span class="bg-gradient-to-br from-[var(--chili-hot,#245f73)] to-[var(--chili-peach,#3a6d82)] bg-clip-text text-transparent"
									>Discord Server</span
								>
							</h1>
							<p class="max-w-[90%] text-[1.1vw] leading-[1.6] text-[var(--lb-text-muted)]">
								Ditch the slash commands. Manage advanced Leveling, Discord Quests, Roblox Catalogs, TikTok Digests, and Live Stats directly from a powerful
								free web panel.
							</p>
						</div>

						<div class="m-hero-actions flex gap-4">
							<a href={officialBotInviteUrl} class="m-btn m-btn--primary px-8 py-4 text-[1.1vw]" target="_blank" rel="noopener noreferrer">
								<i class="fab fa-discord"></i> Get started
							</a>
							<a href="/login" class="m-btn m-btn--ghost px-8 py-4 text-[1.1vw]">
								<i class="fas fa-sign-in-alt"></i> Web Panel
							</a>
						</div>

						<!-- Interactive "ALL" Tabs -->
						<div class="m-hero-tabs mt-2.5 flex max-w-[80%] flex-col gap-2.5">
							{#each [{ title: 'Roblox Catalog Watcher', icon: 'fa-cube' }, { title: 'Live Global Statistics', icon: 'fa-chart-line' }, { title: 'Interactive Web Panel', icon: 'fa-toggle-on' }, { title: 'Embed Builder Sandbox', icon: 'fa-palette' }, { title: 'Wall of Communities', icon: 'fa-users' }] as tab, i}
								<button
									class="flex cursor-pointer items-center gap-4 rounded-xl border px-5 py-3.5 text-left transition-all duration-300 {activeTab === i
										? 'scale-[1.03] border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] text-[var(--lb-text)] opacity-100 shadow-[0_12px_40px_rgba(36,95,115,0.15)]'
										: 'scale-100 border-transparent bg-transparent text-[var(--lb-text-muted)] opacity-60 shadow-none'}"
									onclick={() => {
										activeTab = i;
										userInteracted = true;
									}}
								>
									<div class="flex w-8 justify-center text-xl {activeTab === i ? 'text-[var(--chili-hot)]' : 'text-inherit'}">
										<i class="fas {tab.icon}"></i>
									</div>
									<span class="text-[1.1vw] font-bold">{tab.title}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Right Side: The Dynamic "ALL" Showcase -->
					<div
						class="m-hero-u-right relative flex h-screen w-[50vw] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(36,95,115,0.08),transparent_60%)]"
					>
						{#key activeTab}
							<div in:fade={{ duration: 400 }} class="absolute w-[85%] max-w-[800px]">
								<!-- 0: ROBLOX CATALOG CAROUSEL -->
								{#if activeTab === 0}
									<div class="flex flex-col gap-5">
										<h3 class="flex items-center gap-2.5 text-2xl font-extrabold text-[var(--lb-text)]">
											<i class="fas fa-cube text-[var(--chili-brick)]"></i> Live Roblox Catalog Tracker
										</h3>
										<p class="text-lg text-[var(--lb-text-muted)]">Automatically ping your server when highly anticipated UGC items drop or change price.</p>

										<div class="roblox-carousel-container flex gap-5 overflow-x-auto pt-2.5 pb-5">
											{#each robloxItems as item}
												<div
													class="min-w-[240px] overflow-hidden rounded-2xl border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] shadow-[0_15px_35px_rgba(36,95,115,0.15)]"
												>
													<div class="relative flex h-[160px] items-center justify-center bg-[var(--chili-surface-mid)] text-[5rem] text-[var(--chili-hot)]">
														<i class="fas {item.icon}"></i>
														<div
															class="absolute top-3 right-3 rounded-md border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] px-2 py-1 text-xs font-bold"
															style="color: {item.color};"
														>
															<i class="fas fa-arrow-trend-{item.trend}"></i> Live
														</div>
													</div>
													<div class="p-5">
														<h4 class="m-0 mb-3 text-[1.2rem] font-bold text-[var(--lb-text)]">{item.name}</h4>
														<div class="flex items-center justify-between">
															<span class="flex items-center gap-1.5 text-[1.2rem] font-extrabold text-[#00b06f]">
																<i class="fas fa-coins text-[#f6b539]"></i>
																{item.price}
															</span>
															<button class="cursor-pointer rounded-md border-none bg-[var(--chili-hot)] px-3 py-1.5 font-bold text-white hover:opacity-90"
																>Buy</button
															>
														</div>
													</div>
												</div>
											{/each}
										</div>
									</div>

									<!-- 1: LIVE GLOBAL STATISTICS -->
								{:else if activeTab === 1}
									<div class="flex flex-col gap-5">
										<h3 class="flex items-center gap-2.5 text-2xl font-extrabold text-[var(--lb-text)]">
											<i class="fas fa-chart-line text-[var(--chili-hot)]"></i> Live Global Statistics
										</h3>
										<p class="text-lg text-[var(--lb-text-muted)]">
											Real-time scale of the {APP_NAME} ecosystem. Our databases track activity across all these communities instantly.
										</p>

										<div class="mt-5 grid grid-cols-2 gap-6">
											<div
												class="rounded-2xl border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] px-5 py-10 text-center shadow-[0_20px_40px_rgba(36,95,115,0.1)]"
											>
												<div class="text-6xl leading-none font-black text-[var(--chili-hot)]">
													{data.globalStats?.total_members?.toLocaleString() || '15,240'}
												</div>
												<div class="mt-4 text-base font-bold tracking-[2px] text-[var(--lb-text-muted)] uppercase">Total Members</div>
											</div>
											<div
												class="rounded-2xl border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] px-5 py-10 text-center shadow-[0_20px_40px_rgba(36,95,115,0.1)]"
											>
												<div class="text-6xl leading-none font-black text-[var(--chili-hot)]">
													{data.globalStats?.total_servers?.toLocaleString() || '245'}
												</div>
												<div class="mt-4 text-base font-bold tracking-[2px] text-[var(--lb-text-muted)] uppercase">Active Servers</div>
											</div>
										</div>
									</div>

									<!-- 2: INTERACTIVE WEB PANEL -->
								{:else if activeTab === 2}
									<div class="flex flex-col gap-5">
										<h3 class="flex items-center gap-2.5 text-2xl font-extrabold text-[var(--lb-text)]">
											<i class="fas fa-toggle-on text-[var(--chili-peach)]"></i> Configure in the Browser
										</h3>
										<p class="text-lg text-[var(--lb-text-muted)]">
											Stop typing slash commands. Manage every single feature of your server directly from a clean UI.
										</p>

										<div
											class="mt-2.5 w-full overflow-hidden rounded-2xl border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
										>
											<div class="flex items-center gap-3 border-b border-[var(--lb-border)] bg-black/2 px-6 py-5 text-lg font-bold">
												<i class="fas fa-server"></i> Module Configuration
											</div>
											<div class="flex flex-col gap-6 p-6">
												<!-- Panel Toggles -->
												<div class="flex items-center justify-between">
													<div>
														<div class="text-lg font-bold text-[var(--lb-text)]">Leveling & XP System</div>
														<div class="mt-1 text-[0.95rem] text-[var(--lb-text-muted)]">Enable chat XP and rank leaderboards.</div>
													</div>
													<button
														onclick={() => (panelLeveling = !panelLeveling)}
														class="relative h-[30px] w-[54px] cursor-pointer rounded-full border-none transition-all duration-300 {panelLeveling
															? 'bg-[var(--chili-hot)]'
															: 'bg-[#ccc]'}"
													>
														<div
															class="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 {panelLeveling
																? 'left-[27px]'
																: 'left-[3px]'}"
														></div>
													</button>
												</div>
												<div class="h-[1px] bg-[var(--lb-border)]"></div>
												<div class="flex items-center justify-between">
													<div>
														<div class="text-lg font-bold text-[var(--lb-text)]">Welcomer & Goodbye</div>
														<div class="mt-1 text-[0.95rem] text-[var(--lb-text-muted)]">Send rich embeds when members join.</div>
													</div>
													<button
														onclick={() => (panelWelcomer = !panelWelcomer)}
														class="relative h-[30px] w-[54px] cursor-pointer rounded-full border-none transition-all duration-300 {panelWelcomer
															? 'bg-[var(--chili-hot)]'
															: 'bg-[#ccc]'}"
													>
														<div
															class="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 {panelWelcomer
																? 'left-[27px]'
																: 'left-[3px]'}"
														></div>
													</button>
												</div>
												<div class="h-[1px] bg-[var(--lb-border)]"></div>
												<div class="flex items-center justify-between">
													<div>
														<div class="text-lg font-bold text-[var(--lb-text)]">Discord Quests Notifier</div>
														<div class="mt-1 text-[0.95rem] text-[var(--lb-text-muted)]">Automate Quest enrollments for your community.</div>
													</div>
													<button
														onclick={() => (panelQuests = !panelQuests)}
														class="relative h-[30px] w-[54px] cursor-pointer rounded-full border-none transition-all duration-300 {panelQuests
															? 'bg-[var(--chili-hot)]'
															: 'bg-[#ccc]'}"
													>
														<div
															class="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 {panelQuests
																? 'left-[27px]'
																: 'left-[3px]'}"
														></div>
													</button>
												</div>
											</div>
										</div>
									</div>

									<!-- 3: EMBED BUILDER -->
								{:else if activeTab === 3}
									<div class="flex flex-col gap-5">
										<h3 class="flex items-center gap-2.5 text-2xl font-extrabold text-[var(--lb-text)]">
											<i class="fas fa-palette text-[var(--yacht-stone)]"></i> Real-Time Embed Builder
										</h3>
										<p class="text-lg text-[var(--lb-text-muted)]">
											Draft and preview beautiful Discord embeds in the browser, then send them to any channel instantly.
										</p>

										<div class="mt-2.5 flex h-[320px] w-full gap-6">
											<!-- Inputs -->
											<div
												class="flex flex-1 flex-col gap-4 rounded-2xl border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] p-6 shadow-[0_15px_35px_rgba(0,0,0,0.1)]"
											>
												<div class="flex flex-col gap-2">
													<label class="text-[0.95rem] font-bold text-[var(--lb-text)]">Title</label>
													<input
														bind:value={embedTitle}
														class="rounded-lg border border-[var(--lb-border)] bg-[var(--chili-bg)] p-3 text-base text-[var(--lb-text)]"
													/>
												</div>
												<div class="flex flex-1 flex-col gap-2">
													<label class="text-[0.95rem] font-bold text-[var(--lb-text)]">Description</label>
													<textarea
														bind:value={embedDesc}
														class="flex-1 resize-none rounded-lg border border-[var(--lb-border)] bg-[var(--chili-bg)] p-3 text-base text-[var(--lb-text)]"
													></textarea>
												</div>
											</div>
											<!-- Preview -->
											<div class="flex flex-1 items-start rounded-2xl bg-[#313338] p-6 shadow-[0_15px_35px_rgba(36,95,115,0.15)]">
												<div class="w-full rounded-sm border-l-4 border-[#5865F2] bg-[#2b2d31] p-4">
													<div class="mb-2.5 text-lg font-bold text-white">{embedTitle || 'Embed Title'}</div>
													<div class="text-base leading-relaxed whitespace-pre-wrap text-[#dbdee1]">{embedDesc || 'Embed Description'}</div>
												</div>
											</div>
										</div>
									</div>

									<!-- 4: WALL OF COMMUNITIES -->
								{:else}
									<div class="flex flex-col gap-5">
										<h3 class="flex items-center gap-2.5 text-2xl font-extrabold text-[var(--lb-text)]">
											<i class="fas fa-users text-[var(--chili-brick)]"></i> Trusted by Communities
										</h3>
										<p class="text-lg text-[var(--lb-text-muted)]">These are real servers actively using our live public statistics and leveling engines.</p>

										<div class="mt-2.5 flex max-h-[400px] flex-wrap justify-center gap-5 overflow-y-auto p-2.5">
											{#each (data.featuredServers && data.featuredServers.length > 0 ? data.featuredServers : [{ name: 'Roblox Trading Hub', server_icon: null }, { name: 'Gamer Lounge', server_icon: null }, { name: 'Anime World', server_icon: null }, { name: 'Creator Space', server_icon: null }, { name: 'Dev Community', server_icon: null }, { name: 'Chill Zone', server_icon: null }]).slice(0, 9) as server}
												<div
													class="flex w-[160px] cursor-pointer flex-col items-center gap-4 rounded-2xl border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] p-5 text-center shadow-[0_10px_25px_rgba(0,0,0,0.05)] transition-transform duration-200 hover:scale-105"
												>
													{#if server.server_icon}
														<img src={server.server_icon} alt={server.name} class="h-[72px] w-[72px] rounded-full border-2 border-[var(--lb-border)]" />
													{:else}
														<div
															class="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[var(--lb-border)] bg-[var(--yacht-stone)] text-[1.8rem] text-white"
														>
															<i class="fas fa-server"></i>
														</div>
													{/if}
													<div class="w-full overflow-hidden text-base font-bold text-ellipsis whitespace-nowrap text-[var(--lb-text)]">
														{server.name}
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/key}
					</div>

					<!-- Arrow Down Indicator -->
					{#if isFirstSection}
						<button
							onclick={() => fullpageInstance?.moveSectionDown()}
							class="m-scroll-down-indicator absolute bottom-10 left-1/2 z-50 flex h-14 w-14 -translate-x-1/2 animate-bounce cursor-pointer items-center justify-center rounded-full border border-[var(--lb-border)] bg-[var(--chili-surface-elevated)] text-2xl text-[var(--chili-hot)] shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition-all duration-300"
							aria-label="Scroll down"
						>
							<i class="fas fa-chevron-down"></i>
						</button>
					{/if}
				</div>
			</div>

			<div class="section">
				<div class="m-inner m-landing-inner">
					<section class="m-section" id="features">
						<div class="m-section-header">
							<h2>Everything your server needs</h2>
							<p>
								Each module stands on its own. Turn on leveling, embed builder, Quest notifier, quest enroll, self-bot, forwarder, public statistics, or any mix
								you need. Everything lives under the same server settings.
							</p>
						</div>
						<div class="m-features-grid">
							{#each features as feature}
								<div class="m-feature-card">
									<div class="m-feature-icon m-feature-icon--{feature.tone}">
										<i class="fas {feature.icon}"></i>
									</div>
									<h3>{feature.title}</h3>
									<p>{feature.desc}</p>
								</div>
							{/each}
						</div>
					</section>
				</div>
			</div>

			{#if data.featuredServers && data.featuredServers.length > 0}
				<div class="section">
					<div class="m-inner m-landing-inner">
						<section class="m-section">
							<div class="m-section-header">
								<h2>Active Communities</h2>
								<p>Servers using {APP_NAME} Bot with public statistics enabled.</p>
							</div>
							<div class="m-servers-list">
								{#each data.featuredServers as server}
									<a href={publicServerPath(server.slug)} class="m-server-card">
										<div class="m-landing-server-icon">
											{#if server.server_icon}
												<img src={server.server_icon} alt={server.name} loading="lazy" width="42" height="42" />
											{:else}
												<i class="fas fa-server m-landing-server-icon-placeholder"></i>
											{/if}
										</div>
										<div class="m-server-info">
											<div class="m-server-name">{server.name}</div>
											<div class="m-server-sub">
												<span class="m-landing-server-live" title="Public page uses live data">
													<span class="m-live-dot"></span>
													Live public statistics
												</span>
											</div>
										</div>
										<i class="fas fa-chevron-right m-server-arrow"></i>
									</a>
								{/each}
							</div>
						</section>
					</div>
				</div>
			{/if}

			<div class="section">
				<div class="m-inner m-landing-inner">
					<section class="m-section">
						<div class="m-section-header">
							<h2>Powerful web panel</h2>
							<p>
								Change settings from your browser without building long slash command workflows. After you sign in you land in the panel. Where a module
								supports it, you get live bot and server state right in the UI.
							</p>
						</div>
						<div class="m-features-grid m-features-grid--quad">
							<div class="m-feature-card">
								<div class="m-feature-icon m-feature-icon--teal">
									<i class="fas fa-toggle-on"></i>
								</div>
								<h3>Toggle Features</h3>
								<p>Enable or disable any feature with a single click. Each module is independently configurable.</p>
							</div>
							<div class="m-feature-card">
								<div class="m-feature-icon m-feature-icon--brick">
									<i class="fas fa-users-gear"></i>
								</div>
								<h3>Team Access</h3>
								<p>Invite staff members with role-based access. Owners and staff can manage the panel independently.</p>
							</div>
							<div class="m-feature-card">
								<div class="m-feature-icon m-feature-icon--teal">
									<i class="fas fa-eye"></i>
								</div>
								<h3>Live Monitoring</h3>
								<p>Watch bot status, uptime, and server statistics in real-time with live streaming updates.</p>
							</div>
							<div class="m-feature-card">
								<div class="m-feature-icon m-feature-icon--brick">
									<i class="fas fa-mobile-screen"></i>
								</div>
								<h3>Mobile Ready</h3>
								<p>Full responsive design works on any device. Manage your server from phone, tablet, or desktop.</p>
							</div>
						</div>
					</section>
				</div>
			</div>

			<div class="section">
				<div class="m-inner m-landing-inner">
					<section class="m-cta">
						<div class="m-cta-card">
							<h2>Ready to try it?</h2>
							<p>
								Add {APP_NAME} Bot to your server first for free. Then sign in to the web panel to configure your server. The login screen also offers an optional
								free
								<strong>ten minute demo</strong> with full panel access and no signup.
							</p>
							<div class="m-cta-actions">
								<a href={officialBotInviteUrl} class="m-btn m-btn--primary" target="_blank" rel="noopener noreferrer">
									<i class="fab fa-discord"></i>
									Add {APP_NAME} Bot
								</a>
								<a href="/login" class="m-btn m-btn--ghost">
									<i class="fas fa-sign-in-alt"></i>
									Open login
								</a>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	</main>

	<div class="m-footer-wrapper" class:m-footer-hidden={isFirstSection}>
		<MainFooter />
	</div>
</div>
