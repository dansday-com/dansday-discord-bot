<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import 'fullpage.js/dist/fullpage.css';
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	let { data }: PageProps = $props();

	let fullpageInstance: any;

	onMount(async () => {
		const fullpage = (await import('fullpage.js')).default;

		fullpageInstance = new fullpage('#fullpage', {
			licenseKey: 'gplv3-license',
			autoScrolling: true,
			scrollHorizontally: true,
			navigation: true,
			fitToSection: false,
			scrollOverflow: true,
			verticalCentered: true
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

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader />

	<main class="m-main" style="overflow-y: hidden;">
		<div id="fullpage">
			<div class="section">
				<div class="m-inner m-landing-inner">
					<section class="m-hero">
						<div class="m-hero-content">
							<h1>
								Supercharge Your<br />
								<span class="m-gradient-text">Discord Server</span>
							</h1>
							<p>
								Run leveling, moderation, an embed builder, Discord Quests, quest enroll, self-bot options, creator tools, live public statistics pages, Roblox
								catalog alerts, and more from the free web panel in your browser. Configure in one place instead of flooding channels with slash commands. Free
								for everyone. Self-host from
								<a href={sourceRepoUrl} target="_blank" rel="noopener noreferrer">GitHub</a>
								or add
								<a href={officialBotInviteUrl} target="_blank" rel="noopener noreferrer">our hosted bot</a>
								if you do not run your own servers.
							</p>
							<div class="m-hero-actions">
								<a href={officialBotInviteUrl} class="m-btn m-btn--primary m-hero-btn-primary" target="_blank" rel="noopener noreferrer">
									<i class="fab fa-discord"></i>
									Get started
								</a>
								<div class="m-hero-actions-secondary" role="group" aria-label="More options">
									<a href="/login" class="m-btn m-btn--ghost m-btn--compact">
										<i class="fas fa-sign-in-alt"></i>
										Log in
									</a>
									<a href="#features" class="m-btn m-btn--ghost m-btn--compact">
										<i class="fas fa-th-large"></i>
										Features
									</a>
									<a
										href={communityDiscordUrl}
										class="m-btn m-btn--ghost m-btn--compact"
										target="_blank"
										rel="noopener noreferrer"
										title="Join our Discord for updates and testing"
									>
										<i class="fas fa-users"></i>
										Discord
									</a>
									<a href={sourceRepoUrl} class="m-btn m-btn--ghost m-btn--compact" target="_blank" rel="noopener noreferrer" title="Source on GitHub (MIT)">
										<i class="fab fa-github"></i>
										GitHub
									</a>
								</div>
							</div>
						</div>

						<div class="m-hero-visual">
							<div class="m-hero-floating-ui">
								<div class="m-hero-float-1">
									<div class="m-stat-card m-overview-card" style="padding: 14px 16px;">
										<div class="m-stat-card-head" style="margin-bottom: 10px;">
											<div class="m-stat-card-icon m-chili-stat-1" style="width: 32px; height: 32px; font-size: 0.9rem;">
												<i class="fas fa-arrow-trend-up"></i>
											</div>
											<h3 class="m-stat-card-title" style="font-size: 14px;">Leveling</h3>
										</div>
										<div class="m-stat-rows">
											<div class="m-stat-row" style="padding: 6px 10px;">
												<span class="m-stat-row-label" style="font-size: 12px;"><i class="fas fa-trophy"></i> Top Member</span>
												<span class="m-stat-row-value" style="font-size: 14px; color: var(--chili-hot);">Level 42</span>
											</div>
										</div>
									</div>
								</div>

								<div class="m-hero-float-2">
									<div class="m-overview-strip-item" style="box-shadow: 0 8px 30px var(--lb-shadow);">
										<div class="m-overview-strip-icon" style="width: 32px; height: 32px; font-size: 0.9rem;"><i class="fas fa-users"></i></div>
										<div class="m-overview-strip-text">
											<div class="m-overview-strip-value" style="font-size: 15px;">1,240</div>
											<div class="m-overview-strip-label" style="font-size: 9px;">Members</div>
										</div>
									</div>
								</div>

								<div class="m-hero-float-3">
									<div class="m-members-search-bar" style="margin:0; box-shadow: 0 12px 40px rgba(36, 95, 115, 0.15);">
										<div class="m-members-search">
											<i class="fas fa-search m-members-search-ic"></i>
											<input type="text" class="m-members-search-inp" placeholder="Search members..." disabled style="pointer-events: none;" />
										</div>
										<button class="m-members-btn" disabled style="pointer-events: none;"><i class="fas fa-filter"></i></button>
									</div>
								</div>

								<div class="m-hero-float-4">
									<div class="m-metric-pill m-metric-pill--live" style="box-shadow: 0 4px 15px rgba(36, 95, 115, 0.1);">
										<span class="m-live-dot"></span>
										Live syncing
									</div>
								</div>
							</div>
						</div>
					</section>
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

	<div style="position: fixed; bottom: 0; left: 0; width: 100%; z-index: 100;">
		<MainFooter />
	</div>
</div>
