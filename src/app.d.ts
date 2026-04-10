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
						panel_id: number | null;
						is_demo?: boolean;
						session_expires_at?: number;
				  }
				| {
						authenticated: true;
						account_id: number;
						username: string;
						email: string;
						account_type: 'owner' | 'staff';
						account_source: 'server_accounts';
						bot_id: number;
						server_id: number;
						is_demo?: boolean;
						session_expires_at?: number;
				  }
				| { authenticated: false; can_register: boolean };
			sessionId: string | null;
		}
	}
}

export {};
