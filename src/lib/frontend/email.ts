import nodemailer from 'nodemailer';

function getTransporter() {
	const host = process.env.MAIL_HOST;
	const port = parseInt(process.env.MAIL_PORT || '587');
	const username = process.env.MAIL_USERNAME;
	const password = process.env.MAIL_PASSWORD;

	if (!host || !username || !password) {
		const missing = [];
		if (!host) missing.push('MAIL_HOST');
		if (!username) missing.push('MAIL_USERNAME');
		if (!password) missing.push('MAIL_PASSWORD');
		throw new Error(`Missing email configuration: ${missing.join(', ')}. Please set these in your .env file.`);
	}

	return nodemailer.createTransport({
		host,
		port,
		secure: false,
		auth: { user: username, pass: password },
		tls: { rejectUnauthorized: false, requireTLS: true, ciphers: 'SSLv3' }
	});
}

const APP_NAME = '</DANSDAY> Discord Bot Panel';

const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
        --bg: #f6f7fb;
        --wrapper-bg: #ffffff;
        --surface: #f1f3f8;
        --border: #e5e7ef;
        --text: #111827;
        --muted: #4b5563;
        --subtle: #6b7280;
        --link: #4f46e5;
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --bg: #0f0f13;
            --wrapper-bg: #1a1a24;
            --surface: #12121a;
            --border: #2e2e3e;
            --text: #f1f1f5;
            --muted: #b0b0c0;
            --subtle: #6b6b80;
            --link: #a5b4fc;
        }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: var(--text); background-color: var(--bg); }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: var(--wrapper-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .header { background-color: var(--surface); padding: 32px 30px; text-align: center; border-bottom: 1px solid var(--border); }
    .header h1 { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
    .header .app-name { font-size: 13px; color: var(--subtle); font-weight: 400; }
    .content { padding: 36px 30px; }
    .content p { font-size: 15px; color: var(--muted); margin-bottom: 14px; }
    .content p:first-child { font-size: 17px; color: var(--text); font-weight: 500; margin-bottom: 18px; }
    .footer { text-align: center; padding: 24px 30px; background-color: var(--surface); border-top: 1px solid var(--border); }
    .footer p { font-size: 12px; color: var(--subtle); margin: 3px 0; }
    .footer a { color: var(--link); text-decoration: none; }
`;

function emailLayout(title: string, accentColor: string, bodyContent: string, year: number) {
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                ${baseStyles}
                .highlight-box { background-color: var(--surface); border: 1px solid ${accentColor}40; border-left: 3px solid ${accentColor}; padding: 20px 24px; margin: 24px 0; border-radius: 8px; }
                .highlight-box p { margin: 0; font-size: 14px; color: var(--muted); line-height: 1.6; }
                .status-box { background-color: var(--surface); border: 1px solid ${accentColor}40; padding: 28px 24px; margin: 28px 0; border-radius: 10px; text-align: center; }
                .status-box .icon { font-size: 40px; margin-bottom: 12px; }
                .status-box p { margin: 0; font-size: 16px; color: ${accentColor}; font-weight: 600; }
                .otp-container { margin: 28px 0; text-align: center; }
                .otp-label { font-size: 12px; color: #6b6b80; margin-bottom: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1.5px; }
                .otp-code { background-color: var(--surface); color: ${accentColor}; font-size: 38px; font-weight: 700; padding: 22px 36px; border-radius: 10px; letter-spacing: 14px; display: inline-block; border: 1px solid ${accentColor}40; font-family: 'Courier New', monospace; }
                .expiry-notice { background-color: var(--surface); border: 1px solid #f59e0b40; border-left: 3px solid #f59e0b; padding: 14px 18px; margin: 20px 0; border-radius: 8px; }
                .expiry-notice p { margin: 0; font-size: 13px; color: #a07820; }
            </style>
        </head>
        <body style="background-color: var(--bg); padding: 24px 16px;">
            <div class="email-wrapper">
                <div class="header">
                    <h1>${title}</h1>
                    <div class="app-name">${APP_NAME}</div>
                </div>
                <div class="content">
                    ${bodyContent}
                </div>
                <div class="footer">
                    <p>© ${year} <a href="https://dansday.com">${APP_NAME}</a>. All rights reserved.</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

export async function sendOTPEmail(email: string, otpCode: string) {
	const transporter = getTransporter();
	const subject = 'Your Verification Code';
	const year = new Date().getFullYear();

	const body = `
        <p>Hello,</p>
        <p>You've requested a verification code to access your account. Use the code below to complete your login:</p>
        <div class="otp-container">
            <div class="otp-label">Verification Code</div>
            <div class="otp-code">${otpCode}</div>
        </div>
        <div class="expiry-notice">
            <p>⏰ This code will expire in <strong>10 minutes</strong>.</p>
        </div>
        <div class="highlight-box">
            <p>🔒 If you didn't request this code, you can safely ignore this email. Your account remains secure.</p>
        </div>
    `;

	const mailOptions = {
		from: `"${APP_NAME}" <${process.env.MAIL_USERNAME}>`,
		to: email,
		subject,
		html: emailLayout(subject, '#818cf8', body, year)
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		return { success: true, messageId: info.messageId };
	} catch (error: any) {
		throw new Error(`Failed to send email: ${error.message}`);
	}
}

export async function sendVerificationSuccessEmail(email: string, username: string) {
	const transporter = getTransporter();
	const subject = 'Email Verified Successfully';
	const year = new Date().getFullYear();

	const body = `
        <p>Hello ${username},</p>
        <p>Your email has been successfully verified!</p>
        <div class="status-box">
            <div class="icon">🎉</div>
            <p>Your account is now active and ready to use.</p>
        </div>
        <div class="highlight-box">
            <p><strong>What's next?</strong><br>You can now log in and access the dashboard to manage your bots. If you have any questions, feel free to reach out to an administrator.</p>
        </div>
    `;

	const mailOptions = {
		from: `"${APP_NAME}" <${process.env.MAIL_USERNAME}>`,
		to: email,
		subject,
		html: emailLayout(subject, '#34d399', body, year)
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		return { success: true, messageId: info.messageId };
	} catch (error: any) {
		throw new Error(`Failed to send email: ${error.message}`);
	}
}

export async function sendAccountFrozenEmail(email: string, username: string) {
	const transporter = getTransporter();
	const subject = 'Account Frozen - Action Required';
	const year = new Date().getFullYear();

	const body = `
        <p>Hello ${username},</p>
        <p>Your account has been frozen by an administrator.</p>
        <div class="status-box">
            <div class="icon">⚠️</div>
            <p>Your account access has been temporarily restricted.</p>
        </div>
        <div class="highlight-box">
            <p><strong>What does this mean?</strong><br>You will not be able to log in or access your account until it is unfrozen by an administrator. If you believe this is an error, please contact an administrator.</p>
        </div>
    `;

	const mailOptions = {
		from: `"${APP_NAME}" <${process.env.MAIL_USERNAME}>`,
		to: email,
		subject,
		html: emailLayout(subject, '#f59e0b', body, year)
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		return { success: true, messageId: info.messageId };
	} catch (error: any) {
		throw new Error(`Failed to send email: ${error.message}`);
	}
}

export async function sendAccountUnfrozenEmail(email: string, username: string) {
	const transporter = getTransporter();
	const subject = 'Account Unfrozen - Access Restored';
	const year = new Date().getFullYear();

	const body = `
        <p>Hello ${username},</p>
        <p>Your account has been unfrozen by an administrator.</p>
        <div class="status-box">
            <div class="icon">🎉</div>
            <p>Your account access has been restored.</p>
        </div>
        <div class="highlight-box">
            <p><strong>What's next?</strong><br>You can now log in and access your account normally. If you have any questions or need assistance, feel free to reach out.</p>
        </div>
    `;

	const mailOptions = {
		from: `"${APP_NAME}" <${process.env.MAIL_USERNAME}>`,
		to: email,
		subject,
		html: emailLayout(subject, '#34d399', body, year)
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		return { success: true, messageId: info.messageId };
	} catch (error: any) {
		throw new Error(`Failed to send email: ${error.message}`);
	}
}

export async function sendAccountDeletedEmail(email: string, username: string) {
	const transporter = getTransporter();
	const subject = 'Account Deleted - Important Notice';
	const year = new Date().getFullYear();

	const body = `
        <p>Hello ${username},</p>
        <p>Your account has been deleted by an administrator.</p>
        <div class="status-box">
            <div class="icon">🗑️</div>
            <p>Your account and all associated data have been permanently removed.</p>
        </div>
        <div class="highlight-box">
            <p><strong>Important:</strong><br>This action cannot be undone. If you believe this is an error, please contact an administrator immediately.</p>
        </div>
    `;

	const mailOptions = {
		from: `"${APP_NAME}" <${process.env.MAIL_USERNAME}>`,
		to: email,
		subject,
		html: emailLayout(subject, '#f87171', body, year)
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		return { success: true, messageId: info.messageId };
	} catch (error: any) {
		throw new Error(`Failed to send email: ${error.message}`);
	}
}

export default {
	sendOTPEmail,
	sendVerificationSuccessEmail,
	sendAccountFrozenEmail,
	sendAccountUnfrozenEmail,
	sendAccountDeletedEmail
};
