const REGISTRY = [
	{ id: 'main', label: 'Main', featureSwitch: false, hrefSuffix: '', icon: 'fa-gear', iconClass: 'text-emerald-400' },
	{
		id: 'permissions',
		label: 'Permissions',
		featureSwitch: false,
		hrefSuffix: '/permissions',
		icon: 'fa-shield-halved',
		iconClass: 'text-blue-400'
	},
	{
		id: 'welcomer',
		label: 'Welcomer',
		featureSwitch: true,
		hrefSuffix: '/welcomer',
		icon: 'fa-hand',
		iconClass: 'text-sky-400'
	},
	{
		id: 'booster',
		label: 'Booster',
		featureSwitch: true,
		hrefSuffix: '/booster',
		icon: 'fa-gem',
		iconClass: 'text-purple-400'
	},
	{
		id: 'notifications',
		label: 'Channel notification',
		featureSwitch: true,
		hrefSuffix: '/notifications',
		icon: 'fa-bell',
		iconClass: 'text-rose-400'
	},
	{
		id: 'forwarder',
		label: 'Forwarder',
		featureSwitch: true,
		hrefSuffix: '/forwarder',
		icon: 'fa-forward',
		iconClass: 'text-violet-400'
	},
	{
		id: 'leveling',
		label: 'Leveling',
		featureSwitch: true,
		hrefSuffix: '/leveling',
		icon: 'fa-chart-line',
		iconClass: 'text-lime-400'
	},
	{
		id: 'custom_supporter_role',
		label: 'Custom Supporter Role',
		featureSwitch: true,
		hrefSuffix: '/custom-supporter-role',
		icon: 'fa-star',
		iconClass: 'text-yellow-400'
	},
	{
		id: 'giveaway',
		label: 'Giveaway',
		featureSwitch: true,
		hrefSuffix: '/giveaway',
		icon: 'fa-gift',
		iconClass: 'text-pink-400'
	},
	{
		id: 'afk',
		label: 'AFK',
		featureSwitch: true,
		hrefSuffix: '/afk',
		icon: 'fa-moon',
		iconClass: 'text-indigo-400'
	},
	{
		id: 'feedback',
		label: 'Feedback',
		featureSwitch: true,
		hrefSuffix: '/feedback',
		icon: 'fa-comment-dots',
		iconClass: 'text-cyan-400'
	},
	{
		id: 'moderation',
		label: 'Moderation',
		featureSwitch: true,
		hrefSuffix: '/moderation',
		icon: 'fa-gavel',
		iconClass: 'text-red-400'
	},
	{
		id: 'staff_rating',
		label: 'Staff Rating',
		featureSwitch: true,
		hrefSuffix: '/staff-rating',
		icon: 'fa-clipboard-check',
		iconClass: 'text-orange-400'
	},
	{
		id: 'content_creator',
		label: 'Content Creator',
		featureSwitch: true,
		hrefSuffix: '/content-creator',
		icon: 'fa-video',
		iconClass: 'text-pink-400'
	},
	{
		id: 'discord_quest_notifier',
		label: 'Discord Quest',
		featureSwitch: true,
		hrefSuffix: '/discord-quest-notifier',
		icon: 'fa-gem',
		iconClass: 'text-sky-400'
	},
	{
		id: 'public_statistics',
		label: 'Public statistics',
		featureSwitch: true,
		hrefSuffix: '/public-statistics',
		icon: 'fa-chart-pie',
		iconClass: 'text-amber-400'
	}
] as const;

type RegistryId = (typeof REGISTRY)[number]['id'];

const component = Object.fromEntries(REGISTRY.map((e) => [e.id, e.id])) as {
	[K in RegistryId]: K;
};

const withFeatureSwitch = REGISTRY.filter((e) => e.featureSwitch).map((e) => e.id) as RegistryId[];

const configNavTabs: {
	label: string;
	icon: string;
	iconClass: string;
	href: string;
	featureComponent: RegistryId | null;
}[] = REGISTRY.map((e) => ({
	label: e.label,
	icon: e.icon,
	iconClass: e.iconClass,
	href: e.hrefSuffix,
	featureComponent: e.featureSwitch ? e.id : null
}));

function featureLabel(componentId: string): string {
	return REGISTRY.find((e) => e.id === componentId)?.label ?? componentId;
}

export const SERVER_SETTINGS = {
	component,
	withFeatureSwitch,
	configNavTabs,
	featureLabel
};

export type ServerSettingsComponentName = keyof typeof SERVER_SETTINGS.component;
