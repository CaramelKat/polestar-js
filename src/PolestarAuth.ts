import { URL } from 'node:url';
import { writeFile, readFile } from 'node:fs/promises';
import { randomBytes } from 'crypto'
import pkceChallenge from "pkce-challenge";
import type { LoginResponse } from './types/login';

class PolestarAuth {
	private static OidcProviderBaseUrl = "https://polestarid.eu.polestar.com";
	private static OidcClientId = "l3oopkc_10";
	private static OidcRedirectUri = "https://www.polestar.com/sign-in-callback";
	protected OidcScope = "openid profile email customer:attributes";

	private authData: LoginResponse | undefined;
	private expiresAt: Date = PolestarAuth.getDateFromNow(-60);

	private email: string;
	private password: string;

	constructor(email: string, password: string) {
		this.email = email;
		this.password = password;
	}

	private static getDateFromNow(seconds: number): Date {
		const dateNow = new Date();
		return new Date(dateNow.getTime() + seconds * 1000);
	}

	private BuildAuthParams(state: string, codeChallenge: string) {
		return new URLSearchParams({
			"client_id": PolestarAuth.OidcClientId,
			"redirect_uri": PolestarAuth.OidcRedirectUri,
			"response_type": "code",
			"scope": this.OidcScope,
			"state": state,
			"code_challenge": codeChallenge,
			"code_challenge_method": "S256"
		}).toString();
	}

	async CacheCredentials() {
		if (!this.authData) return;
		try {
			await writeFile('.auth.json', JSON.stringify(this.authData),);
		} catch (err) {
			console.error(err);
		}
	}

	async ReadCachedCredentials() {
		try {
			const file = await readFile('.auth.json', { encoding: 'utf8' });
			this.authData = JSON.parse(file);
		} catch (err) {
			console.debug(err);
		}
	}

	async checkTokenExpiration() {
		if (!this.authData) {
			console.debug('We haven\'t logged in yet! Do we have cached credentials?');
			await this.ReadCachedCredentials();
			if (!this.authData) {
				console.debug('No cache, trying to login')
				return await this.login();
			}
		}
		if (this.expiresAt < new Date()) {
			console.debug('Token has expired, requesting new token');
			await this.refresh();
		}
	}

	async login() {
		// Step 1: Fetch OIDC configuration
		const oidcResponse = await fetch(`${PolestarAuth.OidcProviderBaseUrl}/.well-known/openid-configuration`);
		if (oidcResponse.status != 200)
			throw Error('Failed to fetch config');

		const oidcDoc = await oidcResponse.json();
		const { authorization_endpoint: authorizationEndpoint, token_endpoint: tokenEndpoint } = oidcDoc;

		// Step 2: Generate PKCE values
		const { code_challenge: codeChallenge, code_verifier: codeVerifier } =  await pkceChallenge();
		const state = randomBytes(32).toString('base64');

		// Step 3: Get resume path (allow redirects for this step)
		const authParams = this.BuildAuthParams(state, codeChallenge);

		const resumeResponse = await fetch(`${authorizationEndpoint}?${authParams}`, { redirect: 'manual', credentials: "include" });
		const resumeHtml = await resumeResponse.text();
		const resumeCookie = resumeResponse.headers.get('set-cookie')?.split(';')[0];

		const resumeMatch = /(?:url|action):\s*"(.+?)"/.exec(resumeHtml);

		if (!resumeMatch)
			throw Error('Could not find resume path in login page');

		if (!resumeCookie)
			throw Error('Could not find extra auth cookie');

		const resumePath =  resumeMatch[1];

		// Step 4: Submit credentials
		const loginResp = await fetch(`${PolestarAuth.OidcProviderBaseUrl}${resumePath}?language=en&market=us`, {
			"body": new URLSearchParams({
				'pf.username': this.email,
				'pf.pass': this.password,
			}).toString(),
			"headers": {
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Content-Type": "application/x-www-form-urlencoded",
				"Cookie": resumeCookie
			},
			"method": "POST",
			"redirect": "manual"
		});

		if (![302, 303].includes(loginResp.status)) {
			throw Error(`Login failed with status ${loginResp.status}`);
		}

		const location = loginResp.headers.get('Location');

		if (!location || location == '')
			throw Error('No redirect location after login');

		const redirectUri = new URL(location);
		const code = redirectUri.searchParams.get('code')

		if (!code) {
			//TODO: handle EULA
			throw Error('Unable to auth! Missing code from redirect');
		}

		// Step 5: Exchange code for tokens
		const tokenResp = await fetch(tokenEndpoint, {
			"body": new URLSearchParams({
				grant_type: "authorization_code",
				client_id:  PolestarAuth.OidcClientId,
				code: code,
				redirect_uri: PolestarAuth.OidcRedirectUri,
				code_verifier: codeVerifier
			}).toString(),
			"cache": "default",
			"credentials": "include",
			"headers": {
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Content-Type": "application/x-www-form-urlencoded",
				"Cookie": resumeCookie
			},
			"method": "POST",
			"redirect": "manual"
		});

		if (tokenResp.status != 200)
			throw Error('Unable to auth!');

		this.authData = await tokenResp.json();
		if (!this.authData)
			throw Error('Failed to login!');
		else
			console.debug('Logged in!');

		this.expiresAt = PolestarAuth.getDateFromNow(this.authData?.expires_in);
		this.CacheCredentials();
	}

	async refresh() {
		const request = await fetch("https://polestarid.eu.polestar.com/as/token.oauth2", {
			"body": `grant_type=refresh_token&refresh_token=${this.authData?.refresh_token}&scope=${this.OidcScope}&client_id=${PolestarAuth.OidcClientId}`,
			"cache": "default",
			"credentials": "omit",
			"headers": {
				"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Content-Type": "application/x-www-form-urlencoded"
			},
			"method": "POST",
			"redirect": "follow"
		})
		if (request.status != 200)
			throw Error(`Unable to refresh token: ${request.status}, ${request}`);

		this.authData  = await request.json();
		if (!this.authData)
			throw Error('Failed to refresh token!');

		this.expiresAt = PolestarAuth.getDateFromNow(this.authData?.expires_in);
		this.CacheCredentials();
	}

	async getToken() {
		await this.checkTokenExpiration();
		if (!this.authData)
			throw Error('Failed to login!');

		return `${this.authData?.token_type} ${this.authData?.access_token}`;
	}
}

export {
	PolestarAuth
}
