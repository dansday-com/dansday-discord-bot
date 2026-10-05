<span class="scene-tap pointer-events-none absolute top-1/2 left-1/2 size-9 rounded-full" aria-hidden="true"></span>

<style>
	.scene-tap {
		background: radial-gradient(circle, rgb(255 255 255 / 0.55), rgb(255 255 255 / 0.18) 60%, transparent 72%);
		box-shadow: 0 0 0 2px rgb(255 255 255 / 0.6);
		transform: translate(-50%, -50%) scale(1.5);
		opacity: 0;
		animation: scene-tap 640ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	@keyframes scene-tap {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(1.5);
		}
		50% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
		64% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(0.78);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(1.7);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scene-tap {
			animation: none;
			opacity: 0;
		}
	}
</style>
