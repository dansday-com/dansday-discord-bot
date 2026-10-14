export const DISCORD_LIMITS = {
	MESSAGE: 2000,
	EMBED_TITLE: 256,
	EMBED_DESCRIPTION: 4096,
	EMBED_FIELD_NAME: 256,
	EMBED_FIELD_VALUE: 1024,
	EMBED_FOOTER: 2048,
	SELECT_OPTIONS: 25,
	SELECT_OPTION_TEXT: 100,
	BUTTON_LABEL: 80,
	MODAL_TITLE: 45,
	ROLE_NAME: 100,
	ROW_BUTTONS: 5,
	ACTION_ROWS: 5,
	USERNAME: 32,
	NICKNAME: 32,
	LABEL: 45,
	TEXT_INPUT_PLACEHOLDER: 100,
	SELECT_PLACEHOLDER: 150,
	EMBED_AUTHOR_NAME: 256,
	COMMAND_DESCRIPTION: 100,
	CUSTOM_ID: 100,
	AUDIT_LOG_REASON: 512
} as const;

const ELLIPSIS = '...';

export function truncateToLimit(text: string, limit: number) {
	return text.length > limit ? `${text.slice(0, limit - ELLIPSIS.length)}${ELLIPSIS}` : text;
}

export function embedFieldText(text: string | null | undefined) {
	return text ? truncateToLimit(text, DISCORD_LIMITS.EMBED_FIELD_VALUE) : '—';
}
