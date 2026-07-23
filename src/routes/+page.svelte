<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import Button from '$lib/frontend/components/Button.svelte';

	let { data }: PageProps = $props();

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

<div class="m-root text-lb-text relative flex flex-col overflow-x-hidden">
	<div class="m-blob pointer-events-none fixed z-0 h-105 w-105 rounded-full opacity-14"></div>
	<div class="m-blob pointer-events-none fixed z-0 h-80 w-80 rounded-full opacity-14"></div>
	<div class="m-blob pointer-events-none fixed z-0 h-65 w-65 rounded-full opacity-14"></div>

	<MainHeader />

	<main class="m-main flex-1 overflow-y-auto">
		<div class="m-inner m-landing-inner relative z-1 mx-auto my-0 max-w-[1280px] min-w-0 flex-1 px-8 pt-8 pb-16">
			<section class="m-hero px-8 pt-18 pb-12 text-center">
				<h1 class="text-lb-text mx-0 mt-0 mb-3.5 text-2xl font-extrabold">
					Supercharge Your<br />
					<span class="from-chili-hot to-chili-peach bg-gradient-to-br bg-clip-text text-transparent">Discord Server</span>
				</h1>
				<p class="text-lb-text-muted mx-auto mt-0 mb-6 w-full text-base">
					Run leveling, moderation, an embed builder, Discord Quests, quest enroll, self-bot options, creator tools, live public statistics pages, Roblox
					catalog alerts, and more from the free web panel in your browser. Configure in one place instead of flooding channels with slash commands. Free for
					everyone. Self-host from
					<a
						href={sourceRepoUrl}
						class="text-lb-text decoration-chili-hot/35 hover:text-chili-hot hover:decoration-chili-hot font-semibold underline underline-offset-[3px] transition-colors"
						target="_blank"
						rel="noopener noreferrer">GitHub</a
					>
					or add
					<a
						href={officialBotInviteUrl}
						class="text-lb-text decoration-chili-hot/35 hover:text-chili-hot hover:decoration-chili-hot font-semibold underline underline-offset-[3px] transition-colors"
						target="_blank"
						rel="noopener noreferrer">our hosted bot</a
					>
					if you do not run your own servers.
				</p>
				<div class="m-hero-actions mx-auto my-0 box-border flex w-full max-w-none flex-col items-stretch gap-4">
					<Button
						href={officialBotInviteUrl}
						variant="primary"
						class="m-hero-btn-primary w-full justify-center px-6 py-3 text-base"
						target="_blank"
						rel="noopener noreferrer"
					>
						<i class="fab fa-discord"></i>
						Get started
					</Button>
					<div class="m-hero-actions-secondary gap-2" role="group" aria-label="More options">
						<Button href="/docs" variant="ghost" compact class="w-full" title="Setup guide and documentation">
							<i class="fas fa-book-open"></i>
							Docs
						</Button>
						<Button href="#features" variant="ghost" compact class="w-full">
							<i class="fas fa-th-large"></i>
							Features
						</Button>
						<Button
							href={communityDiscordUrl}
							variant="ghost"
							compact
							class="w-full"
							target="_blank"
							rel="noopener noreferrer"
							title="Join our Discord for updates and testing"
						>
							<i class="fas fa-users"></i>
							Discord
						</Button>
						<Button href={sourceRepoUrl} variant="ghost" compact class="w-full" target="_blank" rel="noopener noreferrer" title="Source on GitHub (MIT)">
							<i class="fab fa-github"></i>
							GitHub
						</Button>
					</div>
				</div>
			</section>

			<section class="m-section px-8 py-14" id="features">
				<div class="m-section-header mb-7 text-center">
					<h2 class="text-lb-text mx-0 mt-0 mb-2 text-xl font-extrabold">Everything your server needs</h2>
					<p>
						Each module stands on its own. Turn on leveling, embed builder, Quest notifier, quest enroll, self-bot, forwarder, public statistics, or any mix you
						need. Everything lives under the same server settings.
					</p>
				</div>
				<div class="m-features-grid gap-4">
					{#each features as feature}
						<div class="m-feature-card p-6">
							<div class="m-feature-icon m-feature-icon--{feature.tone} mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
								<i class="fas {feature.icon}"></i>
							</div>
							<h3>{feature.title}</h3>
							<p>{feature.desc}</p>
						</div>
					{/each}
				</div>
			</section>

			{#if data.featuredServers.length > 0}
				<section class="m-section px-8 py-14">
					<div class="m-section-header mb-7 text-center">
						<h2 class="text-lb-text mx-0 mt-0 mb-2 text-xl font-extrabold">Active Communities</h2>
						<p class="text-lb-text-muted m-0 text-base">Servers using {APP_NAME} Bot with public statistics enabled.</p>
					</div>
					<div class="m-servers-list grid w-full max-w-none gap-2">
						{#each data.featuredServers as server}
							<a href={publicServerPath(server.slug)} class="m-server-card text-lb-text flex items-center gap-3 rounded-[14px] px-4 py-4 no-underline">
								<div class="m-landing-server-icon flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
									{#if server.server_icon}
										<img src={server.server_icon} alt={server.name} loading="lazy" width="42" height="42" />
									{:else}
										<i class="fas fa-server m-landing-server-icon-placeholder text-lb-text-muted text-lg"></i>
									{/if}
								</div>
								<div class="m-server-info min-w-0 flex-1">
									<div class="m-server-name text-lb-text overflow-hidden text-base font-bold text-ellipsis whitespace-nowrap">{server.name}</div>
									<div class="m-server-sub text-lb-text-muted flex items-center gap-1 text-xs">
										<span class="m-landing-server-live text-lb-text-muted inline-flex items-center gap-2 text-xs" title="Public page uses live data">
											<span class="m-live-dot h-2 w-2 rounded-full"></span>
											Live public statistics
										</span>
									</div>
								</div>
								<i class="fas fa-chevron-right m-server-arrow text-lb-text-faint shrink-0 text-base"></i>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<section class="m-section px-8 py-14">
				<div class="m-section-header mb-7 text-center">
					<h2 class="text-lb-text mx-0 mt-0 mb-2 text-xl font-extrabold">Powerful web panel</h2>
					<p class="text-lb-text-muted m-0 text-base">
						Change settings from your browser without building long slash command workflows. After you sign in you land in the panel. Where a module supports
						it, you get live bot and server state right in the UI.
					</p>
				</div>
				<div class="m-features-grid m-features-grid--quad max-w-none gap-4">
					<div class="m-feature-card p-6">
						<div class="m-feature-icon m-feature-icon--teal text-chili-hot mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
							<i class="fas fa-toggle-on"></i>
						</div>
						<h3>Toggle Features</h3>
						<p>Enable or disable any feature with a single click. Each module is independently configurable.</p>
					</div>
					<div class="m-feature-card p-6">
						<div class="m-feature-icon m-feature-icon--brick text-chili-brick mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
							<i class="fas fa-users-gear"></i>
						</div>
						<h3>Team Access</h3>
						<p>Invite staff members with role-based access. Owners and staff can manage the panel independently.</p>
					</div>
					<div class="m-feature-card p-6">
						<div class="m-feature-icon m-feature-icon--teal text-chili-hot mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
							<i class="fas fa-eye"></i>
						</div>
						<h3>Live Monitoring</h3>
						<p>Watch bot status, uptime, and server statistics in real-time with live streaming updates.</p>
					</div>
					<div class="m-feature-card p-6">
						<div class="m-feature-icon m-feature-icon--brick text-chili-brick mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
							<i class="fas fa-mobile-screen"></i>
						</div>
						<h3>Mobile Ready</h3>
						<p>Full responsive design works on any device. Manage your server from phone, tablet, or desktop.</p>
					</div>
				</div>
			</section>

			<section class="m-cta px-0 pt-9 pb-11 text-center">
				<div class="m-cta-card px-8 py-10">
					<h2 class="text-lb-text mx-0 mt-0 mb-3.5 text-lg font-extrabold">Ready to try it?</h2>
					<p class="text-lb-text-muted mx-0 mt-0 mb-5.5 text-base">
						Add {APP_NAME} Bot to your server first for free. Then sign in to the web panel to configure your server. The login screen also offers an optional free
						<strong>ten minute demo</strong> with full panel access and no signup.
					</p>
					<div class="m-cta-actions mt-1 flex flex-wrap justify-center gap-3">
						<Button href={officialBotInviteUrl} variant="primary" target="_blank" rel="noopener noreferrer">
							<i class="fab fa-discord"></i>
							Add {APP_NAME} Bot
						</Button>
						<Button href="/login" variant="ghost">
							<i class="fas fa-sign-in-alt"></i>
							Open login
						</Button>
						<Button href="/docs" variant="ghost">
							<i class="fas fa-book-open"></i>
							Read the docs
						</Button>
					</div>
				</div>
			</section>
		</div>
	</main>

	<MainFooter />
</div>
