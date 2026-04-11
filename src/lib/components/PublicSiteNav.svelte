<script lang="ts">
	/** `landing`: Login CTA. `stats`: live indicator (public statistics pages). */
	type Mode = 'landing' | 'stats';

	let { mode = 'landing' as Mode }: { mode?: Mode } = $props();
</script>

<nav class="m-nav">
	<div class="m-nav-inner">
		<a href="/" class="m-nav-brand">
			<div class="m-nav-icon">
				<i class="fas fa-bolt"></i>
			</div>
			<span>Dansday Discord Bot</span>
		</a>
		<div class="m-nav-right">
			{#if mode === 'landing'}
				<a href="/login" class="m-btn m-btn--primary">
					<i class="fas fa-sign-in-alt"></i>
					Log in
				</a>
			{:else}
				<span class="m-nav-live">
					<span class="m-nav-live-dot"></span>
					Live
				</span>
			{/if}
		</div>
	</div>
</nav>
