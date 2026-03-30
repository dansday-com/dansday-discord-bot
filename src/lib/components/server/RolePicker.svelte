<script lang="ts">
	interface Role {
		id: string;
		name: string;
		color: string;
	}
	interface Props {
		roles: Role[];
		value: string[];
		placeholder?: string;
		onchange: (ids: string[]) => void;
	}
	let { roles, value, placeholder = 'Select roles...', onchange }: Props = $props();
	let open = $state(false);

	function toggle(id: string) {
		if (value.includes(id)) onchange(value.filter((r) => r !== id));
		else onchange([...value, id]);
	}

	function roleColor(hex: string) {
		return !hex || hex === '#000000' ? '#6b7280' : hex;
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors"
	>
		<span class={value.length ? 'text-ash-100' : 'text-ash-500'}>
			{value.length ? `${value.length} role${value.length !== 1 ? 's' : ''} selected` : placeholder}
		</span>
		<i class="fas fa-chevron-{open ? 'up' : 'down'} text-ash-500 text-xs"></i>
	</button>
	{#if open}
		<div class="bg-ash-700 border-ash-600 absolute z-10 mt-1 max-h-48 w-full overflow-hidden overflow-y-auto rounded-lg border shadow-lg">
			{#each roles as role}
				<button
					type="button"
					onclick={() => toggle(role.id)}
					class="hover:bg-ash-600 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
				>
					<i class="fas {value.includes(role.id) ? 'fa-check-square text-ash-200' : 'fa-square text-ash-600'} w-3 text-xs"></i>
					<span class="h-2 w-2 flex-shrink-0 rounded-full" style="background:{roleColor(role.color)}"></span>
					<span class={value.includes(role.id) ? 'text-ash-100' : 'text-ash-300'}>{role.name}</span>
				</button>
			{/each}
		</div>
	{/if}
	{#if value.length > 0}
		<div class="mt-2 flex flex-wrap gap-1">
			{#each value as id}
				{@const role = roles.find((r) => r.id === id)}
				{#if role}
					<span
						class="flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
						style="color:{roleColor(role.color)};border-color:{roleColor(role.color)}44;background:{roleColor(role.color)}11"
					>
						{role.name}
						<button type="button" onclick={() => toggle(id)} class="ml-0.5 hover:opacity-70">
							<i class="fas fa-times text-xs"></i>
						</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}
</div>
