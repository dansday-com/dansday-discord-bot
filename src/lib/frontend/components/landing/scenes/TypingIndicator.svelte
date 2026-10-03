<script lang="ts">
	let { who }: { who: string | null } = $props();
</script>

{#if who}
	<span class="scene-dots flex gap-[3px]"><i></i><i></i><i></i></span>
	<span><b class="text-ash-50 font-semibold">{who}</b> is typing…</span>
{/if}

<style>
	.scene-dots i {
		display: block;
		width: 5px;
		height: 5px;
		border-radius: 9999px;
		background: #dbdee1;
		animation: scene-dot 1.2s ease-in-out infinite;
	}

	.scene-dots i:nth-child(2) {
		animation-delay: 0.15s;
	}

	.scene-dots i:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes scene-dot {
		0%,
		60%,
		100% {
			opacity: 0.35;
			transform: translateY(0);
		}
		30% {
			opacity: 1;
			transform: translateY(-2px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scene-dots i {
			animation: none;
		}
	}
</style>
