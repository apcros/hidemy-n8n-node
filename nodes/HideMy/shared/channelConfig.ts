import type { IDataObject, IExecuteSingleFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, jsonParse } from 'n8n-workflow';

export const CHANNEL_TYPE_OPTIONS = [
	{ name: 'Discord', value: 'discord', description: 'Post a message to a Discord webhook' },
	{
		name: 'Forward',
		value: 'forward',
		description: 'Forward the email to a verified address (verify it in the dashboard first)',
	},
	{ name: 'Notion', value: 'notion', description: 'Create a page in a Notion database' },
	{ name: 'Ntfy', value: 'ntfy', description: 'Push a notification to an ntfy topic' },
	{ name: 'Slack', value: 'slack', description: 'Post a message to a Slack incoming webhook' },
	{
		name: 'Telegram',
		value: 'telegram',
		description: 'Send a Telegram message (link Telegram in the dashboard first)',
	},
	{ name: 'Webhook', value: 'webhook', description: 'POST the email as signed JSON to a URL' },
];

const TEMPLATE_DESCRIPTION =
	'Message template with {{subject}}, {{from.email}}, {{alias}} or {{transformed.fields.X}} placeholders. Leave empty for the default';

/** Type-specific parameters for "Channel > Create". */
export function channelConfigProperties(show: Record<string, string[]>): INodeProperties[] {
	return [
		// webhook
		{
			displayName: 'URL',
			name: 'url',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. https://example.com/hooks/email',
			description: 'Public https URL that receives the signed JSON payload',
			displayOptions: { show: { ...show, type: ['webhook'] } },
		},
		{
			displayName: 'Payload Mode',
			name: 'payloadMode',
			type: 'options',
			options: [
				{
					name: 'Combined',
					value: 'combined',
					description: 'Full email JSON plus the transformed fields',
				},
				{ name: 'Raw', value: 'raw', description: 'Full email JSON only' },
				{
					name: 'Transformed',
					value: 'transformed',
					description: 'Transformed fields only (the email is null)',
				},
			],
			default: 'combined',
			description: 'What the webhook body contains',
			displayOptions: { show: { ...show, type: ['webhook'] } },
		},
		// forward
		{
			displayName: 'Destination Email',
			name: 'destinationEmail',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. me@example.com',
			description: 'Address to forward to. It has to be verified in the HideMy.world dashboard.',
			displayOptions: { show: { ...show, type: ['forward'] } },
		},
		// slack / discord
		{
			displayName: 'Webhook URL',
			name: 'webhookUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. https://hooks.slack.com/services/T000/B000/XXXX',
			description: 'Incoming-webhook URL of the workspace or server',
			displayOptions: { show: { ...show, type: ['slack', 'discord'] } },
		},
		// ntfy
		{
			displayName: 'Topic',
			name: 'topic',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. my-inbox',
			description: 'Ntfy topic (letters, digits, dashes and underscores)',
			displayOptions: { show: { ...show, type: ['ntfy'] } },
		},
		// notion
		{
			displayName: 'Integration Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'e.g. ntn_…',
			description: 'Secret of a Notion internal integration that can access the database',
			displayOptions: { show: { ...show, type: ['notion'] } },
		},
		{
			displayName: 'Database ID',
			name: 'databaseId',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
			description: 'The 32-character ID from the database URL',
			displayOptions: { show: { ...show, type: ['notion'] } },
		},
		// additional fields
		{
			displayName: 'Additional Fields',
			name: 'additionalFields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show },
			options: [
				{
					displayName: 'Custom Headers',
					name: 'headers',
					type: 'fixedCollection',
					typeOptions: { multipleValues: true },
					placeholder: 'Add Header',
					default: {},
					description: 'Up to 5 extra headers sent with every webhook call',
					displayOptions: { show: { '/type': ['webhook'] } },
					options: [
						{
							displayName: 'Header',
							name: 'header',
							values: [
								{
									displayName: 'Name',
									name: 'name',
									type: 'string',
									default: '',
									placeholder: 'e.g. X-Source',
								},
								{
									displayName: 'Value',
									name: 'value',
									type: 'string',
									default: '',
									placeholder: 'e.g. hidemy',
								},
							],
						},
					],
				},
				{
					displayName: 'Max Attempts',
					name: 'maxAttempts',
					type: 'number',
					typeOptions: { minValue: 1, maxValue: 10 },
					default: 5,
					description: 'How many times a failed webhook delivery is retried with backoff',
					displayOptions: { show: { '/type': ['webhook'] } },
				},
				{
					displayName: 'Secret',
					name: 'secret',
					type: 'string',
					typeOptions: { password: true },
					default: '',
					description: 'Signing secret for the X-HideMy-Signature header. Generated by HideMy.world when left empty.',
					displayOptions: { show: { '/type': ['webhook'] } },
				},
				{
					displayName: 'Server',
					name: 'server',
					type: 'string',
					default: '',
					placeholder: 'e.g. https://ntfy.sh',
					description: 'Ntfy server. Leave empty for https://ntfy.sh.',
					displayOptions: { show: { '/type': ['ntfy'] } },
				},
				{
					displayName: 'Template',
					name: 'template',
					type: 'string',
					typeOptions: { rows: 3 },
					default: '',
					description: TEMPLATE_DESCRIPTION,
					displayOptions: { show: { '/type': ['slack', 'discord', 'ntfy', 'telegram'] } },
				},
				{
					displayName: 'Title Property',
					name: 'titleProperty',
					type: 'string',
					default: '',
					placeholder: 'e.g. Name',
					description: 'Title property of the Notion database. Leave empty for "Name".',
					displayOptions: { show: { '/type': ['notion'] } },
				},
			],
		},
	];
}

