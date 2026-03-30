<script lang="ts">
	interface Role { id: string; name: string; color: string; }
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
		class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-left text-sm hover:border-ash-500 transition-colors flex items-center justify-between"
	>
		<span class="{value.length ? 'text-ash-100' : 'text-ash-500'}">
			{value.length ? `${value.length} role${value.length !== 1 ? 's' : ''} selected` : placeholder}
		</span>
		<i class="fas fa-chevron-{open ? 'up' : 'down'} text-ash-500 text-xs"></i>
	</button>
	{#if open}
		<div class="absolute z-10 mt-1 w-full bg-ash-700 border border-ash-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto shadow-lg">
			{#each roles as role}
				<button
					type="button"
					onclick={() => toggle(role.id)}
					class="w-full px-3 py-2 text-left text-sm hover:bg-ash-600 transition-colors flex items-center gap-2"
				>
					<i class="fas {value.includes(role.id) ? 'fa-check-square text-ash-200' : 'fa-square text-ash-600'} text-xs w-3"></i>
					<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{roleColor(role.color)}"></span>
					<span class="{value.includes(role.id) ? 'text-ash-100' : 'text-ash-300'}">{role.name}</span>
				</button>
			{/each}
		</div>
	{/if}
	{#if value.length > 0}
		<div class="flex flex-wrap gap-1 mt-2">
			{#each value as id}
				{@const role = roles.find((r) => r.id === id)}
				{#if role}
					<span class="text-xs px-2 py-0.5 rounded flex items-center gap-1 border"
						style="color:{roleColor(role.color)};border-color:{roleColor(role.color)}44;background:{roleColor(role.color)}11">
						{role.name}
						<button type="button" onclick={() => toggle(id)} class="hover:opacity-70 ml-0.5">
							<i class="fas fa-times text-xs"></i>
						</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}
</div>
