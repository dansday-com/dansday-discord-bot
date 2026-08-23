<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	import {
		sections,
		shopSteps,
		aiChatFields,
		aiToolFields,
		aiToolRules,
		aiVoiceRules,
		aiServerRules,
		aiServerTopics,
		aiWikiFields,
		aiWikiRules,
		aiWikiRelaySteps,
		envVars,
		selfhostSteps,
		startSteps,
		setupChannels,
		accountFields,
		permissionRoles,
		modules,
		discordMenu
	} from '$lib/docs.js';

	const officialBotInviteUrl = 'https://discord.com/oauth2/authorize?client_id=1446572985849876640';

	const botKinds = [
		{
			icon: 'fa-robot',
			accent: '#5865f2',
			title: 'Official bot',
			what: 'The real Discord bot application you invite with an OAuth link. It runs almost everything: leveling, items, moderation, welcomer, booster, giveaways, AFK, feedback, staff rating, custom supporter roles, the /setup command, and every menu button.',
			fields: [
				{
					label: 'How to add',
					desc: 'Invite it with the OAuth link (the "Add the bot" button). It joins as a normal bot user with the permissions the features need.'
				},
				{
					label: 'Token',
					desc: 'For the hosted bot this is handled for you. Self-hosters store the bot token in the database bots table, not in Discord, and point the process at it with BOT_ID.'
				},
				{ label: 'Runs', desc: 'All standard features and slash/button interactions.' }
			]
		},
		{
			icon: 'fa-user-secret',
			accent: '#c0392b',
			title: 'Selfbot (optional)',
			what: 'An optional user-token client for features that need a real user account. Only two features require it: the Discord Quest notifier and the message Forwarder. Everything else uses the official bot.',
			fields: [
				{
					label: 'Requires a selfbot',
					desc: 'Discord Quest notifier and Message forwarder. Their config pages warn you if no selfbot is running for the server.'
				},
				{
					label: 'How to add',
					desc: 'Add a selfbot under the Selfbots page for the server and paste a user token. It is stored encrypted. Adding, starting, stopping, restarting and deleting are owner-only; staff see it read-only.'
				},
				{
					label: 'Risk',
					desc: 'A selfbot uses a user account token. Use it in line with Discord’s terms and your own risk assessment. It is entirely optional.'
				}
			]
		}
	];

	const tiers = [
		{
			icon: 'fa-crown',
			accent: '#d9a528',
			title: 'Owner',
			what: 'Full control of one server in the panel. The first owner claims the link from /setup.',
			can: [
				'Configure every module and permission for the server',
				'Invite, freeze and delete staff accounts (not other owners)',
				'Create and expire invite links',
				'Add, start, stop, restart and delete selfbots',
				'Invite more owners'
			]
		},
		{
			icon: 'fa-user-tie',
			accent: '#245f73',
			title: 'Staff',
			what: 'Helper access invited by an owner. What they can change depends on the permission roles.',
			can: [
				'View and change settings allowed by their permission roles',
				'Use staff features like the rating review queue',
				'View selfbots read-only (cannot start or manage them)',
				'Cannot invite, freeze or delete any account',
				'Cannot run /setup'
			]
		},
		{
			icon: 'fa-shield-halved',
			accent: '#c0392b',
			title: 'Superadmin',
			what: 'Global panel administrator (mainly relevant to self-hosters who run the whole instance).',
			can: [
				'Access every bot and server on the instance',
				'Manage and freeze any account, including owners',
				'Delete any account and expire any invite',
				'Effectively unrestricted across the panel'
			]
		}
	];

	function reveal(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			node.classList.add('in');
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						(e.target as HTMLElement).classList.add('in');
						io.unobserve(e.target);
					}
				}
			},
			{ threshold: 0.08 }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}
</script>

<svelte:head>
	<title>Documentation | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Set up {APP_NAME} Bot from scratch: run /setup, register, invite staff, set permissions, and configure every module field by field."
	/>
	<meta name="theme-color" content="#245f73" />
</svelte:head>

