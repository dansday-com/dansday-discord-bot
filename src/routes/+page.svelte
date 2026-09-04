<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import type { PageProps } from './$types';
	import { publicServerPath, COMMUNITY_DISCORD_URL, OFFICIAL_BOT_INVITE_URL, SOURCE_REPO_URL } from '$lib/url.js';
	import { PageShell } from '$lib/frontend/components/shell';

	let { data }: PageProps = $props();

	const SERVERS_PER_PAGE = 5;
	let shownServers = $state(SERVERS_PER_PAGE);
	const visibleServers = $derived(data.featuredServers.slice(0, shownServers));
	const remainingServers = $derived(data.featuredServers.length - visibleServers.length);

	const ICON_TONES = ['text-primary', 'text-secondary', 'text-brand-gold-deep'];

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

	const EYEBROW = 'text-primary mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase';
	const H2 = 'text-base-content mb-2.5 text-[clamp(26px,6.2cqw,58px)] leading-[0.98] font-black tracking-[-0.035em] uppercase';
	const LEAD = 'text-base-content/60 max-w-[54ch] text-[13.5px] leading-[1.55]';
	const BTN = 'btn rounded-sm text-[11.5px] font-extrabold tracking-[0.1em] uppercase';
</script>

<svelte:head>
	<title>{APP_NAME} Discord Bot | All in one server management</title>
	<meta
		name="description"
		content="Free and open source {APP_NAME} Discord Bot. Add our hosted bot to your server at no cost, or self host from GitHub. Free web panel for leveling, an XP economy, moderation, embed builder, giveaways, public stats, Discord Quest, TikTok tools, Roblox catalog watch, and more. Free ten minute demo on login."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

