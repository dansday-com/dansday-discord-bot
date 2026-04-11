<script lang="ts">
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/publicSiteUrls.js';
	import PublicSiteNav from '$lib/components/PublicSiteNav.svelte';
	import PublicSiteFooter from '$lib/components/PublicSiteFooter.svelte';
	import './main.css';

	let { data }: PageProps = $props();

	const features = [
		{
			icon: 'fa-shield-halved',
			tone: 'stone',
			title: 'Panel permissions',
			desc: 'Control who can change what in the web panel — separate owner and staff access so your team can help without handing over the whole server.'
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
			desc: 'Surfaces Discord Quest home activity in your server: alerts when new quests appear and context for what to run next.'
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
			desc: 'Invite owners and staff to the panel with controlled roles — separate from Discord permissions for day-to-day chatting.'
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
			desc: 'Monitor Roblox catalog changes and post rich embeds when items update — ideal for trading and UGC communities.'
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
	<title>Dansday Discord Bot - All-in-One Server Management</title>
	<meta
		name="description"
		content="Dansday Discord Bot: leveling, moderation, welcomer, giveaways, public live stats, Discord Quest & orb enroll, self-bot & accounts, TikTok creator tools, Roblox catalog watch, and more. Try the full web panel free for 5 minutes — demo login, no account required."
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
				<div class="m-hero-badge">
					<i class="fas fa-layer-group"></i>
					Modular features · One web panel
				</div>
				<h1>
					Supercharge Your<br />
					<span class="m-gradient-text">Discord Server</span>
				</h1>
				<p>
					Leveling, moderation, Discord Quests, orb enroll, self-bot options, creator tools, live public statistics pages, Roblox catalog alerts, and more —
					tuned from the browser instead of scattering slash commands across every channel.
				</p>
				<div class="m-hero-actions">
					<a href="/login" class="m-btn m-btn--primary">
						<i class="fas fa-sign-in-alt"></i>
						Get started
					</a>
					<a href="#features" class="m-btn m-btn--ghost">
						<i class="fas fa-th-large"></i>
						See all features
					</a>
				</div>
			</section>

			<!-- Metric strip (same scroll pattern as public statistics overview) -->
			<section class="m-overview-strip m-landing-at-glance" aria-label="At a glance">
				<div class="m-overview-strip-item">
					<div class="m-overview-strip-icon"><i class="fas fa-puzzle-piece"></i></div>
					<div class="m-overview-strip-text">
						<span class="m-overview-strip-value">15+</span>
						<span class="m-overview-strip-label">Modules</span>
					</div>
				</div>
				<div class="m-overview-strip-item">
					<div class="m-overview-strip-icon"><i class="fas fa-sliders-h"></i></div>
					<div class="m-overview-strip-text">
						<span class="m-overview-strip-value">Web</span>
						<span class="m-overview-strip-label">Panel</span>
					</div>
				</div>
				<div class="m-overview-strip-item">
					<div class="m-overview-strip-icon"><i class="fas fa-signal"></i></div>
					<div class="m-overview-strip-text">
						<span class="m-overview-strip-value">Live</span>
						<span class="m-overview-strip-label">Public stats</span>
					</div>
				</div>
				<div class="m-overview-strip-item">
					<div class="m-overview-strip-icon"><i class="fas fa-shield-halved"></i></div>
					<div class="m-overview-strip-text">
						<span class="m-overview-strip-value">Full</span>
						<span class="m-overview-strip-label">Control</span>
					</div>
				</div>
			</section>

			<!-- Features -->
			<section class="m-section" id="features">
				<div class="m-section-header">
					<h2>Everything your server needs</h2>
					<p>
						Each module is independent: turn on leveling, Quest notifier, orb enroll, self-bot, forwarder, public statistics, or any combination — all from the
						same server settings.
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
						Configure everything from your browser — no slash-command setup required. You open the panel directly after sign-in; stream live bot and server
						state where modules support it.
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
						Already added the bot? Sign in with your server account. New here? The login screen includes an optional <strong>five-minute demo</strong> — full panel
						access, no signup.
					</p>
					<a href="/login" class="m-btn m-btn--primary">
						<i class="fas fa-sign-in-alt"></i>
						Open login
					</a>
				</div>
			</section>
		</div>
	</main>

	<PublicSiteFooter />
</div>
