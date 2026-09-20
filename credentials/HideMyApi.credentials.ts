import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HideMyApi implements ICredentialType {
	name = 'hideMyApi';

	displayName = 'HideMy.world API';

	icon: Icon = { light: 'file:../icons/hidemy.svg', dark: 'file:../icons/hidemy.dark.svg' };

	documentationUrl = 'https://github.com/apcros/hidemy-n8n-node?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'e.g. hm_live_5f2a…',
			description:
				'Create a key in the HideMy.world dashboard under API keys. Keys are shown once at creation',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.hidemy.world',
			url: '/v1',
			method: 'GET',
		},
	};
}
