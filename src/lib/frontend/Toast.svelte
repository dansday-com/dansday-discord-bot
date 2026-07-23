<script lang="ts">
	import { getToasts } from '$lib/frontend/toast.svelte';

	const toasts = getToasts();

	const icons: Record<string, string> = {
		success: 'fa-circle-check',
		error: 'fa-circle-xmark',
		info: 'fa-circle-info'
	};

	const styles: Record<string, string> = {
		success: 'bg-ash-800 border-green-600 text-green-400',
		error: 'bg-ash-800 border-red-600 text-red-400',
		info: 'bg-ash-800 border-ash-500 text-ash-200'
	};
</script>

<div
	class="pointer-events-none fixed top-3 left-1/2 z-50 flex w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col gap-2 lg:top-4 lg:right-4 lg:left-auto lg:w-auto lg:max-w-sm lg:translate-x-0"
>
	{#each toasts as toast (toast.id)}
		<div
			class="flex items-center gap-2 rounded-lg border px-4 py-3 text-base shadow-lg backdrop-blur-sm lg:gap-3 lg:px-6 lg:py-4 lg:text-base {styles[
				toast.type
			]} pointer-events-auto"
		>
			<i class="fas {icons[toast.type]} shrink-0 text-lg lg:text-xl"></i>
			<span class="text-ash-100 break-words">{toast.message}</span>
		</div>
	{/each}
</div>
