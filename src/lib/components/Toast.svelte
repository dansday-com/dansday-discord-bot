<script lang="ts">
	import { getToasts } from '$lib/stores/toast.svelte';

	const toasts = $derived(getToasts());

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

<div class="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-50 flex flex-col gap-2 w-[calc(100%-1.5rem)] sm:w-auto sm:max-w-sm pointer-events-none">
	{#each toasts as toast (toast.id)}
		<div class="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg backdrop-blur-sm border text-sm sm:text-base {styles[toast.type]} pointer-events-auto">
			<i class="fas {icons[toast.type]} text-lg sm:text-xl flex-shrink-0"></i>
			<span class="break-words text-ash-100">{toast.message}</span>
		</div>
	{/each}
</div>
