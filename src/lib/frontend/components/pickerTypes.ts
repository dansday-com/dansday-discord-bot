export type PickerChannel = {
	discord_channel_id: string;
	name: string | null;
	type: string | number | null;
	category_id: number | null;
	position: number | null;
};

export type PickerCategory = {
	id: number;
	discord_category_id: string;
	name: string | null;
	position: number | null;
};

export type PickerRole = {
	discord_role_id: string;
	name: string | null;
	color: string | null;
	position: number | null;
};
