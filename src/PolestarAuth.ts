import { URL } from 'node:url';
import { writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'crypto';
import pkceChallenge from 'pkce-challenge';
import type { LoginResponse } from './types/login';

type OidcConfiguration = {
	authorization_endpoint: string;
	token_endpoint: string;
};

class PolestarAuth {
	private static OidcProviderBaseUrl = 'https://polestarid.eu.polestar.com';
	private static OidcClientId = 'l3oopkc_10';
	private static OidcRedirectUri = 'https://www.polestar.com/sign-in-callback';
	protected OidcScope = 'openid profile email customer:attributes';

	private authData: LoginResponse | undefined;
	private expiresAt: Date = new Date(0);
	private tokenPromise: Promise<void> | undefined;

	private email: string;
	private password: string;

	constructor(email: string, password: string) {
		this.email = email;
		this.password = password;
	}

	private BuildAuthParams(state: string, codeChallenge: string) {
		return new URLSearchParams({
			client_id: PolestarAuth.OidcClientId,
			redirect_uri: PolestarAuth.OidcRedirectUri,
			response_type: 'code',
			scope: this.OidcScope,
			state,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256'
		});
	}

	async CacheCredentials(): Promise<void> {
		if (!this.authData) return;
		try {
			await writeFile('.auth.json', JSON.stringify({
				...this.authData,
				expires_at: this.expiresAt.toISOString()
			}));
		} catch (error) {
			console.error('Failed to cache authentication credentials:', error);
		}
	}

	async ReadCachedCredentials(): Promise<void> {
		try {
			const file = await readFile('.auth.json', { encoding: 'utf8' });
			const cached: unknown = JSON.parse(file);
			if (
				typeof cached !== 'object' || cached === null ||
				!('access_token' in cached) || typeof cached.access_token !== 'string' ||
				!('token_type' in cached) || typeof cached.token_type !== 'string' ||
				!('expires_in' in cached) || typeof cached.expires_in !== 'number' ||
				!Number.isFinite(cached.expires_in) || cached.expires_in <= 0
			) {
				throw new Error('Cached credentials are invalid');
			}

			this.authData = {
				access_token: cached.access_token,
				token_type: cached.token_type,
				expires_in: cached.expires_in,
				refresh_token: 'refresh_token' in cached && typeof cached.refresh_token === 'string'
					? cached.refresh_token
					: undefined,
				id_token: 'id_token' in cached && typeof cached.id_token === 'string'
					? cached.id_token
					: undefined,
				expires_at: 'expires_at' in cached && typeof cached.expires_at === 'string'
					? cached.expires_at
					: undefined
			};
			this.expiresAt = 'expires_at' in cached && typeof cached.expires_at === 'string'
				? new Date(cached.expires_at)
				: new Date(0);
			if (Number.isNaN(this.expiresAt.getTime())) {
				throw new Error('Cached token expiry is invalid');
			}
		} catch (error) {
			if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
			console.warn('Unable to use cached authentication credentials; will authenticate again:', error);
			this.authData = undefined;
			this.expiresAt = new Date(0);
		}
	}

	private async getOidcConfiguration(): Promise<OidcConfiguration> {
		const response = await fetch(`${PolestarAuth.OidcProviderBaseUrl}/.well-known/openid-configuration`);
		if (!response.ok) {
			throw new Error(`Failed to fetch OIDC configuration: ${response.status}`);
		}

		const configuration: unknown = await response.json();
		if (
			typeof configuration !== 'object' || configuration === null ||
			!('authorization_endpoint' in configuration) || typeof configuration.authorization_endpoint !== 'string' ||
			!('token_endpoint' in configuration) || typeof configuration.token_endpoint !== 'string'
		) {
			throw new Error('OIDC configuration is invalid');
		}
		return {
			authorization_endpoint: configuration.authorization_endpoint,
			token_endpoint: configuration.token_endpoint
		};
	}

	private parseTokenResponse(payload: unknown, previous: LoginResponse | undefined): LoginResponse {
		if (
			typeof payload !== 'object' || payload === null ||
			!('access_token' in payload) || typeof payload.access_token !== 'string' ||
			!('token_type' in payload) || typeof payload.token_type !== 'string' ||
			!('expires_in' in payload) || typeof payload.expires_in !== 'number' ||
			!Number.isFinite(payload.expires_in) || payload.expires_in <= 0
		) {
			throw new Error('Token endpoint returned an invalid response');
		}

		return {
			access_token: payload.access_token,
			token_type: payload.token_type,
			expires_in: payload.expires_in,
			refresh_token: 'refresh_token' in payload && typeof payload.refresh_token === 'string'
				? payload.refresh_token
				: previous?.refresh_token,
			id_token: 'id_token' in payload && typeof payload.id_token === 'string'
				? payload.id_token
				: previous?.id_token
		};
	}

	private async ensureToken(): Promise<void> {
		if (!this.authData) {
			await this.ReadCachedCredentials();
		}
		if (!this.authData) {
			await this.login();
			return;
		}
		const refreshWindow = Math.min(this.authData.expires_in / 2, 300) * 1000;
		if (this.expiresAt.getTime() - Date.now() > refreshWindow) return;

		try {
			await this.refresh();
		} catch (error) {
			console.warn('Token refresh failed; falling back to a new login:', error);
			this.authData = undefined;
			this.expiresAt = new Date(0);
			await this.login();
		}
	}

	async checkTokenExpiration(): Promise<void> {
		const pending = this.tokenPromise ?? (this.tokenPromise = this.ensureToken().finally(() => {
			this.tokenPromise = undefined;
		}));
		await pending;
	}

	async login(): Promise<void> {
		const { authorization_endpoint: authorizationEndpoint, token_endpoint: tokenEndpoint } =
			await this.getOidcConfiguration();

		const { code_challenge: codeChallenge, code_verifier: codeVerifier } = await pkceChallenge();
		const state = randomBytes(32).toString('base64url');
		const authParams = this.BuildAuthParams(state, codeChallenge);
		const resumeResponse = await fetch(`${authorizationEndpoint}?${authParams}`, {
			redirect: 'manual',
			credentials: 'include'
		});
		const resumeHtml = await resumeResponse.text();
		const resumeMatch = /(?:url|action):\s*"(.+?)"/.exec(resumeHtml);
		if (!resumeMatch) {
			throw new Error('Could not find resume path in login page');
		}

		const cookies = new Map<string, string>();
		const updateCookies = (headers: Headers) => {
			for (const setCookie of headers.getSetCookie()) {
				const cookie = setCookie.split(';', 1)[0];
				const separator = cookie.indexOf('=');
				if (separator > 0) {
					cookies.set(cookie.slice(0, separator), cookie.slice(separator + 1));
				}
			}
		};
		updateCookies(resumeResponse.headers);
		if (cookies.size === 0) {
			throw new Error('Could not find authentication cookies');
		}

		const resumeUrl = new URL(resumeMatch[1], PolestarAuth.OidcProviderBaseUrl);
		resumeUrl.searchParams.set('language', 'en');
		resumeUrl.searchParams.set('market', 'us');
		const loginResponse = await fetch(resumeUrl, {
			body: new URLSearchParams({
				'pf.username': this.email,
				'pf.pass': this.password
			}),
			headers: {
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
			},
			method: 'POST',
			redirect: 'manual'
		});

		if (![302, 303].includes(loginResponse.status)) {
			throw new Error(`Login failed with status ${loginResponse.status}`);
		}
		updateCookies(loginResponse.headers);

		const location = loginResponse.headers.get('Location');
		if (!location) {
			throw new Error('No redirect location after login');
		}
		const redirectUri = new URL(location, PolestarAuth.OidcProviderBaseUrl);
		if (redirectUri.searchParams.get('state') !== state) {
			throw new Error('Login redirect state did not match');
		}
		const code = redirectUri.searchParams.get('code');
		if (!code) {
			throw new Error('Unable to authenticate: redirect did not contain an authorization code');
		}

		const tokenResponse = await fetch(tokenEndpoint, {
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				client_id: PolestarAuth.OidcClientId,
				code,
				redirect_uri: PolestarAuth.OidcRedirectUri,
				code_verifier: codeVerifier
			}),
			cache: 'no-store',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
			},
			method: 'POST'
		});
		if (!tokenResponse.ok) {
			throw new Error(`Unable to exchange authorization code: ${tokenResponse.status}`);
		}

		this.authData = this.parseTokenResponse(await tokenResponse.json(), undefined);
		this.expiresAt = new Date(Date.now() + this.authData.expires_in * 1000);
		await this.CacheCredentials();
	}

	async refresh(): Promise<void> {
		if (!this.authData?.refresh_token) {
			throw new Error('No refresh token is available');
		}

		const { token_endpoint: tokenEndpoint } = await this.getOidcConfiguration();
		const response = await fetch(tokenEndpoint, {
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: this.authData.refresh_token,
				scope: this.OidcScope,
				client_id: PolestarAuth.OidcClientId
			}),
			cache: 'no-store',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			method: 'POST'
		});
		if (!response.ok) {
			throw new Error(`Unable to refresh token: ${response.status}`);
		}

		this.authData = this.parseTokenResponse(await response.json(), this.authData);
		this.expiresAt = new Date(Date.now() + this.authData.expires_in * 1000);
		await this.CacheCredentials();
	}

	async getToken(): Promise<string> {
		await this.checkTokenExpiration();
		if (!this.authData) {
			throw new Error('Failed to login');
		}

		return `${this.authData.token_type} ${this.authData.access_token}`;
	}
}

export {
	PolestarAuth
}
