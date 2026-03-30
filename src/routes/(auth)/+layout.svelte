<script lang="ts">
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-ash-950 to-ash-800">
	<div class="w-full max-w-md mx-3 sm:mx-4">
		{@render children()}

		<div class="text-center mt-4 sm:mt-6 text-ash-500 text-xs sm:text-sm px-2">
			<p>
				Copyright &copy; {new Date().getFullYear()}
				<a href="https://dansday.com" target="_blank" class="text-ash-200 hover:text-ash-300 transition-colors">dansday.com</a>. All rights reserved.
			</p>
		</div>
	</div>
</div>
