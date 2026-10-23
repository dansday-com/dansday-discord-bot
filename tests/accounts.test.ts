import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCOUNT_ROLE_LABELS, groupPanelAccounts, type PanelAccountRow } from '../src/lib/accounts.ts';

const row = (overrides: Partial<PanelAccountRow>): PanelAccountRow => ({
	id: 1,
	username: 'ali',
	email: 'ali@example.test',
	ip_address: null,
	server_id: 10,
	server_name: 'Spider Lair',
	account_type: 'staff',
	is_frozen: false,
	...overrides
});

test('groupPanelAccounts gives one entry per account with every server it is on', () => {
	const grouped = groupPanelAccounts([
		row({}),
		row({ server_id: 11, server_name: 'Test server', account_type: 'owner', is_frozen: null }),
		row({ id: 2, username: 'sara', email: 'sara@example.test', server_id: 10 })
	]);
	assert.equal(grouped.length, 2);
	assert.deepEqual(grouped[0], {
		id: 1,
		username: 'ali',
		email: 'ali@example.test',
		ip_address: null,
		servers: [
			{ server_id: 10, server_name: 'Spider Lair', account_type: 'staff', is_frozen: false },
			{ server_id: 11, server_name: 'Test server', account_type: 'owner', is_frozen: false }
		]
	});
	assert.deepEqual(
		grouped[1].servers.map((s) => s.server_id),
		[10]
	);
});

test('groupPanelAccounts returns nothing for no rows', () => {
	assert.deepEqual(groupPanelAccounts([]), []);
});

test('every account role has a label', () => {
	assert.deepEqual(ACCOUNT_ROLE_LABELS, { owner: 'Owner', staff: 'Staff' });
});
