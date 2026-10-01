<script lang="ts">
	import LegalDocPage from '$lib/frontend/components/LegalDocPage.svelte';
	import { TERMS_PATH, terms } from '$lib/legal.js';
</script>

<LegalDocPage doc={terms} path={TERMS_PATH} />
