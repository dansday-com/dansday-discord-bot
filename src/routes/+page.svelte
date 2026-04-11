<script lang="ts">
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/publicSiteUrls.js';
	import './main.css';

	let { data }: PageProps = $props();

	const features = [
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
			icon: 'fa-forward',
			tone: 'stone',
			title: 'Message Forwarder',
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
	<meta name="description" content="Manage your Discord server with leveling, moderation, welcomer, giveaways, public statistics, and more. Free, feature-rich bot with a powerful web panel." />
</svelte:head>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<nav class="m-nav">
		<div class="m-nav-inner">
			<a href="/" class="m-nav-brand">
				<div class="m-nav-icon">
					<i class="fas fa-bolt"></i>
				</div>
				<span>Dansday Bot</span>
			</a>
			<div class="m-nav-actions">
				<a href="/login" class="m-btn m-btn--ghost">
					<i class="fas fa-sign-in-alt"></i>
					Login
				</a>
				<a href="/login" class="m-btn m-btn--primary">
					Dashboard
				</a>
			</div>
		</div>
	</nav>

	<div class="m-landing-inner">
		<!-- Hero -->
		<section class="m-hero">
			<div class="m-hero-badge">
				<i class="fas fa-bolt"></i>
				All-in-One Discord Bot
			</div>
			<h1>
				Supercharge Your<br />
				<span class="m-gradient-text">Discord Server</span>
			</h1>
			<p>
				Leveling, moderation, welcomer, giveaways, public statistics, and 12+ features - all managed from a single web panel.
			</p>
			<div class="m-hero-actions">
				<a href="/login" class="m-btn m-btn--primary">
					<i class="fas fa-rocket"></i>
					Get Started
				</a>
				<a href="#features" class="m-btn m-btn--ghost">
					<i class="fas fa-th-large"></i>
					Explore Features
				</a>
			</div>
		</section>

		<!-- Quick stats strip -->
		<div class="m-stats-strip">
			<div class="m-stat-chip">
				<div class="m-stat-icon"><i class="fas fa-puzzle-piece"></i></div>
				<div class="m-stat-text">
					<span class="m-stat-value">15+</span>
					<span class="m-stat-label">Features</span>
				</div>
			</div>
			<div class="m-stat-chip">
				<div class="m-stat-icon"><i class="fas fa-sliders-h"></i></div>
				<div class="m-stat-text">
					<span class="m-stat-value">Web</span>
					<span class="m-stat-label">Panel</span>
				</div>
			</div>
			<div class="m-stat-chip">
				<div class="m-stat-icon"><i class="fas fa-chart-pie"></i></div>
				<div class="m-stat-text">
					<span class="m-stat-value">Live</span>
					<span class="m-stat-label">Statistics</span>
				</div>
			</div>
			<div class="m-stat-chip">
				<div class="m-stat-icon"><i class="fas fa-shield-halved"></i></div>
				<div class="m-stat-text">
					<span class="m-stat-value">Full</span>
					<span class="m-stat-label">Control</span>
				</div>
			</div>
		</div>

		<!-- Features -->
		<section class="m-section" id="features">
			<div class="m-section-header">
				<h2>Everything Your Server Needs</h2>
				<p>Packed with powerful features, all configurable from one dashboard.</p>
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
									<i class="fas fa-chart-bar"></i>
									View public statistics
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
				<h2>Powerful Web Panel</h2>
				<p>Configure everything from your browser. No commands needed.</p>
			</div>
			<div class="m-features-grid" style="max-width: 720px; margin: 0 auto;">
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
				<h2>Ready to Level Up Your Server?</h2>
				<p>Access the dashboard and start configuring your bot today.</p>
				<a href="/login" class="m-btn m-btn--primary">
					<i class="fas fa-arrow-right"></i>
					Go to Dashboard
				</a>
			</div>
		</section>
	</div>

	<footer class="m-footer">
		<p>
			Copyright &copy; {new Date().getFullYear()}
			<a href="https://dansday.com" target="_blank" rel="noopener">dansday.com</a>. All rights reserved.
		</p>
	</footer>
</div>
