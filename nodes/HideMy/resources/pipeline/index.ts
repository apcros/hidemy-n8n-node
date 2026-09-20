import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';
import {
	addressLocator,
	channelLocator,
	pipelineLocator,
	returnAllAndLimit,
	rootPropertyItems,
} from '../../shared/descriptions';
import { buildRuleset, rulesetProperties } from '../../shared/ruleset';

const showOnlyForPipelines = { resource: ['pipeline'] };

/**
 * Channel IDs come from a multi-options parameter. n8n wraps an expression result in
 * an array, so `{{ [a, b] }}` arrives as `[[a, b]]`; a plain `{{ $json.id }}` as `[id]`.
 */
function normalizeIds(value: unknown): string[] | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const flat = (Array.isArray(value) ? value.flat(Infinity) : [value]) as unknown[];
	return flat.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
}

async function pipelineCreatePreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body: IDataObject = { name: (this.getNodeParameter('name') as string).trim() };
	const ruleset = buildRuleset.call(this);
	if (ruleset) body.ruleset = ruleset;
	const additional = this.getNodeParameter('additionalFields', {}) as IDataObject;
	if (typeof additional.transformerId === 'string' && additional.transformerId !== '') {
		body.transformer_id = additional.transformerId;
	}
	const channelIds = normalizeIds(additional.channelIds);
	if (channelIds) body.channel_ids = channelIds;
	if (typeof additional.storeCopy === 'boolean') body.store_copy = additional.storeCopy;
	if (typeof additional.status === 'string') body.status = additional.status;
	requestOptions.body = body;
	return requestOptions;
}

async function pipelineUpdatePreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body: IDataObject = {};
	const ruleset = buildRuleset.call(this);
	if (ruleset) body.ruleset = ruleset;
	const fields = this.getNodeParameter('updateFields', {}) as IDataObject;
	if (typeof fields.name === 'string' && fields.name.trim() !== '') body.name = fields.name.trim();
	if (typeof fields.status === 'string') body.status = fields.status;
	if (typeof fields.storeCopy === 'boolean') body.store_copy = fields.storeCopy;
	if (typeof fields.order === 'number') body.order = fields.order;
	const channelIds = normalizeIds(fields.channelIds);
	if (channelIds) body.channel_ids = channelIds;
	if (typeof fields.transformerId === 'string') {
		body.transformer_id = fields.transformerId === '' ? null : fields.transformerId;
	}
	requestOptions.body = body;
	return requestOptions;
}

const transformerOption: INodeProperties = {
	displayName: 'Transformer Name or ID',
	name: 'transformerId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getTransformerOptions' },
	default: '',
	description: 'Transformer that extracts structured fields from matching emails. ,. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

const channelsOption: INodeProperties = {
	displayName: 'Channel Names or IDs',
	name: 'channelIds',
	type: 'multiOptions',
	typeOptions: { loadOptionsMethod: 'getChannelOptions' },
	default: [],
	description: 'Delivery channels that receive matching emails. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

const storeCopyOption: INodeProperties = {
	displayName: 'Store Copy',
	name: 'storeCopy',
	type: 'boolean',
	default: true,
	description: 'Whether matching emails are kept in your HideMy.world inbox',
};

const statusOption: INodeProperties = {
	displayName: 'Status',
	name: 'status',
	type: 'options',
	options: [
		{ name: 'Active', value: 'active', description: 'The pipeline evaluates incoming email' },
		{ name: 'Paused', value: 'paused', description: 'The pipeline is skipped' },
	],
	default: 'active',
};

export const pipelineDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForPipelines },
		options: [
			{
				name: 'Attach Channel',
				value: 'attachChannel',
				action: 'Attach a channel to a pipeline',
				description: 'Add a delivery channel to a pipeline',
				routing: {
					request: {
						method: 'POST',
						url: '=/pipelines/{{$parameter.pipeline}}/channels/{{$parameter.channel}}',
					},
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a pipeline',
				description: 'Create a pipeline (rules, transformer, delivery channels) on an address',
				routing: {
					request: { method: 'POST', url: '=/aliases/{{$parameter.address}}/pipelines' },
					send: { preSend: [pipelineCreatePreSend] },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a pipeline',
				description: 'Delete a pipeline',
				routing: {
					request: { method: 'DELETE', url: '=/pipelines/{{$parameter.pipeline}}' },
				},
			},
			{
				name: 'Detach Channel',
				value: 'detachChannel',
				action: 'Detach a channel from a pipeline',
				description: 'Remove a delivery channel from a pipeline',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/pipelines/{{$parameter.pipeline}}/channels/{{$parameter.channel}}',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a pipeline',
				description: 'Get one pipeline with its rules and channels',
				routing: {
					request: { method: 'GET', url: '=/pipelines/{{$parameter.pipeline}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many pipelines',
				description: 'List the pipelines of an address in evaluation order',
				routing: {
					request: { method: 'GET', url: '=/aliases/{{$parameter.address}}/pipelines' },
					output: rootPropertyItems,
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a pipeline',
				description: 'Change the rules, name, status, transformer or channels of a pipeline',
				routing: {
					request: { method: 'PATCH', url: '=/pipelines/{{$parameter.pipeline}}' },
					send: { preSend: [pipelineUpdatePreSend] },
				},
			},
		],
		default: 'getAll',
	},

	// ----- address (create, get many) -----
	{
		...addressLocator,
		displayOptions: { show: { ...showOnlyForPipelines, operation: ['create', 'getAll'] } },
	},

	// ----- pipeline (attach, delete, detach, get, update) -----
	{
		...pipelineLocator,
		displayOptions: {
			show: {
				...showOnlyForPipelines,
				operation: ['attachChannel', 'delete', 'detachChannel', 'get', 'update'],
			},
		},
	},

	// ----- channel (attach, detach) -----
	{
		...channelLocator,
		displayOptions: {
			show: { ...showOnlyForPipelines, operation: ['attachChannel', 'detachChannel'] },
		},
	},

	// ----- create -----
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. Supplier invoices to Slack',
		description: 'Name of the pipeline',
		displayOptions: { show: { ...showOnlyForPipelines, operation: ['create'] } },
	},
	...rulesetProperties({ ...showOnlyForPipelines, operation: ['create'] }, { allowKeep: false }),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForPipelines, operation: ['create'] } },
		options: [channelsOption, statusOption, storeCopyOption, transformerOption],
	},

	// ----- get many -----
	...returnAllAndLimit({ ...showOnlyForPipelines, operation: ['getAll'] }, { paginated: false }),

	// ----- update -----
	...rulesetProperties({ ...showOnlyForPipelines, operation: ['update'] }, { allowKeep: true }),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForPipelines, operation: ['update'] } },
		options: [
			{
				...channelsOption,
				description: `Delivery channels of the pipeline (replaces the current list). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>`,
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				placeholder: 'e.g. Supplier invoices to Slack',
				description: 'New name of the pipeline',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description: 'Position among the pipelines of the address (0 is evaluated first)',
			},
			statusOption,
			storeCopyOption,
			{
				...transformerOption,
				description: `Transformer that extracts structured fields from matching emails. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>`,
			},
		],
	},
];
