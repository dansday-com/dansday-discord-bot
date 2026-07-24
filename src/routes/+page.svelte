<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import Button from '$lib/frontend/components/Button.svelte';
	import FeatureCard from '$lib/frontend/components/FeatureCard.svelte';
	import SectionHeader from '$lib/frontend/components/SectionHeader.svelte';

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

	const panelFeatures = [
		{
			icon: 'fa-toggle-on',
			tone: 'teal',
			title: 'Toggle Features',
			desc: 'Enable or disable any feature with a single click. Each module is independently configurable.'
		},
		{
			icon: 'fa-users-gear',
			tone: 'brick',
			title: 'Team Access',
			desc: 'Invite staff members with role-based access. Owners and staff can manage the panel independently.'
		},
		{
			icon: 'fa-eye',
			tone: 'teal',
			title: 'Live Monitoring',
			desc: 'Watch bot status, uptime, and server statistics in real-time with live streaming updates.'
		},
		{
			icon: 'fa-mobile-screen',
			tone: 'brick',
			title: 'Mobile Ready',
			desc: 'Full responsive design works on any device. Manage your server from phone, tablet, or desktop.'
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

<div class="m-root text-lb-text relative flex min-h-dvh flex-col overflow-x-hidden">
	<div class="m-blob m-blob-1 pointer-events-none fixed z-0 h-105 w-105 rounded-full opacity-15"></div>
	<div class="m-blob m-blob-2 pointer-events-none fixed z-0 h-80 w-80 rounded-full opacity-15"></div>
	<div class="m-blob m-blob-3 pointer-events-none fixed z-0 h-65 w-65 rounded-full opacity-15"></div>

	<MainHeader />

	<main class="flex-1 overflow-y-auto">
		<div class="relative z-1 mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 pt-4 pb-12 lg:px-8">
			<section class="pt-10 pb-8 text-center lg:pt-18 lg:pb-12">
				<h1 class="text-lb-text m-0 mb-4 text-2xl font-extrabold lg:text-4xl">
					Supercharge Your<br />
					<span class="from-chili-hot to-chili-peach bg-linear-to-br bg-clip-text text-transparent">Discord Server</span>
				</h1>
				<p class="text-lb-text-muted mx-auto mt-0 mb-6 w-full text-base">
					Run leveling, moderation, an embed builder, Discord Quests, quest enroll, self-bot options, creator tools, live public statistics pages, Roblox
					catalog alerts, and more from the free web panel in your browser. Configure in one place instead of flooding channels with slash commands. Free for
					everyone. Self-host from
					<a
						href={sourceRepoUrl}
						class="text-lb-text decoration-chili-hot/35 hover:text-chili-hot hover:decoration-chili-hot font-semibold underline underline-offset-4 transition-colors"
						target="_blank"
						rel="noopener noreferrer">GitHub</a
					>
					or add
					<a
						href={officialBotInviteUrl}
						class="text-lb-text decoration-chili-hot/35 hover:text-chili-hot hover:decoration-chili-hot font-semibold underline underline-offset-4 transition-colors"
						target="_blank"
						rel="noopener noreferrer">our hosted bot</a
					>
					if you do not run your own servers.
				</p>
				<div class="mx-auto flex w-full flex-col items-stretch gap-4">
					<Button href={officialBotInviteUrl} variant="primary" class="w-full" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Get started
					</Button>
					<div class="m-hero-actions-secondary flex flex-wrap gap-2 lg:gap-3" role="group" aria-label="More options">
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

			<section class="py-10 lg:py-14" id="features">
				<SectionHeader title="Everything your server needs">
					Each module stands on its own. Turn on leveling, embed builder, Quest notifier, quest enroll, self-bot, forwarder, public statistics, or any mix you
					need. Everything lives under the same server settings.
				</SectionHeader>
				<div class="m-features-grid flex flex-wrap gap-4">
					{#each features as feature}
						<FeatureCard icon={feature.icon} tone={feature.tone as 'teal' | 'brick' | 'stone'} title={feature.title} desc={feature.desc} />
					{/each}
				</div>
			</section>

			{#if data.featuredServers.length > 0}
				<section class="py-10 lg:py-14">
					<SectionHeader title="Active Communities">Servers using {APP_NAME} Bot with public statistics enabled.</SectionHeader>
					<div class="flex flex-col gap-3">
						{#each data.featuredServers as server}
							<a
								href={publicServerPath(server.slug)}
								class="bg-chili-surface-elevated border-lb-border text-lb-text hover:border-chili-hot/28 flex items-center gap-3 rounded-2xl border px-4 py-4 no-underline shadow-[0_4px_16px_var(--color-lb-shadow)] transition-transform duration-150 hover:-translate-y-px"
							>
								<div class="border-lb-border-light flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white/95">
									{#if server.server_icon}
										<img src={server.server_icon} alt={server.name} loading="lazy" width="44" height="44" class="h-full w-full object-cover" />
									{:else}
										<i class="fas fa-server text-lb-text-muted text-lg"></i>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<div class="text-lb-text overflow-hidden text-base font-bold text-ellipsis whitespace-nowrap">{server.name}</div>
									<div class="text-lb-text-muted flex items-center gap-1 text-xs">
										<span class="inline-flex items-center gap-2" title="Public page uses live data">
											<span class="m-live-dot h-2 w-2 rounded-full"></span>
											Live public statistics
										</span>
									</div>
								</div>
								<i class="fas fa-chevron-right text-lb-text-faint shrink-0 text-base"></i>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<section class="py-10 lg:py-14">
				<SectionHeader title="Powerful web panel">
					Change settings from your browser without building long slash command workflows. After you sign in you land in the panel. Where a module supports it,
					you get live bot and server state right in the UI.
				</SectionHeader>
				<div class="m-features-grid m-features-grid--quad flex flex-wrap gap-4">
					{#each panelFeatures as feature}
						<FeatureCard icon={feature.icon} tone={feature.tone as 'teal' | 'brick'} title={feature.title} desc={feature.desc} />
					{/each}
				</div>
			</section>

			<section class="pt-9 pb-11 text-center">
				<div
					class="border-lb-border from-chili-hot/8 to-chili-brick/6 w-full rounded-3xl border bg-linear-to-br px-5 py-7 shadow-[0_4px_24px_var(--color-lb-shadow)] lg:px-8 lg:py-8"
				>
					<h2 class="text-lb-text m-0 mb-4 text-lg font-extrabold lg:text-xl">Ready to try it?</h2>
					<p class="text-lb-text-muted m-0 mb-6 text-base">
						Add {APP_NAME} Bot to your server first for free. Then sign in to the web panel to configure your server. The login screen also offers an optional free
						<strong>ten minute demo</strong> with full panel access and no signup.
					</p>
					<div class="flex flex-col items-stretch justify-center gap-3 lg:flex-row lg:flex-wrap lg:items-center">
						<Button href={officialBotInviteUrl} variant="primary" class="w-full lg:w-auto lg:min-w-44" target="_blank" rel="noopener noreferrer">
							<i class="fab fa-discord"></i>
							Add {APP_NAME} Bot
						</Button>
						<Button href="/login" variant="ghost" class="w-full lg:w-auto lg:min-w-44">
							<i class="fas fa-sign-in-alt"></i>
							Open login
						</Button>
						<Button href="/docs" variant="ghost" class="w-full lg:w-auto lg:min-w-44">
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
