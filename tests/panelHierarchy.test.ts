import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountTier, canActOn, canActOnAccount, invitableAccountTypes, memberTier, panelActorOf } from '../src/lib/panelHierarchy.ts';

test('panelActorOf only recognises authenticated panel roles', () => {
	assert.equal(panelActorOf(null), null);
	assert.equal(panelActorOf(undefined), null);
	assert.equal(panelActorOf({ authenticated: false, account_type: 'superadmin' }), null);
	assert.equal(panelActorOf({ authenticated: true, account_type: 'superadmin' }), 'superadmin');
	assert.equal(panelActorOf({ authenticated: true, account_type: 'owner' }), 'owner');
	assert.equal(panelActorOf({ authenticated: true, account_type: 'staff' }), 'staff');
	assert.equal(panelActorOf({ authenticated: true, account_type: 'member' }), null);
	assert.equal(panelActorOf({ authenticated: true }), null);
});

test('memberTier puts the owner flag and admin roles above staff roles', () => {
	const staffRoles = ['200'];
	const adminRoles = ['100'];
	assert.equal(memberTier({ is_owner: true, roleIds: [] }, staffRoles, adminRoles), 'owner');
	assert.equal(memberTier({ is_owner: 1, roleIds: [] }, staffRoles, adminRoles), 'owner');
	assert.equal(memberTier({ is_owner: 0, roleIds: ['100', '200'] }, staffRoles, adminRoles), 'owner');
	assert.equal(memberTier({ is_owner: false, roleIds: ['200'] }, staffRoles, adminRoles), 'staff');
	assert.equal(memberTier({ is_owner: null, roleIds: ['300'] }, staffRoles, adminRoles), 'member');
	assert.equal(memberTier({ roleIds: [] }, staffRoles, adminRoles), 'member');
});

test('canActOn requires a strictly higher rank than the target', () => {
	assert.equal(canActOn(null, 'member'), false);
	assert.equal(canActOn('superadmin', 'owner'), true);
	assert.equal(canActOn('superadmin', 'staff'), true);
	assert.equal(canActOn('superadmin', 'member'), true);
	assert.equal(canActOn('owner', 'owner'), false);
	assert.equal(canActOn('owner', 'staff'), true);
	assert.equal(canActOn('owner', 'member'), true);
	assert.equal(canActOn('staff', 'owner'), false);
	assert.equal(canActOn('staff', 'staff'), false);
	assert.equal(canActOn('staff', 'member'), true);
});

test('account helpers follow the same hierarchy', () => {
	assert.equal(accountTier('owner'), 'owner');
	assert.equal(accountTier('staff'), 'staff');
	assert.equal(accountTier('anything else'), 'staff');
	assert.equal(canActOnAccount('superadmin', 'owner'), true);
	assert.equal(canActOnAccount('owner', 'owner'), false);
	assert.equal(canActOnAccount('owner', 'staff'), true);
	assert.equal(canActOnAccount('staff', 'staff'), false);
	assert.equal(canActOnAccount(null, 'staff'), false);
	assert.deepEqual(invitableAccountTypes('superadmin'), ['owner', 'staff']);
	assert.deepEqual(invitableAccountTypes('owner'), ['staff']);
	assert.deepEqual(invitableAccountTypes('staff'), []);
	assert.deepEqual(invitableAccountTypes(null), []);
});
