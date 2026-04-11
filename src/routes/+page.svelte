<script lang="ts">
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/publicSiteUrls.js';
	import PublicSiteNav from '$lib/components/PublicSiteNav.svelte';
	import PublicSiteFooter from '$lib/components/PublicSiteFooter.svelte';
	import './main.css';

	let { data }: PageProps = $props();

	/** Add the official Dansday Bot to a Discord server */
	const officialBotInviteUrl = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';
	/** Community for updates and testing */
	const communityDiscordUrl = 'https://discord.gg/7fEqEDSur3';
	/** Open source repository (MIT) */
	const sourceRepoUrl = 'https://github.com/dansday-com/dansday-discord-bot';

	const features = [
		{
			icon: 'fa-shield-halved',
			tone: 'stone',
			title: 'Panel permissions',
			desc: 'Decide who can edit what in the web panel. Owners and staff get their own access levels so helpers can contribute without full control of the server.'
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
			title: 'Booster Rewards',
			desc: 'Reward server boosters with special roles, perks, and recognition. Configure custom benefits for your supporters.'
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
			title: 'Orb enroll',
			desc: 'Orb-eligible quest flows with enroll actions and worker automation so limited-time rewards are not missed.'
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
	<title>Dansday Discord Bot | All in one server management</title>
	<meta
		name="description"
		content="Free and open source Dansday Discord Bot. Add our hosted bot to your server at no cost, or self host from GitHub. Free web panel for leveling, moderation, giveaways, public stats, Discord Quest, TikTok tools, Roblox catalog watch, and more. Free five minute demo on login."
	/>
</svelte:head>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<PublicSiteNav mode="landing" />

	<main class="m-main">
		<div class="m-inner m-landing-inner">
			<!-- Hero -->
			<section class="m-hero">
				<h1>
					Supercharge Your<br />
					<span class="m-gradient-text">Discord Server</span>
				</h1>
				<p>
					Run leveling, moderation, Discord Quests, orb enroll, self-bot options, creator tools, live public statistics pages, Roblox catalog alerts, and more
					from the free web panel in your browser. Configure in one place instead of flooding channels with slash commands.
				</p>
				<p class="m-hero-note">
					Dansday stays <strong>free</strong> for everyone. Self host from
					<a href={sourceRepoUrl} class="m-hero-note-link" target="_blank" rel="noopener noreferrer">GitHub</a>
					when you want your own infrastructure. If you cannot self host, use
					<a href={officialBotInviteUrl} class="m-hero-note-link" target="_blank" rel="noopener noreferrer">our hosted bot</a>
					for the same features on our service at no charge.
				</p>
				<div class="m-hero-actions">
					<a href={officialBotInviteUrl} class="m-btn m-btn--primary" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Get started
					</a>
					<a href="/login" class="m-btn m-btn--ghost">
						<i class="fas fa-sign-in-alt"></i>
						Log in to panel
					</a>
					<a href="#features" class="m-btn m-btn--ghost">
						<i class="fas fa-th-large"></i>
						See all features
					</a>
					<a href={communityDiscordUrl} class="m-btn m-btn--ghost" target="_blank" rel="noopener noreferrer" title="Join our Discord for updates and testing">
						<i class="fas fa-users"></i>
						Join Discord
					</a>
					<a
						href={sourceRepoUrl}
						class="m-btn m-btn--ghost"
						target="_blank"
						rel="noopener noreferrer"
						title="Free and open source on GitHub under the MIT license"
					>
						<i class="fab fa-github"></i>
						GitHub
					</a>
				</div>
			</section>

			<!-- Features -->
			<section class="m-section" id="features">
				<div class="m-section-header">
					<h2>Everything your server needs</h2>
					<p>
						Each module stands on its own. Turn on leveling, Quest notifier, orb enroll, self-bot, forwarder, public statistics, or any mix you need. Everything
						lives under the same server settings.
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

			<!-- Featured servers -->
			{#if data.featuredServers.length > 0}
				<section class="m-section">
					<div class="m-section-header">
						<h2>Active Communities</h2>
						<p>Servers using Dansday Bot with public statistics enabled.</p>
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
			{/if}

			<!-- Web Panel highlight -->
			<section class="m-section">
				<div class="m-section-header">
					<h2>Powerful web panel</h2>
					<p>
						Change settings from your browser without building long slash command workflows. After you sign in you land in the panel. Where a module supports
						it, you get live bot and server state right in the UI.
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

			<!-- CTA -->
			<section class="m-cta">
				<div class="m-cta-card">
					<h2>Ready to try it?</h2>
					<p>
						Add Dansday Bot to your server first for free. Then sign in to the web panel to configure your server. The login screen also offers an optional free
						<strong>five minute demo</strong> with full panel access and no signup.
					</p>
					<div class="m-cta-actions">
						<a href={officialBotInviteUrl} class="m-btn m-btn--primary" target="_blank" rel="noopener noreferrer">
							<i class="fab fa-discord"></i>
							Add Dansday Bot
						</a>
						<a href="/login" class="m-btn m-btn--ghost">
							<i class="fas fa-sign-in-alt"></i>
							Open login
						</a>
					</div>
				</div>
			</section>
		</div>
	</main>

	<PublicSiteFooter />
</div>
