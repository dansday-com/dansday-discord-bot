declare global {
	namespace App {
		interface Locals {
			user:
				| {
						authenticated: true;
						account_id: number;
						username: string;
						email: string;
						account_type: 'superadmin';
						account_source: 'accounts';
				  }
				| {
						authenticated: true;
						account_id: number;
						username: string;
						email: string;
						account_type: 'owner' | 'moderator';
						account_source: 'server_accounts';
						bot_id: number;
						server_id: number;
				  }
				| { authenticated: false; can_register: boolean };
			sessionId: string | null;
		}
	}
}

export {};