<PageShell>
	<div class="@container">
		<section class="pt-1.5 pb-9 sm:pt-2.5 sm:pb-11 lg:pt-3.5 lg:pb-14">
			<p class="bg-base-300 mb-6 flex h-px items-center justify-between" aria-hidden="true">
				<span class="bg-primary size-2.5 shrink-0 rounded-full"></span>
				<span class="bg-primary size-2.5 shrink-0 rounded-full"></span>
				<span class="bg-primary size-2.5 shrink-0 rounded-full"></span>
			</p>

			<div class="mb-8 grid grid-cols-1 gap-4.5 sm:grid-cols-3 sm:gap-6">
				<p class="text-primary max-w-[36ch] text-[12.5px] leading-[1.5]">
					{APP_NAME} is a free, open source Discord bot with a web panel — built for servers that outgrew slash commands.
				</p>
				<p class="text-primary max-w-[36ch] text-[12.5px] leading-[1.5]">
					Leveling, an XP economy, moderation, embeds, giveaways, live public pages and integrations. Every module switches on by itself, all under one server's
					settings.
				</p>
				<p class="text-primary flex max-w-[36ch] flex-col gap-1.5 text-[12.5px] leading-[1.5]">
					<a href={OFFICIAL_BOT_INVITE_URL} target="_blank" rel="noopener noreferrer" class="hover:text-accent w-fit underline underline-offset-[3px]">
						Add the hosted bot
					</a>
					<a href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer" class="hover:text-accent w-fit underline underline-offset-[3px]">
						Self-host from GitHub
					</a>
					<a href="/docs" class="hover:text-accent w-fit underline underline-offset-[3px]">Read the docs</a>
					<a href={COMMUNITY_DISCORD_URL} target="_blank" rel="noopener noreferrer" class="hover:text-accent w-fit underline underline-offset-[3px]">
						Join the Discord
					</a>
				</p>
			</div>

			<h1 class="font-black">
				<span class="display-line text-primary block whitespace-nowrap uppercase" style="--ch: 9">One panel</span>
				<span class="display-line text-primary block whitespace-nowrap uppercase" style="--ch: 12">Every module</span>
			</h1>

			<div class="mt-7 flex flex-wrap gap-2">
				<a href={OFFICIAL_BOT_INVITE_URL} class="{BTN} btn-primary" target="_blank" rel="noopener noreferrer">
					<i class="fab fa-discord"></i>
					Get started
				</a>
				<a href="/login" class="{BTN} btn-outline btn-primary">
					<i class="fas fa-arrow-right-to-bracket"></i>
					Open the panel
				</a>
				<a href="#features" class="{BTN} btn-outline btn-primary">
					<i class="fas fa-arrow-down"></i>
					All modules
				</a>
			</div>

			<p class="text-base-content/45 mt-5.5 text-[10px] font-bold tracking-[0.14em] uppercase">
				Free forever · MIT licensed · Hosted or self-hosted · Ten minute demo, no signup
			</p>
		</section>

		<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16" id="features">
			<div class="mb-6">
				<p class={EYEBROW}>01 — Modules</p>
				<h2 class={H2}>Everything your server needs</h2>
				<p class={LEAD}>Each one stands on its own. Turn on what you need and ignore the rest.</p>
			</div>
			<ol class="border-base-300 grid grid-cols-1 border-t lg:grid-cols-2 lg:gap-x-11">
				{#each features as feature, i}
					<li class="border-base-300 grid grid-cols-[2.2rem_1fr] items-start gap-3 border-b px-0.5 py-3.5">
						<span class="text-primary/70 text-[10.5px] leading-[1.32] font-extrabold tracking-[0.08em] tabular-nums">
							{String(i + 1).padStart(2, '0')}
						</span>
						<span class="min-w-0">
							<span class="text-base-content flex items-center gap-2 text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase">
								<i class="fas {feature.icon} text-[11px] {ICON_TONES[i % ICON_TONES.length]}"></i>
								{feature.title}
							</span>
							<span class="text-base-content/60 mt-1 block text-[12.5px] leading-[1.5]">{feature.desc}</span>
						</span>
					</li>
				{/each}
			</ol>
		</section>

		{#if data.featuredServers.length > 0}
			<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
				<div class="mb-6">
					<p class={EYEBROW}>02 — Communities</p>
					<h2 class={H2}>Servers running it now</h2>
					<p class={LEAD}>Each one with its own live public pages. No login needed.</p>
				</div>
				<div class="border-base-300 grid grid-cols-1 border-t">
					{#each visibleServers as server}
						<a href={publicServerPath(server.slug)} class="group border-base-300 grid grid-cols-[34px_1fr_auto] items-center gap-3 border-b px-0.5 py-3">
							<span class="bg-base-200 text-primary grid size-[34px] place-items-center overflow-hidden rounded-sm text-[13px]">
								{#if server.server_icon}
									<img src={server.server_icon} alt={server.name} loading="lazy" width="34" height="34" class="size-full object-cover" />
								{:else}
									<i class="fas fa-server"></i>
								{/if}
							</span>
							<span class="min-w-0">
								<span
									class="text-base-content group-hover:text-primary block truncate text-[13px] leading-[1.32] font-extrabold tracking-[0.02em] uppercase transition-colors"
								>
									{server.name}
								</span>
								<span class="text-base-content/60 mt-1 flex items-center gap-1.5 text-[12.5px] leading-[1.5]">
									<span class="bg-primary size-1.5 rounded-full"></span>
									Live public statistics
								</span>
							</span>
							<i class="fas fa-arrow-right text-primary text-[12px] transition-transform group-hover:translate-x-0.5"></i>
						</a>
					{/each}
				</div>
				{#if remainingServers > 0}
					<button
						type="button"
						class="text-primary hover:text-accent mt-4 inline-flex items-center gap-2 py-1 text-[10.5px] font-extrabold tracking-[0.14em] uppercase underline underline-offset-4"
						onclick={() => (shownServers += SERVERS_PER_PAGE)}
					>
						Show more ({remainingServers} left)
						<i class="fas fa-arrow-down"></i>
					</button>
				{/if}
			</section>
		{/if}

		<section class="border-base-300 border-t py-10 sm:py-13 lg:py-16">
			<div class="mb-6">
				<p class={EYEBROW}>03 — The panel</p>
				<h2 class={H2}>Configured in a browser</h2>
				<p class={LEAD}>Sign in and you land in the panel. Where a module supports it, you see live bot and server state as it happens.</p>
			</div>
			<div class="grid grid-cols-1 gap-4.5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
				{#each panel as item}
					<p class="text-base-content/60 max-w-[30ch] text-[12.5px] leading-[1.5]">
						<strong class="text-base-content mb-0.5 block text-[12px] font-extrabold tracking-[0.08em] uppercase">{item.title}</strong>
						{item.desc}
					</p>
				{/each}
			</div>
		</section>

		<section class="bleed bg-primary text-primary-content mt-10 -mb-10 py-12 sm:mt-13 sm:py-15 lg:mt-16 lg:py-19">
			<p class="text-primary-content mb-3.5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">04 — Start</p>
			<p class="font-black">
				<span class="display-line text-primary-content block whitespace-nowrap uppercase" style="--ch: 10">Ready to go</span>
			</p>
			<p class="text-primary-content/90 mt-4.5 max-w-[48ch] text-[13.5px] leading-[1.6]">
				Add {APP_NAME} Bot to your server first, then sign in to configure it. The login screen also offers a free
				<strong class="text-primary-content font-bold">ten minute demo</strong> with full panel access and no signup.
			</p>
			<div class="mt-7 flex flex-wrap gap-2">
				<a
					href={OFFICIAL_BOT_INVITE_URL}
					class="{BTN} border-primary-content bg-primary-content text-primary hover:border-primary-content hover:bg-primary-content/90"
					target="_blank"
					rel="noopener noreferrer"
				>
					<i class="fab fa-discord"></i>
					Add {APP_NAME} Bot
				</a>
				<a href="/login" class="{BTN} btn-outline border-primary-content/55 text-primary-content hover:bg-primary-content hover:text-primary">
					<i class="fas fa-arrow-right-to-bracket"></i>
					Open login
				</a>
				<a href="/docs" class="{BTN} btn-outline border-primary-content/55 text-primary-content hover:bg-primary-content hover:text-primary">
					<i class="fas fa-book-open"></i>
					Read the docs
				</a>
			</div>
		</section>
	</div>
</PageShell>