<div class="m-root">
	<div class="m-blob m-blob-1"></div>
	<div class="m-blob m-blob-2"></div>
	<div class="m-blob m-blob-3"></div>

	<MainHeader />

	<main class="m-main">
		<div class="m-inner">
			<div class="g-wrap">
				<header class="g-hero" use:reveal>
					<div class="g-hero-badge"><i class="fas fa-book-open"></i></div>
					<h1 class="g-hero-title">Set up {APP_NAME} Bot</h1>
					<p class="g-hero-sub">
						From adding the bot to configuring every module, field by field. Everything is set in the browser; members use it through the Discord menu.
					</p>
					<a href={officialBotInviteUrl} class="m-btn m-btn--primary g-docs-cta" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						Add the bot to start
					</a>
				</header>

				<nav class="g-docs-nav" aria-label="Sections">
					{#each sections as s}
						<a href="#{s.id}" class="g-docs-navlink"><i class="fas {s.icon}"></i>{s.label}</a>
					{/each}
				</nav>

				<section id="start" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-flag-checkered"></i>Get started</h2>
					<p class="g-sec-lead">Three steps take you from nothing to a configurable server.</p>
					<div class="g-steps">
						{#each startSteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="bots" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-robot"></i>Official bot vs selfbot</h2>
					<p class="g-sec-lead">The official bot runs everything. A selfbot is optional and only needed for two features.</p>
					<div class="g-modules">
						{#each botKinds as b, i}
							<article class="g-mod" style="--ac: {b.accent}; --d: {i * 60}ms">
								<div class="g-mod-head">
									<span class="g-mod-ic"><i class="fas {b.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{b.title}</h3>
										<p>{b.what}</p>
									</div>
								</div>
								<div class="g-fieldlist">
									{#each b.fields as f}
										<div class="g-field">
											<span class="g-field-key">{f.label}</span>
											<span class="g-field-val">{f.desc}</span>
										</div>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				</section>

				<section id="setup-command" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-terminal"></i>The /setup command</h2>
					<p class="g-sec-lead">
						Run <code>/setup</code> in Discord (owner or Administrator only). It creates a <strong>{APP_NAME} Menu</strong> category with these channels and posts
						the bot interface in the menu channel. If no owner account exists yet, it hands you a registration link to claim ownership.
					</p>
					<div class="g-fieldlist">
						{#each setupChannels as c}
							<div class="g-field">
								<span class="g-field-key">{c.name}</span>
								<span class="g-field-val">{c.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="accounts" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-user-plus"></i>Accounts &amp; staff</h2>
					<p class="g-sec-lead">Sign in with Discord. The person who claims the first invite is the owner; they bring in helpers from the Accounts page.</p>
					<div class="g-fieldlist">
						{#each accountFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}</span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="roles" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-users-gear"></i>Who can do what</h2>
					<p class="g-sec-lead">
						Account tiers control who manages the panel. They are separate from the Discord permission roles below, which control who can use features in
						Discord.
					</p>
					<div class="g-modules">
						{#each tiers as t, i}
							<article class="g-mod" style="--ac: {t.accent}; --d: {i * 60}ms">
								<div class="g-mod-head">
									<span class="g-mod-ic"><i class="fas {t.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{t.title}</h3>
										<p>{t.what}</p>
									</div>
								</div>
								<ul class="g-cando">
									{#each t.can as c}
										<li>{c}</li>
									{/each}
								</ul>
							</article>
						{/each}
					</div>
				</section>

				<section id="permissions" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-user-shield"></i>Permissions</h2>
					<p class="g-sec-lead">Map Discord roles to what they unlock. Set these on the Permissions page.</p>
					<div class="g-fieldlist">
						{#each permissionRoles as r}
							<div class="g-field">
								<span class="g-field-key">{r.label}</span>
								<span class="g-field-val">{r.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="modules" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-toggle-on"></i>Modules, field by field</h2>
					<p class="g-sec-lead">Each module has a master toggle plus its own settings. Turn on only what you need.</p>
					<div class="g-modules">
						{#each modules as m, i}
							<article id="mod-{m.id}" class="g-mod" style="--ac: {m.accent}; --d: {(i % 4) * 60}ms">
								<div class="g-mod-head">
									<span class="g-mod-ic"><i class="fas {m.icon}"></i></span>
									<div class="g-mod-titles">
										<h3>{m.title}</h3>
										<p>{m.what}</p>
									</div>
								</div>
								<div class="g-fieldlist">
									{#each m.fields as f}
										<div class="g-field">
											<span class="g-field-key">{f.label}</span>
											<span class="g-field-val">{f.desc}</span>
										</div>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				</section>

				<section id="ai-chat" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-robot"></i>AI chat</h2>
					<p class="g-sec-lead">
						Members mention the bot to talk to it, or reply to one of its messages to keep going without mentioning again. Set this on the bot panel under the
						AI tab, not per server, so every server the bot is in shares one configuration. Each member keeps their own conversation in each server. Restart the
						bot after saving.
					</p>
					<div class="g-fieldlist">
						{#each aiChatFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">Voice: how it behaves</h3>
					<p class="g-sec-lead">Everyone in the channel is heard by one shared session.</p>
					<div class="g-steps">
						{#each aiVoiceRules as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="ai-tools" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-toolbox"></i>Web search, fetch and images</h2>
					<p class="g-sec-lead">
						Three optional tools the AI reaches for on its own: searching the live web, reading a page it was linked to, and drawing a picture. Server data
						needs none of these. Each is a separate URL, model and key on the bot panel under the AI tab, so they can point at different providers. Any
						OpenAI-compatible gateway works. Restart the bot after saving.
					</p>
					<div class="g-fieldlist">
						{#each aiToolFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">How it works</h3>
					<div class="g-steps">
						{#each aiToolRules as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="ai-server" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-database"></i>Server knowledge</h2>
					<p class="g-sec-lead">
						The AI can read this server's own live data, so "what is in the shop", "who is number one" and "what are my tasks" get real answers instead of
						guesses. It works as soon as AI chat is on — there is nothing extra to configure.
					</p>
					<div class="g-earn">
						{#each aiServerTopics as c, i}
							<div class="g-earn-card" style="--ac: #245f73; --d: {i * 60}ms">
								<span class="g-earn-ic"><i class="fas {c.icon}"></i></span>
								<div class="g-earn-body">
									<h3>{c.title}</h3>
									<p>{c.desc}</p>
								</div>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">How it works</h3>
					<div class="g-steps">
						{#each aiServerRules as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="ai-wikis" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-book"></i>Wiki knowledge</h2>
					<p class="g-sec-lead">
						Without this, the AI answers game questions from memory and gets them wrong. Add a wiki and it looks the answer up instead. Set this on the bot
						panel under the Wikis tab. It applies to chat and voice alike, and to every server the bot is in.
					</p>
					<div class="g-fieldlist">
						{#each aiWikiFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">How it works</h3>
					<div class="g-steps">
						{#each aiWikiRules as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">When a wiki blocks your server</h3>
					<p class="g-sec-lead">
						A few wiki hosts refuse traffic coming from servers, so the bot gets turned away even though the address is right. A relay fixes this: it forwards
						the lookup from somewhere the wiki does accept. Only the wikis you point at it are affected, everything else keeps connecting directly.
					</p>
					<div class="g-steps">
						{#each aiWikiRelaySteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="shop" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-store"></i>Set up the items shop</h2>
					<p class="g-sec-lead">
						Two parts: enable the module per server, then create items in the admin catalog. Items are shared across every server that turns Items on.
					</p>
					<div class="g-steps">
						{#each shopSteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
				</section>

				<section id="discord" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fab fa-discord"></i>The Discord menu</h2>
					<p class="g-sec-lead">
						Members click the Menu button in the menu channel. Every button is always shown — if a feature is off or needs a role, clicking it explains why.
					</p>
					<div class="g-fieldlist">
						{#each discordMenu as d}
							<div class="g-field">
								<span class="g-field-key">{d.label}</span>
								<span class="g-field-val">{d.desc}</span>
							</div>
						{/each}
					</div>
				</section>

				<section id="selfhost" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class="fas fa-server"></i>Self-host setup</h2>
					<p class="g-sec-lead">The project is open source under MIT. Run your own instance with Node, MySQL and optional Redis.</p>
					<div class="g-steps">
						{#each selfhostSteps as s, i}
							<div class="g-step" style="--d: {i * 80}ms">
								<span class="g-step-num">{i + 1}</span>
								<span class="g-step-ic"><i class="fas {s.icon}"></i></span>
								<h3>{s.title}</h3>
								<p>{s.desc}</p>
							</div>
						{/each}
					</div>
					<h3 class="g-sub-head">Environment variables</h3>
					<p class="g-sec-lead">Copy <code>.env.example</code> to <code>.env</code> and fill these in.</p>
					<div class="g-fieldlist">
						{#each envVars as e}
							<div class="g-field">
								<span class="g-field-key">{e.label}<span class="g-field-tag g-field-tag--{e.req === 'optional' ? 'opt' : 'req'}">{e.req}</span></span>
								<span class="g-field-val">{e.desc}</span>
							</div>
						{/each}
					</div>
				</section>
			</div>
		</div>
	</main>

	<MainFooter />
</div>
