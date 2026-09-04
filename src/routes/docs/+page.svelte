<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { AccentCard, DocHero, DocSection, FieldList, ModuleCard, PageShell, StepGrid } from '$lib/frontend/components/shell';

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
</script>

<svelte:head>
	<title>Documentation | {APP_NAME} Discord Bot</title>
	<meta
		name="description"
		content="Set up {APP_NAME} Bot from scratch: run /setup, register, invite staff, set permissions, and configure every module field by field."
	/>
	<meta name="theme-color" content="#e43d12" />
</svelte:head>

{#snippet subHead(text: string, lead?: string)}
	<h3 class="text-base-content mt-5.5 mb-1 text-sm font-extrabold">{text}</h3>
	{#if lead}
		<p class="text-base-content/60 mb-4.5 text-[13.5px] leading-relaxed">{lead}</p>
	{/if}
{/snippet}

<PageShell>
	<div class="flex flex-col gap-10 pt-2 pb-12">
		<DocHero icon="fa-book-open" title={DOCS_HERO.heading.replace('{app}', APP_NAME)} lead={DOCS_HERO.lead}>
			{#snippet actions()}
				<a href={OFFICIAL_BOT_INVITE_URL} class="btn btn-primary" target="_blank" rel="noopener noreferrer">
					<i class="fab fa-discord"></i>
					{DOCS_HERO.cta}
				</a>
			{/snippet}
		</DocHero>

		<nav class="-mt-4 flex flex-wrap justify-center gap-2" aria-label="Sections">
			{#each sections as s}
				<a
					href="#{s.id}"
					class="border-base-300 bg-base-200 text-base-content/60 hover:text-primary hover:border-primary/40 inline-flex items-center gap-[7px] rounded-full border px-3.5 py-2 text-[12.5px] font-bold whitespace-nowrap transition-colors"
				>
					<i class="fas {s.icon}"></i>{s.label}
				</a>
			{/each}
		</nav>

		<DocSection id="start" icon={sectionIcon('start')} heading={sectionHeading('start')} lead={sectionLead('start')}>
			<StepGrid steps={startSteps} />
		</DocSection>

		<DocSection id="bots" icon={sectionIcon('bots')} heading={sectionHeading('bots')} lead={sectionLead('bots')}>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
				{#each botKinds as b}
					<ModuleCard icon={b.icon} accent={b.accent} title={b.title} what={b.what}>
						<FieldList fields={b.fields} />
					</ModuleCard>
				{/each}
			</div>
		</DocSection>

		<DocSection id="setup-command" icon={sectionIcon('setup-command')} heading={sectionHeading('setup-command')} lead={sectionLead('setup-command')}>
			<FieldList fields={setupChannels.map((c) => ({ label: c.name, desc: c.desc }))} />
		</DocSection>

		<DocSection id="accounts" icon={sectionIcon('accounts')} heading={sectionHeading('accounts')} lead={sectionLead('accounts')}>
			<FieldList fields={accountFields} />
		</DocSection>

		<DocSection id="roles" icon={sectionIcon('roles')} heading={sectionHeading('roles')} lead={sectionLead('roles')}>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
				{#each tiers as t}
					<ModuleCard icon={t.icon} accent={t.accent} title={t.title} what={t.what}>
						<ul class="text-base-content/60 m-0 flex list-none flex-col gap-[7px] p-0 text-[12.5px] leading-relaxed">
							{#each t.can as c}
								<li class="flex gap-2"><i class="fas fa-check text-primary/70 mt-0.5 shrink-0 text-[10px]"></i><span>{c}</span></li>
							{/each}
						</ul>
					</ModuleCard>
				{/each}
			</div>
		</DocSection>

		<DocSection id="permissions" icon={sectionIcon('permissions')} heading={sectionHeading('permissions')} lead={sectionLead('permissions')}>
			<FieldList fields={permissionRoles} />
		</DocSection>

		<DocSection id="modules" icon={sectionIcon('modules')} heading={sectionHeading('modules')} lead={sectionLead('modules')}>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
				{#each modules as m}
					<ModuleCard id="mod-{m.id}" icon={m.icon} accent={m.accent} title={m.title} what={m.what}>
						<FieldList fields={m.fields} />
					</ModuleCard>
				{/each}
			</div>
		</DocSection>

		<DocSection id="ai-chat" icon={sectionIcon('ai-chat')} heading={sectionHeading('ai-chat')} lead={sectionLead('ai-chat')}>
			<FieldList fields={aiChatFields} />
			{@render subHead(subHeading('ai-voice'), subLead('ai-voice'))}
			<StepGrid steps={aiVoiceRules} />
		</DocSection>

		<DocSection id="ai-tools" icon={sectionIcon('ai-tools')} heading={sectionHeading('ai-tools')} lead={sectionLead('ai-tools')}>
			<FieldList fields={aiToolFields} />
			{@render subHead(subHeading('ai-tools-how'))}
			<StepGrid steps={aiToolRules} />
		</DocSection>

		<DocSection id="ai-server" icon={sectionIcon('ai-server')} heading={sectionHeading('ai-server')} lead={sectionLead('ai-server')}>
			<div class="flex flex-wrap gap-3">
				{#each aiServerTopics as c}
					<AccentCard icon={c.icon} accent="#e43d12" title={c.title} text={c.desc} />
				{/each}
			</div>
			{@render subHead(subHeading('ai-server-how'))}
			<StepGrid steps={aiServerRules} />
		</DocSection>

		<DocSection id="ai-wikis" icon={sectionIcon('ai-wikis')} heading={sectionHeading('ai-wikis')} lead={sectionLead('ai-wikis')}>
			<FieldList fields={aiWikiFields} />
			{@render subHead(subHeading('ai-wiki-how'))}
			<StepGrid steps={aiWikiRules} />
			{@render subHead(subHeading('ai-wiki-relay'), subLead('ai-wiki-relay'))}
			<StepGrid steps={aiWikiRelaySteps} />
		</DocSection>

		<DocSection id="shop" icon={sectionIcon('shop')} heading={sectionHeading('shop')} lead={sectionLead('shop')}>
			<StepGrid steps={shopSteps} />
		</DocSection>

		<DocSection id="discord" icon={sectionIcon('discord')} heading={sectionHeading('discord')} lead={sectionLead('discord')}>
			<FieldList fields={discordMenu} />
		</DocSection>

		<DocSection id="selfhost" icon={sectionIcon('selfhost')} heading={sectionHeading('selfhost')} lead={sectionLead('selfhost')}>
			<StepGrid steps={selfhostSteps} />
			{@render subHead(subHeading('selfhost-env'), subLead('selfhost-env'))}
			<FieldList fields={envVars} />
		</DocSection>
	</div>
</PageShell>
