<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath, COMMUNITY_DISCORD_URL, OFFICIAL_BOT_INVITE_URL, SOURCE_REPO_URL } from '$lib/url.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';
	import { FeatureCard, SectionHeader, ServerCard, type BrandTone } from '$lib/frontend/components/landing';

	let { data }: PageProps = $props();

	const SERVERS_PER_PAGE = 5;
	let shownServers = $state(SERVERS_PER_PAGE);
	const visibleServers = $derived(data.featuredServers.slice(0, shownServers));
	const remainingServers = $derived(data.featuredServers.length - visibleServers.length);

	const features: { icon: string; tone: BrandTone; title: string; desc: string }[] = [
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
			desc: 'Discord flows use buttons, selects, and clear labels. Pick English (en), Indonesian (id), German (de) or Spanish (es) for the interface strings, with room to add more languages over time.'
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

	const panelCards: { icon: string; tone: BrandTone; title: string; desc: string }[] = [
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

	const heroLinks = [
		{ href: '/docs', icon: 'fas fa-book-open', label: 'Docs', title: 'Setup guide and documentation', external: false },
		{ href: '#features', icon: 'fas fa-th-large', label: 'Features', title: undefined, external: false },
		{ href: COMMUNITY_DISCORD_URL, icon: 'fas fa-users', label: 'Discord', title: 'Join our Discord for updates and testing', external: true },
		{ href: SOURCE_REPO_URL, icon: 'fab fa-github', label: 'GitHub', title: 'Source on GitHub (MIT)', external: true }
	];
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot | All in one server management</title>
	<meta
		name="description"
		content="Free and open source {APP_NAME} Discord Bot. Add our hosted bot to your server at no cost, or self host from GitHub. Free web panel for leveling, moderation, embed builder, giveaways, public stats, Discord Quest, TikTok tools, Roblox catalog watch, and more. Free ten minute demo on login."
	/>
</svelte:head>

<div class="m-root" data-theme="dansday">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader />

	<main class="m-main">
		<div class="m-inner m-landing-inner">
			<section class="pt-10 pb-8 text-center min-[420px]:pt-12 min-[420px]:pb-9 sm:pt-14 sm:pb-10 lg:pt-18 lg:pb-12">
				<h1 class="text-base-content m-0 mb-3.5 text-[28px] leading-tight font-extrabold tracking-tight min-[420px]:text-[32px] sm:text-[38px] lg:text-[46px]">
					Supercharge Your<br />
					<span class="from-primary to-accent bg-linear-to-br bg-clip-text text-transparent">Discord Server</span>
				</h1>
				<p class="text-base-content/60 mx-auto mb-6 text-[15px] leading-relaxed sm:text-base">
					Run leveling, moderation, an embed builder, Discord Quests, quest enroll, self-bot options, creator tools, live public statistics pages, Roblox
					catalog alerts, and more from the free web panel in your browser. Configure in one place instead of flooding channels with slash commands. Free for
					everyone. Self-host from
					<a
						href={SOURCE_REPO_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="link text-base-content decoration-primary/35 hover:text-primary font-semibold underline-offset-[3px]">GitHub</a
					>
					or add
					<a
						href={OFFICIAL_BOT_INVITE_URL}
						target="_blank"
						rel="noopener noreferrer"
						class="link text-base-content decoration-primary/35 hover:text-primary font-semibold underline-offset-[3px]">our hosted bot</a
					>
					if you do not run your own servers.
				</p>

				<div class="flex flex-col items-stretch gap-3.5">
					<a href={OFFICIAL_BOT_INVITE_URL} class="btn btn-primary btn-block" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Get started
					</a>
					<div class="grid grid-cols-2 gap-2" role="group" aria-label="More options">
						{#each heroLinks as link}
							<a
								href={link.href}
								class="btn btn-sm"
								title={link.title}
								target={link.external ? '_blank' : undefined}
								rel={link.external ? 'noopener noreferrer' : undefined}
							>
								<i class={link.icon}></i>
								{link.label}
							</a>
						{/each}
					</div>
				</div>
			</section>

			<section class="py-9 sm:py-11 lg:py-14" id="features">
				<SectionHeader
					title="Everything your server needs"
					desc="Each module stands on its own. Turn on leveling, embed builder, Quest notifier, quest enroll, self-bot, forwarder, public statistics, or any mix you need. Everything lives under the same server settings."
				/>
				<div class="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
					{#each features as feature}
						<FeatureCard icon={feature.icon} title={feature.title} desc={feature.desc} tone={feature.tone} />
					{/each}
				</div>
			</section>

			{#if data.featuredServers.length > 0}
				<section class="py-9 sm:py-11 lg:py-14">
					<SectionHeader title="Active Communities" desc="Servers using {APP_NAME} Bot, each with its own live public pages." />
					<div class="grid grid-cols-1 gap-2.5">
						{#each visibleServers as server}
							<ServerCard href={publicServerPath(server.slug)} name={server.name} icon={server.server_icon} />
						{/each}
					</div>
					{#if remainingServers > 0}
						<button type="button" class="btn btn-block text-base-content/60 mt-2.5 font-medium" onclick={() => (shownServers += SERVERS_PER_PAGE)}>
							<i class="fas fa-chevron-down"></i>
							Show more ({remainingServers} left)
						</button>
					{/if}
				</section>
			{/if}

			<section class="py-9 sm:py-11 lg:py-14">
				<SectionHeader
					title="Powerful web panel"
					desc="Change settings from your browser without building long slash command workflows. After you sign in you land in the panel. Where a module supports it, you get live bot and server state right in the UI."
				/>
				<div class="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
					{#each panelCards as card}
						<FeatureCard icon={card.icon} title={card.title} desc={card.desc} tone={card.tone} />
					{/each}
				</div>
			</section>

			<section class="pt-9 pb-11">
				<div class="card from-primary/8 to-secondary/6 border-base-300 border bg-linear-to-br shadow-sm">
					<div class="card-body items-center gap-0 p-7 text-center sm:p-10">
						<h2 class="text-base-content mb-3.5 text-xl font-extrabold tracking-tight">Ready to try it?</h2>
						<p class="text-base-content/60 mb-5 text-sm leading-relaxed">
							Add {APP_NAME} Bot to your server first for free. Then sign in to the web panel to configure your server. The login screen also offers an optional free
							<strong class="text-base-content font-semibold">ten minute demo</strong> with full panel access and no signup.
						</p>
						<div class="flex flex-wrap justify-center gap-3">
							<a href={OFFICIAL_BOT_INVITE_URL} class="btn btn-primary" target="_blank" rel="noopener noreferrer">
								<i class="fab fa-discord"></i>
								Add {APP_NAME} Bot
							</a>
							<a href="/login" class="btn">
								<i class="fas fa-sign-in-alt"></i>
								Open login
							</a>
							<a href="/docs" class="btn">
								<i class="fas fa-book-open"></i>
								Read the docs
							</a>
						</div>
					</div>
				</div>
			</section>
		</div>
	</main>

	<MainFooter />
</div>
