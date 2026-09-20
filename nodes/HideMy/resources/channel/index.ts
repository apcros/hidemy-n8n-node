import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';
import {
	CHANNEL_TYPE_OPTIONS,
	buildChannelConfig,
	channelConfigProperties,
	parseConfigJson,
} from '../../shared/channelConfig';
import { channelLocator, returnAllAndLimit, rootPropertyItems } from '../../shared/descriptions';

const showOnlyForChannels = { resource: ['channel'] };

async function channelCreatePreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const type = this.getNodeParameter('type') as string;
	requestOptions.body = {
		type,
		name: (this.getNodeParameter('name') as string).trim(),
		config: buildChannelConfig.call(this, type),
	};
	return requestOptions;
}

async function channelUpdatePreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const fields = this.getNodeParameter('updateFields', {}) as IDataObject;
	const body: IDataObject = {};
	if (typeof fields.name === 'string' && fields.name.trim() !== '') body.name = fields.name.trim();
	if (typeof fields.status === 'string') body.status = fields.status;
	if (fields.config !== undefined && fields.config !== '') {
		body.config = parseConfigJson.call(this, fields.config);
	}
	requestOptions.body = body;
	return requestOptions;
}

export const channelDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForChannels },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a channel',
				description: 'Create a delivery channel (webhook, Slack, Discord, ntfy, Notion, Telegram or forward)',
				routing: {
					request: { method: 'POST', url: '/channels' },
					send: { preSend: [channelCreatePreSend] },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a channel',
				description: 'Delete a channel and detach it from every pipeline',
				routing: {
					request: { method: 'DELETE', url: '=/channels/{{$parameter.channel}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a channel',
				description: 'Get one channel including its configuration',
				routing: {
					request: { method: 'GET', url: '=/channels/{{$parameter.channel}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many channels',
				description: 'List the delivery channels of your account',
				routing: {
					request: { method: 'GET', url: '/channels' },
					output: rootPropertyItems,
				},
			},
			{
				name: 'Test',
				value: 'test',
				action: 'Send a test delivery to a channel',
				description: 'Send a synthetic email through the channel now and return the attempt',
				routing: {
					request: { method: 'POST', url: '=/channels/{{$parameter.channel}}/test' },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a channel',
				description: 'Rename, pause or resume a channel, or replace its configuration',
				routing: {
					request: { method: 'PATCH', url: '=/channels/{{$parameter.channel}}' },
					send: { preSend: [channelUpdatePreSend] },
				},
			},
		],
		default: 'getAll',
	},

	// ----- delete / get / test / update -----
	{
		...channelLocator,
		displayOptions: {
			show: { ...showOnlyForChannels, operation: ['delete', 'get', 'test', 'update'] },
		},
	},

	// ----- create -----
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Ops Slack',
		description: 'Name of the channel',
		displayOptions: { show: { ...showOnlyForChannels, operation: ['create'] } },
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		noDataExpression: true,
		options: CHANNEL_TYPE_OPTIONS,
		default: 'webhook',
		description: 'Where matching emails are delivered',
		displayOptions: { show: { ...showOnlyForChannels, operation: ['create'] } },
	},
	...channelConfigProperties({ ...showOnlyForChannels, operation: ['create'] }),

	// ----- get many -----
	...returnAllAndLimit({ ...showOnlyForChannels, operation: ['getAll'] }, { paginated: false }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { ...showOnlyForChannels, operation: ['getAll'] } },
		options: [
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: CHANNEL_TYPE_OPTIONS.map(({ name, value }) => ({ name, value })),
				default: 'webhook',
				description: 'Only return channels of this type',
				routing: { send: { type: 'query', property: 'type' } },
			},
		],
	},

	// ----- update -----
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForChannels, operation: ['update'] } },
		options: [
			{
				displayName: 'Config (JSON)',
				name: 'config',
				type: 'json',
				default: '',
				description: 'Full replacement of the channel configuration for its type, for example {"URL": "...", "payload_mode": "combined"} for a webhook. See GET /v1 for every shape.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				placeholder: 'e.g. Ops Slack',
				description: 'New name of the channel',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active', description: 'The channel delivers' },
					{ name: 'Paused', value: 'paused', description: 'Deliveries to the channel are skipped' },
				],
				default: 'active',
			},
		],
	},
];
