import type { IDataObject, INodeProperties } from 'n8n-workflow';

const objectIdValidation = [
	{
		type: 'regex' as const,
		properties: {
			regex: '^[0-9a-fA-F]{24}$',
			errorMessage: 'Not a valid HideMy.world ID (24 hexadecimal characters)',
		},
	},
];

export const addressLocator: INodeProperties = {
	displayName: 'Address',
	name: 'address',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The HideMy.world email address',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select an address...',
			typeOptions: {
				searchListMethod: 'getAddresses',
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 68b5f2a1c9e4d7a3b1c2d3e4',
			validation: objectIdValidation,
		},
	],
};

export const pipelineLocator: INodeProperties = {
	displayName: 'Pipeline',
	name: 'pipeline',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The pipeline (rules plus delivery channels) on one of your addresses',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a pipeline...',
			typeOptions: {
				searchListMethod: 'getPipelines',
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 68b5f2a1c9e4d7a3b1c2d3e4',
			validation: objectIdValidation,
		},
	],
};

export const channelLocator: INodeProperties = {
	displayName: 'Channel',
	name: 'channel',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The delivery channel',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a channel...',
			typeOptions: {
				searchListMethod: 'getChannels',
				searchable: true,
			},
		},
		{
			displayName: 'ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 68b5f2a1c9e4d7a3b1c2d3e4',
			validation: objectIdValidation,
		},
	],
};

export const returnAllAndLimit = (
	show: Record<string, string[]>,
	options: { paginated: boolean },
): INodeProperties[] => {
	const returnAll: INodeProperties = {
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show },
	};
	const limit: INodeProperties = {
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue: 100 },
		description: 'Max number of results to return',
		displayOptions: { show: { ...show, returnAll: [false] } },
		routing: {
			output: { maxResults: '={{$value}}' },
		},
	};
	if (options.paginated) {
		returnAll.routing = {
			send: {
				paginate: '={{ $value }}',
				type: 'query',
				property: 'per_page',
				value: '100',
			},
			operations: {
				pagination: {
					type: 'generic',
					properties: {
						continue:
							'={{ ($response.body.page * $response.body.per_page) < $response.body.total }}',
						// n8n shallow-merges this object into the request options, so the
						// whole query string has to be repeated, not just the page number.
						// Expressions are resolved at any depth, but the type only allows an
						// object here, hence the cast.
						request: {
							qs: '={{ ({ ...$request.qs, page: ($response.body?.page ?? 0) + 1 }) }}' as unknown as IDataObject,
						},
					},
				},
			},
		};
		limit.routing = {
			send: { type: 'query', property: 'per_page' },
			output: { maxResults: '={{$value}}' },
		};
	}
	return [returnAll, limit];
};

export const rootPropertyItems = {
	postReceive: [
		{
			type: 'rootProperty' as const,
			properties: { property: 'items' },
		},
	],
};
