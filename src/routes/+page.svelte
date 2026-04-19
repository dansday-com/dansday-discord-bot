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

	<main class="m-main" style="overflow-y: hidden;">
		<div id="fullpage">
			<!-- FIRST SECTION: LITERALLY FULL PAGE, NO HEADER/FOOTER, NO MAX WIDTH -->
			<div class="section" style="padding: 0 !important; margin: 0 !important; background: var(--bg-body);">
				<div
					class="m-hero-ultimate"
					style="width: 100vw; height: 100vh; max-width: none; display: flex; align-items: center; justify-content: space-between; overflow: hidden; position: relative;"
				>
					<!-- Left Side: Copy and Tabs -->
					<div class="m-hero-u-left" style="padding-left: 6vw; width: 45vw; z-index: 10; display: flex; flex-direction: column; gap: 32px;">
						<div>
							<h1 style="font-size: 3.5vw; font-weight: 800; line-height: 1.1; margin-bottom: 20px;">
								Supercharge Your<br />
								<span
									style="background: linear-gradient(135deg, var(--chili-teal), var(--chili-peach)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"
									>Discord Server</span
								>
							</h1>
							<p style="font-size: 1.1vw; color: var(--lb-text-muted); line-height: 1.6; max-width: 90%;">
								Ditch the slash commands. Manage advanced Leveling, Discord Quests, Roblox Catalogs, TikTok Digests, and Live Stats directly from a powerful
								free web panel.
							</p>
						</div>

						<div class="m-hero-actions" style="display: flex; gap: 16px;">
							<a
								href={officialBotInviteUrl}
								class="m-btn m-btn--primary"
								target="_blank"
								rel="noopener noreferrer"
								style="font-size: 1.1vw; padding: 16px 32px;"
							>
								<i class="fab fa-discord"></i> Get started
							</a>
							<a href="/login" class="m-btn m-btn--ghost" style="font-size: 1.1vw; padding: 16px 32px;">
								<i class="fas fa-sign-in-alt"></i> Web Panel
							</a>
						</div>

						<!-- Interactive "ALL" Tabs -->
						<div class="m-hero-tabs" style="display: flex; flex-direction: column; gap: 10px; max-width: 80%; margin-top: 10px;">
							{#each [{ title: 'Roblox Catalog Watcher', icon: 'fa-cube' }, { title: 'Live Global Statistics', icon: 'fa-chart-line' }, { title: 'Interactive Web Panel', icon: 'fa-toggle-on' }, { title: 'Embed Builder Sandbox', icon: 'fa-palette' }, { title: 'Wall of Communities', icon: 'fa-users' }] as tab, i}
								<button
									class="m-hero-tab-btn"
									style="
										display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-radius: 12px; cursor: pointer; text-align: left;
										background: {activeTab === i ? 'var(--bg-card)' : 'transparent'};
										box-shadow: {activeTab === i ? '0 12px 40px rgba(36, 95, 115, 0.15)' : 'none'};
										border: 1px solid {activeTab === i ? 'var(--border-color)' : 'transparent'};
										color: {activeTab === i ? 'var(--lb-text)' : 'var(--lb-text-muted)'};
										opacity: {activeTab === i ? '1' : '0.6'};
										transform: {activeTab === i ? 'scale(1.03)' : 'scale(1)'};
										transition: all 0.3s ease;
									"
									onclick={() => {
										activeTab = i;
										userInteracted = true;
									}}
								>
									<div
										style="width: 32px; font-size: 1.2rem; display: flex; justify-content: center; color: {activeTab === i ? 'var(--chili-teal)' : 'inherit'};"
									>
										<i class="fas {tab.icon}"></i>
									</div>
									<span style="font-weight: 700; font-size: 1.1vw;">{tab.title}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Right Side: The Dynamic "ALL" Showcase -->
					<div
						class="m-hero-u-right"
						style="width: 50vw; height: 100vh; position: relative; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(36, 95, 115, 0.08), transparent 60%);"
					>
						{#key activeTab}
							<div in:fade={{ duration: 400 }} style="width: 85%; max-width: 800px; position: absolute;">
								<!-- 0: ROBLOX CATALOG CAROUSEL -->
								{#if activeTab === 0}
									<div style="display: flex; flex-direction: column; gap: 20px;">
										<h3 style="color: var(--lb-text); font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
											<i class="fas fa-cube" style="color: var(--chili-brick);"></i> Live Roblox Catalog Tracker
										</h3>
										<p style="color: var(--lb-text-muted); font-size: 1.1rem;">
											Automatically ping your server when highly anticipated UGC items drop or change price.
										</p>

										<div class="roblox-carousel-container" style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; padding-top: 10px;">
											{#each robloxItems as item}
												<div
													style="background: #1e1f22; border-radius: 16px; min-width: 240px; border: 1px solid #383a40; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.4);"
												>
													<div
														style="height: 160px; background: #2b2d31; display: flex; align-items: center; justify-content: center; font-size: 5rem; color: #fff; position: relative;"
													>
														<i class="fas {item.icon}"></i>
														<div
															style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; color: {item.color};"
														>
															<i class="fas fa-arrow-trend-{item.trend}"></i> Live
														</div>
													</div>
													<div style="padding: 20px;">
														<h4 style="color: #fff; font-weight: 700; margin: 0 0 12px; font-size: 1.2rem;">{item.name}</h4>
														<div style="display: flex; justify-content: space-between; align-items: center;">
															<span style="color: #00b06f; font-weight: 800; font-size: 1.2rem; display: flex; align-items: center; gap: 6px;">
																<i class="fas fa-coins" style="color: #f6b539;"></i>
																{item.price}
															</span>
															<button
																style="background: #ffffff; color: #111; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 700; cursor: pointer;"
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
									<div style="display: flex; flex-direction: column; gap: 20px;">
										<h3 style="color: var(--lb-text); font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
											<i class="fas fa-chart-line" style="color: var(--chili-teal);"></i> Live Global Statistics
										</h3>
										<p style="color: var(--lb-text-muted); font-size: 1.1rem;">
											Real-time scale of the {APP_NAME} ecosystem. Our databases track activity across all these communities instantly.
										</p>

										<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 20px;">
											<div
												style="background: var(--bg-card); border-radius: 16px; padding: 40px 20px; text-align: center; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(36, 95, 115, 0.1);"
											>
												<div style="font-size: 4rem; font-weight: 900; color: var(--chili-teal); line-height: 1;">
													{data.globalStats?.total_members?.toLocaleString() || '15,240'}
												</div>
												<div
													style="color: var(--lb-text-muted); font-weight: 700; margin-top: 16px; text-transform: uppercase; letter-spacing: 2px; font-size: 1rem;"
												>
													Total Members
												</div>
											</div>
											<div
												style="background: var(--bg-card); border-radius: 16px; padding: 40px 20px; text-align: center; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(36, 95, 115, 0.1);"
											>
												<div style="font-size: 4rem; font-weight: 900; color: var(--chili-hot); line-height: 1;">
													{data.globalStats?.total_servers?.toLocaleString() || '245'}
												</div>
												<div
													style="color: var(--lb-text-muted); font-weight: 700; margin-top: 16px; text-transform: uppercase; letter-spacing: 2px; font-size: 1rem;"
												>
													Active Servers
												</div>
											</div>
										</div>
									</div>

									<!-- 2: INTERACTIVE WEB PANEL -->
								{:else if activeTab === 2}
									<div style="display: flex; flex-direction: column; gap: 20px;">
										<h3 style="color: var(--lb-text); font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
											<i class="fas fa-toggle-on" style="color: var(--chili-peach);"></i> Configure in the Browser
										</h3>
										<p style="color: var(--lb-text-muted); font-size: 1.1rem;">
											Stop typing slash commands. Manage every single feature of your server directly from a clean UI.
										</p>

										<div
											style="width: 100%; background: var(--bg-card); border-radius: 16px; overflow: hidden; border: 1px solid var(--border-color); box-shadow: 0 20px 50px rgba(0,0,0,0.15); margin-top: 10px;"
										>
											<div
												style="padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 1.1rem; background: rgba(0,0,0,0.02);"
											>
												<i class="fas fa-server"></i> Module Configuration
											</div>
											<div style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
												<!-- Panel Toggles -->
												<div style="display: flex; justify-content: space-between; align-items: center;">
													<div>
														<div style="font-weight: 700; font-size: 1.1rem; color: var(--lb-text);">Leveling & XP System</div>
														<div style="font-size: 0.95rem; color: var(--lb-text-muted); margin-top: 4px;">Enable chat XP and rank leaderboards.</div>
													</div>
													<button
														onclick={() => (panelLeveling = !panelLeveling)}
														style="width: 54px; height: 30px; border-radius: 15px; background: {panelLeveling
															? 'var(--chili-teal)'
															: '#ccc'}; position: relative; transition: 0.3s; cursor: pointer; border: none;"
													>
														<div
															style="width: 24px; height: 24px; background: white; border-radius: 50%; position: absolute; top: 3px; left: {panelLeveling
																? '27px'
																: '3px'}; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
														></div>
													</button>
												</div>
												<div style="height: 1px; background: var(--border-color);"></div>
												<div style="display: flex; justify-content: space-between; align-items: center;">
													<div>
														<div style="font-weight: 700; font-size: 1.1rem; color: var(--lb-text);">Welcomer & Goodbye</div>
														<div style="font-size: 0.95rem; color: var(--lb-text-muted); margin-top: 4px;">Send rich embeds when members join.</div>
													</div>
													<button
														onclick={() => (panelWelcomer = !panelWelcomer)}
														style="width: 54px; height: 30px; border-radius: 15px; background: {panelWelcomer
															? 'var(--chili-teal)'
															: '#ccc'}; position: relative; transition: 0.3s; cursor: pointer; border: none;"
													>
														<div
															style="width: 24px; height: 24px; background: white; border-radius: 50%; position: absolute; top: 3px; left: {panelWelcomer
																? '27px'
																: '3px'}; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
														></div>
													</button>
												</div>
												<div style="height: 1px; background: var(--border-color);"></div>
												<div style="display: flex; justify-content: space-between; align-items: center;">
													<div>
														<div style="font-weight: 700; font-size: 1.1rem; color: var(--lb-text);">Discord Quests Notifier</div>
														<div style="font-size: 0.95rem; color: var(--lb-text-muted); margin-top: 4px;">Automate Quest enrollments for your community.</div>
													</div>
													<button
														onclick={() => (panelQuests = !panelQuests)}
														style="width: 54px; height: 30px; border-radius: 15px; background: {panelQuests
															? 'var(--chili-teal)'
															: '#ccc'}; position: relative; transition: 0.3s; cursor: pointer; border: none;"
													>
														<div
															style="width: 24px; height: 24px; background: white; border-radius: 50%; position: absolute; top: 3px; left: {panelQuests
																? '27px'
																: '3px'}; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
														></div>
													</button>
												</div>
											</div>
										</div>
									</div>

									<!-- 3: EMBED BUILDER -->
								{:else if activeTab === 3}
									<div style="display: flex; flex-direction: column; gap: 20px;">
										<h3 style="color: var(--lb-text); font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
											<i class="fas fa-palette" style="color: var(--yacht-stone);"></i> Real-Time Embed Builder
										</h3>
										<p style="color: var(--lb-text-muted); font-size: 1.1rem;">
											Draft and preview beautiful Discord embeds in the browser, then send them to any channel instantly.
										</p>

										<div style="display: flex; gap: 24px; width: 100%; height: 320px; margin-top: 10px;">
											<!-- Inputs -->
											<div
												style="flex: 1; display: flex; flex-direction: column; gap: 16px; background: var(--bg-card); padding: 24px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 15px 35px rgba(0,0,0,0.1);"
											>
												<div style="display: flex; flex-direction: column; gap: 8px;">
													<label style="font-weight: 700; font-size: 0.95rem; color: var(--lb-text);">Title</label>
													<input
														bind:value={embedTitle}
														style="background: var(--bg-body); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; color: var(--lb-text); font-size: 1rem;"
													/>
												</div>
												<div style="display: flex; flex-direction: column; gap: 8px; flex: 1;">
													<label style="font-weight: 700; font-size: 0.95rem; color: var(--lb-text);">Description</label>
													<textarea
														bind:value={embedDesc}
														style="background: var(--bg-body); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; color: var(--lb-text); flex: 1; resize: none; font-size: 1rem;"
													></textarea>
												</div>
											</div>
											<!-- Preview -->
											<div
												style="flex: 1; background: #313338; border-radius: 16px; padding: 24px; display: flex; align-items: flex-start; box-shadow: 0 15px 35px rgba(0,0,0,0.3);"
											>
												<div style="border-left: 4px solid #5865F2; background: #2b2d31; border-radius: 4px; padding: 16px; width: 100%;">
													<div style="color: #fff; font-weight: 700; margin-bottom: 10px; font-size: 1.1rem;">{embedTitle || 'Embed Title'}</div>
													<div style="color: #dbdee1; font-size: 1rem; line-height: 1.5; white-space: pre-wrap;">{embedDesc || 'Embed Description'}</div>
												</div>
											</div>
										</div>
									</div>

									<!-- 4: WALL OF COMMUNITIES -->
								{:else}
									<div style="display: flex; flex-direction: column; gap: 20px;">
										<h3 style="color: var(--lb-text); font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
											<i class="fas fa-users" style="color: var(--chili-brick);"></i> Trusted by Communities
										</h3>
										<p style="color: var(--lb-text-muted); font-size: 1.1rem;">
											These are real servers actively using our live public statistics and leveling engines.
										</p>

										<div
											style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; max-height: 400px; overflow-y: auto; padding: 10px; margin-top: 10px;"
										>
											{#each (data.featuredServers && data.featuredServers.length > 0 ? data.featuredServers : [{ name: 'Roblox Trading Hub', server_icon: null }, { name: 'Gamer Lounge', server_icon: null }, { name: 'Anime World', server_icon: null }, { name: 'Creator Space', server_icon: null }, { name: 'Dev Community', server_icon: null }, { name: 'Chill Zone', server_icon: null }]).slice(0, 9) as server}
												<div
													style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 16px; width: 160px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); transition: transform 0.2s; cursor: pointer;"
												>
													{#if server.server_icon}
														<img
															src={server.server_icon}
															alt={server.name}
															style="width: 72px; height: 72px; border-radius: 50%; border: 2px solid var(--border-color);"
														/>
													{:else}
														<div
															style="width: 72px; height: 72px; border-radius: 50%; background: var(--yacht-stone); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; border: 2px solid var(--border-color);"
														>
															<i class="fas fa-server"></i>
														</div>
													{/if}
													<div
														style="font-weight: 700; font-size: 1rem; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--lb-text);"
													>
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
							class="m-scroll-down-indicator"
							onclick={() => fullpageInstance?.moveSectionDown()}
							style="
							position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
							width: 56px; height: 56px; border-radius: 50%; background: var(--bg-card);
							box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid var(--border-color);
							display: flex; align-items: center; justify-content: center; color: var(--chili-teal); font-size: 1.5rem;
							cursor: pointer; z-index: 50; transition: all 0.3s ease; animation: bounce 2s infinite;
						"
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
