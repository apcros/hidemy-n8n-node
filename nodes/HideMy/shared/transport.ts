import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

export const CREDENTIAL_NAME = 'hideMyApi';
export const API_BASE_URL = 'https://api.hidemy.world/v1';

export type HideMyContext =
	| IHookFunctions
	| IExecuteFunctions
	| IExecuteSingleFunctions
	| ILoadOptionsFunctions
	| IWebhookFunctions;

/** Authenticated request against the HideMy.world public API (`/v1`). */
export async function hideMyApiRequest(
	this: HideMyContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs: IDataObject = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${API_BASE_URL}${endpoint}`,
		qs,
		json: true,
		headers: { Accept: 'application/json' },
	};
	if (body !== undefined) {
		options.body = body;
	}
	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		CREDENTIAL_NAME,
		options,
	)) as IDataObject;
}

/** Fetches every item of a `{ items: [...] }` endpoint (the list endpoints are not paginated). */
export async function hideMyApiListAll(
	this: HideMyContext,
	endpoint: string,
	qs: IDataObject = {},
): Promise<IDataObject[]> {
	const response = await hideMyApiRequest.call(this, 'GET', endpoint, undefined, qs);
	return Array.isArray(response.items) ? (response.items as IDataObject[]) : [];
}
