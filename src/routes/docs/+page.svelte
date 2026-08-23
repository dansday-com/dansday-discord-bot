<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import MainHeader from '$lib/frontend/components/MainHeader.svelte';
	import MainFooter from '$lib/frontend/components/MainFooter.svelte';

	import {
		DOCS_HERO,
		sections,
		sectionHeading,
		sectionIcon,
		sectionLead,
		subHeading,
		subLead,
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
		botKinds,
		tiers,
		permissionRoles,
		modules,
		discordMenu
	} from '$lib/docs.js';
	import { OFFICIAL_BOT_INVITE_URL } from '$lib/url.js';

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
					<h1 class="g-hero-title">{DOCS_HERO.heading.replace('{app}', APP_NAME)}</h1>
					<p class="g-hero-sub">{DOCS_HERO.lead}</p>
					<a href={OFFICIAL_BOT_INVITE_URL} class="m-btn m-btn--primary g-docs-cta" target="_blank" rel="noopener noreferrer">
						<i class="fab fa-discord"></i>
						{DOCS_HERO.cta}
					</a>
				</header>

				<nav class="g-docs-nav" aria-label="Sections">
					{#each sections as s}
						<a href="#{s.id}" class="g-docs-navlink"><i class="fas {s.icon}"></i>{s.label}</a>
					{/each}
				</nav>

				<section id="start" class="g-sec" use:reveal>
					<h2 class="g-sec-head"><i class={sectionIcon('start')}></i>{sectionHeading('start')}</h2>
					<p class="g-sec-lead">{sectionLead('start')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('bots')}></i>{sectionHeading('bots')}</h2>
					<p class="g-sec-lead">{sectionLead('bots')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('setup-command')}></i>{sectionHeading('setup-command')}</h2>
					<p class="g-sec-lead">{sectionLead('setup-command')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('accounts')}></i>{sectionHeading('accounts')}</h2>
					<p class="g-sec-lead">{sectionLead('accounts')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('roles')}></i>{sectionHeading('roles')}</h2>
					<p class="g-sec-lead">{sectionLead('roles')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('permissions')}></i>{sectionHeading('permissions')}</h2>
					<p class="g-sec-lead">{sectionLead('permissions')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('modules')}></i>{sectionHeading('modules')}</h2>
					<p class="g-sec-lead">{sectionLead('modules')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('ai-chat')}></i>{sectionHeading('ai-chat')}</h2>
					<p class="g-sec-lead">{sectionLead('ai-chat')}</p>
					<div class="g-fieldlist">
						{#each aiChatFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">{subHeading('ai-voice')}</h3>
					<p class="g-sec-lead">{subLead('ai-voice')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('ai-tools')}></i>{sectionHeading('ai-tools')}</h2>
					<p class="g-sec-lead">{sectionLead('ai-tools')}</p>
					<div class="g-fieldlist">
						{#each aiToolFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">{subHeading('ai-tools-how')}</h3>
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
					<h2 class="g-sec-head"><i class={sectionIcon('ai-server')}></i>{sectionHeading('ai-server')}</h2>
					<p class="g-sec-lead">{sectionLead('ai-server')}</p>
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

					<h3 class="g-sub-head">{subHeading('ai-server-how')}</h3>
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
					<h2 class="g-sec-head"><i class={sectionIcon('ai-wikis')}></i>{sectionHeading('ai-wikis')}</h2>
					<p class="g-sec-lead">{sectionLead('ai-wikis')}</p>
					<div class="g-fieldlist">
						{#each aiWikiFields as f}
							<div class="g-field">
								<span class="g-field-key">{f.label}<span class="g-field-tag g-field-tag--{f.req === 'optional' ? 'opt' : 'req'}">{f.req}</span></span>
								<span class="g-field-val">{f.desc}</span>
							</div>
						{/each}
					</div>

					<h3 class="g-sub-head">{subHeading('ai-wiki-how')}</h3>
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

					<h3 class="g-sub-head">{subHeading('ai-wiki-relay')}</h3>
					<p class="g-sec-lead">{subLead('ai-wiki-relay')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('shop')}></i>{sectionHeading('shop')}</h2>
					<p class="g-sec-lead">{sectionLead('shop')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('discord')}></i>{sectionHeading('discord')}</h2>
					<p class="g-sec-lead">{sectionLead('discord')}</p>
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
					<h2 class="g-sec-head"><i class={sectionIcon('selfhost')}></i>{sectionHeading('selfhost')}</h2>
					<p class="g-sec-lead">{sectionLead('selfhost')}</p>
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
					<h3 class="g-sub-head">{subHeading('selfhost-env')}</h3>
					<p class="g-sec-lead">{subLead('selfhost-env')}</p>
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
