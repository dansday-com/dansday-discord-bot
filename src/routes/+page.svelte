<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath, COMMUNITY_DISCORD_URL, OFFICIAL_BOT_INVITE_URL, SOURCE_REPO_URL } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	let { data }: PageProps = $props();

	const SERVERS_PER_PAGE = 5;
	let shownServers = $state(SERVERS_PER_PAGE);
	const visibleServers = $derived(data.featuredServers.slice(0, shownServers));
	const remainingServers = $derived(data.featuredServers.length - visibleServers.length);

	const features = [
		{ icon: 'fa-terminal', title: 'One-command setup', desc: '/setup builds every channel and wires each module to it.' },
		{ icon: 'fa-sliders', title: 'Web panel', desc: 'Every module configured in the browser. No slash command trees.' },
		{ icon: 'fa-shield-halved', title: 'Panel permissions', desc: 'Owner and staff tiers decide who can change what.' },
		{ icon: 'fa-id-card', title: 'Server accounts', desc: "Invite your team with roles separate from Discord's." },
		{ icon: 'fa-chart-line', title: 'Leveling & XP', desc: 'Messages and voice feed levels, role rewards and leaderboards.' },
		{ icon: 'fa-store', title: 'Items & XP economy', desc: 'A shop priced in XP, a 50-slot bag, thirteen effects from steal to luck.' },
		{ icon: 'fa-coins', title: 'Assets market', desc: 'Park XP in live crypto prices and sell any time. No real money.' },
		{ icon: 'fa-dice', title: 'Minigames', desc: 'Wager XP above your level, so a loss never costs a level.' },
		{ icon: 'fa-list-check', title: 'Tasks & streaks', desc: 'Eighteen daily and eighteen weekly, sized per member. No admin setup.' },
		{ icon: 'fa-calendar-check', title: 'Check-in', desc: 'A seven-day cycle, one claim a local day, up to 50,000 XP.' },
		{ icon: 'fa-chart-pie', title: 'Public pages', desc: 'Statistics, leaderboard and members, live and open to everyone.' },
		{ icon: 'fa-user', title: 'Member accounts', desc: 'Each member gets their own page, history and shareable card.' },
		{ icon: 'fa-palette', title: 'Embed builder', desc: 'Live preview, placeholders and images. Send from the browser.' },
		{ icon: 'fa-hand', title: 'Welcomer', desc: 'Custom join messages and embeds for every newcomer.' },
		{ icon: 'fa-gift', title: 'Giveaways', desc: 'Entries, winner picking and role-based eligibility.' },
		{ icon: 'fa-gavel', title: 'Moderation', desc: 'Warnings, mutes, bans and staff actions from one panel.' },
		{ icon: 'fa-clipboard-check', title: 'Staff rating', desc: 'Structured staff evaluation tied to moderation.' },
		{ icon: 'fa-moon', title: 'AFK', desc: 'Members set a status; the bot warns whoever mentions them.' },
		{ icon: 'fa-gem', title: 'Boost messages', desc: 'Thank Nitro boosters with your own channels and templates.' },
		{ icon: 'fa-star', title: 'Custom supporter roles', desc: 'Supporters name and color their own role, inside your rules.' },
		{ icon: 'fa-comment-dots', title: 'Feedback', desc: 'Collect suggestions and requests through Discord flows.' },
		{ icon: 'fa-forward', title: 'Message forwarder', desc: 'Mirror or sync messages across channels and servers.' },
		{ icon: 'fa-bell', title: 'Channel notifications', desc: 'Alerts for the channel activity that actually matters.' },
		{ icon: 'fa-scroll', title: 'Discord Quest', desc: 'Quest alerts, with optional per-server enrollment automation.' },
		{ icon: 'fa-cube', title: 'Roblox catalog watch', desc: 'Embeds when catalog items change. Built for trading and UGC.' },
		{ icon: 'fa-video', title: 'Content creator', desc: 'Creator applications, approvals and TikTok live digests.' },
		{ icon: 'fa-language', title: 'Multi-language', desc: 'English, Indonesian, German and Spanish across Discord flows.' },
		{ icon: 'fa-user-astronaut', title: 'Self-bot path', desc: 'Optional, panel-managed tokens for forwarder and quest flows.' },
		{ icon: 'fa-wand-magic-sparkles', title: 'AI assistant', desc: 'Optional. Bring your own endpoint and key, or leave it switched off.' }
	];

	const panel = [
		{ title: 'Toggle features', desc: 'Every module sits on its own switch, per server.' },
		{ title: 'Team access', desc: 'Owners and staff manage the panel side by side.' },
		{ title: 'Live monitoring', desc: 'Bot status, uptime and server totals, streaming live.' },
		{ title: 'Mobile ready', desc: 'Phone, tablet or desktop. The same panel.' }
	];
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot | All in one server management</title>
	<meta
		name="description"
		content="Free and open source {APP_NAME} Discord Bot. Add our hosted bot to your server at no cost, or self host from GitHub. Free web panel for leveling, an XP economy, moderation, embed builder, giveaways, public stats, Discord Quest, TikTok tools, Roblox catalog watch, and more. Free ten minute demo on login."
	/>
