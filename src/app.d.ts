declare global {
	namespace App {
		interface Locals {
			user:
				| { authenticated: true; account_id: number; username: string; email: string; account_type: string }
				| { authenticated: false; can_register: boolean };
			sessionId: string | null;
		}
	}
}

export {};
