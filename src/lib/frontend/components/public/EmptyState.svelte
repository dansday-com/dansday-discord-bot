<script lang="ts">
	let {
		icon,
		message
	}: {
		icon: string;
		message: string;
	} = $props();
</script>

<div class="text-base-content/45 flex flex-col items-center justify-center gap-3 py-14 text-center">
	<i class="fas {icon} text-5xl opacity-20" aria-hidden="true"></i>
	<p class="text-sm font-semibold">{message}</p>
</div>
