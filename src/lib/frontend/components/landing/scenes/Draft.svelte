<script lang="ts">
	let { draft, channel }: { draft: string; channel: string } = $props();
</script>

{#if draft}
	<span class="text-ash-50 min-w-0 truncate">{draft}<span class="scene-caret"></span></span>
{:else}
	<span class="text-ash-200 min-w-0 truncate">Message #{channel}</span>
{/if}

<style>
	.scene-caret {
		display: inline-block;
		width: 1px;
		height: 1.05em;
		margin-left: 1px;
		vertical-align: -0.15em;
		background: #f2f3f5;
		animation: scene-caret 1s steps(1) infinite;
	}

	@keyframes scene-caret {
		50% {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scene-caret {
			animation: none;
		}
	}
</style>