type HeaderRow = { name?: string; value?: string };

/** Assembles the `config` object the API expects for the selected channel type. */
export function buildChannelConfig(this: IExecuteSingleFunctions, type: string): IDataObject {
	const additional = this.getNodeParameter('additionalFields', {}) as IDataObject;
	const template = typeof additional.template === 'string' ? additional.template.trim() : '';
	const config: IDataObject = {};

	switch (type) {
		case 'webhook': {
			config.url = (this.getNodeParameter('url') as string).trim();
			config.payload_mode = this.getNodeParameter('payloadMode', 'combined');
			const headers: IDataObject = {};
			const rows = (additional.headers as { header?: HeaderRow[] } | undefined)?.header ?? [];
			for (const row of rows) {
				if (row.name && row.name.trim() !== '') headers[row.name.trim()] = row.value ?? '';
			}
			config.headers = headers;
			if (typeof additional.secret === 'string' && additional.secret.trim() !== '') {
				config.secret = additional.secret.trim();
			}
			if (additional.maxAttempts !== undefined) {
				config.retry = { max_attempts: Number(additional.maxAttempts) };
			}
			break;
		}
		case 'forward':
			config.destination_email = (this.getNodeParameter('destinationEmail') as string).trim();
			break;
		case 'slack':
		case 'discord':
			config.webhook_url = (this.getNodeParameter('webhookUrl') as string).trim();
			if (template) config.template = template;
			break;
		case 'ntfy':
			config.topic = (this.getNodeParameter('topic') as string).trim();
			if (typeof additional.server === 'string' && additional.server.trim() !== '') {
				config.server = additional.server.trim();
			}
			if (template) config.template = template;
			break;
		case 'notion':
			config.token = (this.getNodeParameter('token') as string).trim();
			config.database_id = (this.getNodeParameter('databaseId') as string).trim();
			if (typeof additional.titleProperty === 'string' && additional.titleProperty.trim() !== '') {
				config.title_property = additional.titleProperty.trim();
			}
			break;
		case 'telegram':
			if (template) config.template = template;
			break;
		default:
			throw new NodeOperationError(this.getNode(), `Unknown channel type '${type}'`);
	}
	return config;
}

/** Parses the optional "Config (JSON)" of "Channel > Update". */
export function parseConfigJson(this: IExecuteSingleFunctions, raw: unknown): IDataObject {
	let parsed: unknown = raw;
	if (typeof raw === 'string') {
		try {
			parsed = jsonParse<IDataObject>(raw);
		} catch {
			throw new NodeOperationError(
				this.getNode(),
				"'Config (JSON)' is not valid JSON. Provide the full config object for the channel type",
			);
		}
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new NodeOperationError(this.getNode(), "'Config (JSON)' must be a JSON object");
	}
	return parsed as IDataObject;
}
