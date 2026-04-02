declare global {
	namespace App {
		interface Locals {
			user:
				| {
						authenticated: true;
						account_id: number;
						username: string;
						email: string;
						account_type: 'superadmin' | 'owner' | 'moderator';
						accessible_servers?: Array<{ server_id: number; role: 'owner' | 'moderator' }>;
				  }
				| { authenticated: false; can_register: boolean };
			sessionId: string | null;
		}
	}
}

export {};
