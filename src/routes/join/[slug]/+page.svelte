<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { PageMeta, PageShell } from '$lib/frontend/components/shell';
	import { inviteJoinPath } from '$lib/invites.js';
	import { publicServerPath } from '$lib/url.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const initials = (n: string) =>
		n
			.replace(/[^a-zA-Z0-9 ]/g, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase() || '?';
</script>

<PageMeta
	title="Join {data.server.name} on Discord | Invited by {data.member.name}"
	description="{data.member.name} invited you to join {data.server
		.name}, a Discord community with {data.server.members.toLocaleString()} members running {APP_NAME} Bot. Accept the invite to jump in."
	path={inviteJoinPath(data.slug)}
/>

<svelte:head>
	{#if !data.indexable}
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

<PageShell trailing="home" center>
	<section class="mx-auto flex w-full max-w-md flex-col items-center py-10 text-center">
		<p class="text-primary mb-5 text-[10.5px] font-extrabold tracking-[0.2em] uppercase">Discord invite</p>

		<div class="border-base-300 bg-base-200 mb-5 size-24 overflow-hidden rounded-3xl border">
			{#if data.server.icon}
				<img src={data.server.icon} alt={data.server.name} class="size-full object-cover" />
			{:else}
				<div class="text-base-content/60 grid size-full place-items-center text-2xl font-black">{initials(data.server.name)}</div>
			{/if}
		</div>

		<p class="text-base-content/60 mb-2 flex items-center justify-center gap-2 text-sm">
			{#if data.member.avatar}
				<img src={data.member.avatar} alt="" class="size-6 rounded-full object-cover" />
			{/if}
			<span><span class="text-base-content font-semibold">{data.member.name}</span> invited you to join</span>
		</p>

		<h1 class="text-base-content mb-3 text-[clamp(26px,7vw,44px)] leading-[1.02] font-black tracking-[-0.03em] break-words">{data.server.name}</h1>

		{#if data.server.members > 0}
			<p class="text-base-content/55 mb-7 text-sm">
				<i class="fas fa-users mr-1.5 text-[12px]"></i>{data.server.members.toLocaleString()} members
			</p>
		{/if}

		<a href={data.inviteUrl} rel="nofollow" class="btn btn-primary w-full rounded-sm text-base sm:w-auto sm:min-w-64">
			<i class="fa-brands fa-discord"></i>Join on Discord
		</a>

		{#if data.serverSlug}
			<a href={publicServerPath(data.serverSlug)} class="text-base-content/60 hover:text-primary mt-4 text-sm underline-offset-4 hover:underline">
				See the server's stats and leaderboard
			</a>
		{/if}
	</section>
</PageShell>