</svelte:head>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader />

	<main class="m-main">
		<div class="m-inner m-landing-inner m-lp">
			<section class="m-lp-hero">
				<p class="m-lp-rule" aria-hidden="true"><span></span><span></span><span></span></p>

				<div class="m-lp-cols">
					<p>
						{APP_NAME} is a free, open source Discord bot with a web panel — built for servers that outgrew slash commands.
					</p>
					<p>
						Leveling, an XP economy, moderation, embeds, giveaways, live public pages and integrations. Every module switches on by itself, all under one
						server's settings.
					</p>
					<p class="m-lp-cols-links">
						<a href={OFFICIAL_BOT_INVITE_URL} target="_blank" rel="noopener noreferrer">Add the hosted bot</a>
						<a href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer">Self-host from GitHub</a>
						<a href="/docs">Read the docs</a>
						<a href={COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer">Join the Discord</a>
					</p>
				</div>

				<h1 class="m-lp-display">
					<span class="m-lp-display-line" style="--ch: 9">One panel</span>
					<span class="m-lp-display-line" style="--ch: 12">Every module</span>
				</h1>

				<div class="m-lp-actions">
					<a href={OFFICIAL_BOT_INVITE_URL} class="m-lp-btn m-lp-btn--solid" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Get started
					</a>
					<a href="/login" class="m-lp-btn">
						<i class="fas fa-arrow-right-to-bracket"></i>
						Open the panel
					</a>
					<a href="#features" class="m-lp-btn">
						<i class="fas fa-arrow-down"></i>
						All modules
					</a>
				</div>

				<p class="m-lp-meta">Free forever · MIT licensed · Hosted or self-hosted · Ten minute demo, no signup</p>
			</section>

			<section class="m-lp-sec" id="features">
				<div class="m-lp-sec-head">
					<p class="m-lp-eyebrow">01 — Modules</p>
					<h2>Everything your server needs</h2>
					<p class="m-lp-lead">Each one stands on its own. Turn on what you need and ignore the rest.</p>
				</div>
				<ol class="m-lp-list">
					{#each features as feature, i}
						<li class="m-lp-row">
							<span class="m-lp-row-num">{String(i + 1).padStart(2, '0')}</span>
							<span class="m-lp-row-body">
								<span class="m-lp-row-title">
									<i class="fas {feature.icon}"></i>
									{feature.title}
								</span>
								<span class="m-lp-row-desc">{feature.desc}</span>
							</span>
						</li>
					{/each}
				</ol>
			</section>

			{#if data.featuredServers.length > 0}
				<section class="m-lp-sec">
					<div class="m-lp-sec-head">
						<p class="m-lp-eyebrow">02 — Communities</p>
						<h2>Servers running it now</h2>
						<p class="m-lp-lead">Each one with its own live public pages. No login needed.</p>
					</div>
					<div class="m-lp-list">
						{#each visibleServers as server}
							<a href={publicServerPath(server.slug)} class="m-lp-row m-lp-row--link">
								<span class="m-lp-row-icon">
									{#if server.server_icon}
										<img src={server.server_icon} alt={server.name} loading="lazy" width="34" height="34" />
									{:else}
										<i class="fas fa-server"></i>
									{/if}
								</span>
								<span class="m-lp-row-body">
									<span class="m-lp-row-title">{server.name}</span>
									<span class="m-lp-row-desc">
										<span class="m-live-dot"></span>
										Live public statistics
									</span>
								</span>
								<i class="fas fa-arrow-right m-lp-row-go"></i>
							</a>
						{/each}
					</div>
					{#if remainingServers > 0}
						<button type="button" class="m-lp-more" onclick={() => (shownServers += SERVERS_PER_PAGE)}>
							Show more ({remainingServers} left)
							<i class="fas fa-arrow-down"></i>
						</button>
					{/if}
				</section>
			{/if}

			<section class="m-lp-sec">
				<div class="m-lp-sec-head">
					<p class="m-lp-eyebrow">03 — The panel</p>
					<h2>Configured in a browser</h2>
					<p class="m-lp-lead">Sign in and you land in the panel. Where a module supports it, you see live bot and server state as it happens.</p>
				</div>
				<div class="m-lp-cols m-lp-cols--quad">
					{#each panel as item}
						<p>
							<strong>{item.title}</strong>
							{item.desc}
						</p>
					{/each}
				</div>
			</section>

			<section class="m-lp-band">
				<p class="m-lp-eyebrow">04 — Start</p>
				<p class="m-lp-display">
					<span class="m-lp-display-line" style="--ch: 10">Ready to go</span>
				</p>
				<p class="m-lp-band-copy">
					Add {APP_NAME} Bot to your server first, then sign in to configure it. The login screen also offers a free
					<strong>ten minute demo</strong> with full panel access and no signup.
				</p>
				<div class="m-lp-actions">
					<a href={OFFICIAL_BOT_INVITE_URL} class="m-lp-btn m-lp-btn--invert" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Add {APP_NAME} Bot
					</a>
					<a href="/login" class="m-lp-btn m-lp-btn--onband">
						<i class="fas fa-arrow-right-to-bracket"></i>
						Open login
					</a>
					<a href="/docs" class="m-lp-btn m-lp-btn--onband">
						<i class="fas fa-book-open"></i>
						Read the docs
					</a>
				</div>
			</section>
		</div>
	</main>

	<MainFooter />
</div>
