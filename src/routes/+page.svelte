<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import 'fullpage.js/dist/fullpage.css';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	let { data }: PageProps = $props();

	let fullpageInstance: any;
	let isFirstSection = $state(true);

	// Dynamic Feature Showcase Data
	type ChatMessage = { id: number; author: string; bot: boolean; tag?: string; color?: string; content: string; featureIdx: number };

	let chatMessages = $state<ChatMessage[]>([]);
	let activeFeatureIdx = $state(0);
	let msgCounter = 0;

	const showcaseFeatures = [
		{ title: 'Leveling & XP', icon: 'fa-chart-line', tone: 'teal' },
		{ title: 'Welcomer', icon: 'fa-hand', tone: 'brick' },
		{ title: 'Embed Builder', icon: 'fa-palette', tone: 'stone' },
		{ title: 'Discord Quests', icon: 'fa-scroll', tone: 'teal' },
		{ title: 'Roblox Watcher', icon: 'fa-cube', tone: 'brick' }
	];

	const scenarioEvents = [
		// 0: Leveling
		[
			{ author: 'ProGamer', bot: false, content: 'That was a crazy game!', featureIdx: 0 },
			{
				author: APP_NAME,
				bot: true,
				tag: 'Leveling',
				color: 'var(--chili-hot)',
				content: '🏆 **ProGamer** just reached **Level 42**! (15,240 XP)\nRanked #1 on the leaderboard.',
				featureIdx: 0
			}
		],
		// 1: Welcomer
		[
			{ author: 'NewMember', bot: false, content: 'joined the server.', featureIdx: 1 },
			{
				author: APP_NAME,
				bot: true,
				tag: 'Welcomer',
				color: 'var(--chili-teal)',
				content: 'Welcome to the server, **NewMember**! 🎉\nMake sure to read the rules in <#rules> and grab your roles.',
				featureIdx: 1
			}
		],
		// 2: Embed Builder
		[
			{ author: 'AdminUser', bot: false, content: '/embed send channel:#announcements', featureIdx: 2 },
			{
				author: 'AdminUser',
				bot: false,
				tag: 'Announcement',
				color: 'var(--yacht-stone)',
				content: '📢 **Server Update v2.0**\n\nWe have completely revamped the server channels. Check out the new categories!',
				featureIdx: 2
			}
		],
		// 3: Quests
		[
			{ author: 'Streamer', bot: false, content: 'Going live now!', featureIdx: 3 },
			{
				author: APP_NAME,
				bot: true,
				tag: 'Quest Notifier',
				color: 'var(--chili-peach)',
				content: '🔔 **Discord Quest available!**\nStream to your friends for 15 minutes to unlock an exclusive in-game reward.',
				featureIdx: 3
			}
		],
		// 4: Roblox Watcher
		[
			{ author: 'TraderJoe', bot: false, content: 'Any new UGCs today?', featureIdx: 4 },
			{
				author: APP_NAME,
				bot: true,
				tag: 'Roblox Catalog',
				color: 'var(--chili-brick)',
				content: '🛒 **New Roblox Limited Item**\nDominus Aureus is now available in the catalog! Price: 50,000 Robux',
				featureIdx: 4
			}
		]
	];

	let currentScenario = 0;
	let currentEventInScenario = 0;

	onMount(() => {
		const interval = setInterval(() => {
			if (currentEventInScenario < scenarioEvents[currentScenario].length) {
				const event = scenarioEvents[currentScenario][currentEventInScenario];
				activeFeatureIdx = event.featureIdx;
				chatMessages = [...chatMessages, { ...event, id: ++msgCounter }];

				if (chatMessages.length > 5) {
					chatMessages = chatMessages.slice(1);
				}

				currentEventInScenario++;
			} else {
				currentScenario = (currentScenario + 1) % scenarioEvents.length;
				currentEventInScenario = 0;
			}
		}, 2500);

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
			<div class="section" style="padding: 0 !important; margin: 0 !important; background: var(--bg-body);">
				<div
					class="m-hero-ultimate"
					style="width: 100vw; height: 100vh; max-width: none; display: flex; align-items: center; justify-content: space-between; overflow: hidden; position: relative;"
				>
					<!-- Left Side: Copy and Highlighted Features -->
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
								Everything your server needs in one powerful bot and web panel. No more slash command spam—manage leveling, embeds, moderation, and alerts
								straight from your browser.
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

						<!-- Dynamic Feature Highlights -->
						<div class="m-hero-u-features" style="display: flex; flex-direction: column; gap: 12px; max-width: 80%; margin-top: 10px;">
							{#each showcaseFeatures as feature, i}
								<div
									class="m-hero-u-feat"
									style="
									display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-radius: 12px;
									background: {activeFeatureIdx === i ? 'var(--bg-card)' : 'transparent'};
									box-shadow: {activeFeatureIdx === i ? '0 12px 40px rgba(36, 95, 115, 0.15)' : 'none'};
									border: 1px solid {activeFeatureIdx === i ? 'var(--border-color)' : 'transparent'};
									opacity: {activeFeatureIdx === i ? '1' : '0.4'};
									transform: {activeFeatureIdx === i ? 'scale(1.03)' : 'scale(1)'};
									transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
								"
								>
									<div
										class="m-feature-icon m-feature-icon--{feature.tone}"
										style="width: 42px; height: 42px; font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; flex-shrink: 0;"
									>
										<i class="fas {feature.icon}"></i>
									</div>
									<span style="font-weight: 700; font-size: 1.2vw; color: var(--lb-text);">{feature.title}</span>
								</div>
							{/each}
						</div>
					</div>

					<!-- Right Side: Discord Simulator -->
					<div
						class="m-hero-u-right"
						style="width: 50vw; height: 100vh; position: relative; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, rgba(36, 95, 115, 0.08), transparent 60%);"
					>
						<div
							class="m-discord-mockup"
							style="
							width: 85%; height: 75vh; background: var(--bg-card); border-radius: 16px; 
							box-shadow: 0 40px 80px rgba(0,0,0,0.3); border: 1px solid var(--border-color);
							display: flex; flex-direction: column; overflow: hidden;
						"
						>
							<div
								class="m-discord-header"
								style="padding: 18px 24px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.03);"
							>
								<i class="fas fa-hashtag" style="color: var(--lb-text-muted); font-size: 1.3rem;"></i>
								<span style="font-weight: 700; color: var(--lb-text); font-size: 1.2rem;">general-chat</span>
							</div>
							<div
								class="m-discord-body"
								style="flex: 1; padding: 24px; display: flex; flex-direction: column; justify-content: flex-end; gap: 24px; overflow: hidden;"
							>
								{#each chatMessages as msg (msg.id)}
									<div class="m-discord-msg" in:fly={{ y: 30, duration: 400, opacity: 0 }} style="display: flex; gap: 18px;">
										<div
											class="m-discord-avatar"
											style="
											width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.3rem; flex-shrink: 0;
											background: {msg.bot ? 'var(--chili-teal)' : 'var(--yacht-stone)'};
										"
										>
											<i class="fas {msg.bot ? 'fa-robot' : 'fa-user'}"></i>
										</div>
										<div class="m-discord-content" style="flex: 1;">
											<div class="m-discord-author" style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
												<span style="font-weight: 700; color: var(--lb-text); font-size: 1.1rem;">{msg.author}</span>
												{#if msg.bot}
													<span
														style="background: #5865F2; color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; text-transform: uppercase; font-weight: 600;"
													>
														<i class="fas fa-check"></i> APP
													</span>
													{#if msg.tag}
														<span
															style="font-size: 0.75rem; padding: 2px 10px; border-radius: 12px; font-weight: 600; background: {msg.color}20; color: {msg.color}; border: 1px solid {msg.color}40;"
														>
															{msg.tag}
														</span>
													{/if}
												{/if}
											</div>
											<div class="m-discord-text" style="color: var(--lb-text-muted); font-size: 1.05rem; line-height: 1.5;">
												{#each msg.content.split('\n') as line}
													<div>{@html line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--lb-text); font-weight: 700;">$1</strong>')}</div>
												{/each}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
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

			{#if data.featuredServers.length > 0}
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
