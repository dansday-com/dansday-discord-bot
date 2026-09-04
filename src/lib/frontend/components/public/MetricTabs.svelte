<script lang="ts">
	type Tab = { id: string; label: string; icon?: string; count?: string; active: boolean };

	let {
		tabs,
		size = 'md',
		depth = 0,
		margin = true,
		label,
		onselect
	}: {
		tabs: Tab[];
		size?: 'md' | 'sm';
		depth?: 0 | 1 | 2;
		margin?: boolean;
		label: string;
		onselect: (id: string) => void;
	} = $props();

	const DEPTH_BG = ['bg-base-100/55', 'bg-base-100/35', 'bg-base-100/25'] as const;
</script>

<div
	role="tablist"
	aria-label={label}
	class="tabs tabs-box border-base-300 flex-nowrap overflow-x-auto border p-1.5 {DEPTH_BG[depth]} {size === 'sm' ? 'tabs-sm' : ''} {margin ? 'mb-3' : ''}"
>
	{#each tabs as tab}
		<button
			role="tab"
			class="tab shrink-0 gap-1.5 font-semibold whitespace-nowrap {tab.active
				? 'tab-active from-secondary to-primary text-primary-content bg-linear-to-br shadow-sm'
				: 'text-base-content/45'}"
			aria-selected={tab.active}
			onclick={() => onselect(tab.id)}
		>
			{#if tab.icon}<i class="fas {tab.icon}"></i>{/if}
			{tab.label}
			{#if tab.count}
				<span class="badge badge-xs h-auto border-none bg-current/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{tab.count}</span>
			{/if}
		</button>
	{/each}
</div>
