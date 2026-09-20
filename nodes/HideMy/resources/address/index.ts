import type { INodeProperties } from 'n8n-workflow';
import { addressLocator, returnAllAndLimit, rootPropertyItems } from '../../shared/descriptions';

const showOnlyForAddresses = { resource: ['address'] };

export const addressDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForAddresses },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an address',
				description: 'Create a new email address on your HideMy.world subdomain',
				routing: {
					request: { method: 'POST', url: '/aliases' },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an address',
				description: 'Delete an address permanently. The address can never be provisioned again, by anyone.',
				routing: {
					request: { method: 'DELETE', url: '=/aliases/{{$parameter.address}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an address',
				description: 'Get one address',
				routing: {
					request: { method: 'GET', url: '=/aliases/{{$parameter.address}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many addresses',
				description: 'List your addresses with their pipeline counts',
				routing: {
					request: { method: 'GET', url: '/aliases' },
					output: rootPropertyItems,
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an address',
				description: 'Change the label, status or attachment setting of an address',
				routing: {
					request: { method: 'PATCH', url: '=/aliases/{{$parameter.address}}' },
				},
			},
		],
		default: 'getAll',
	},

	// ----- create -----
	{
		displayName: 'Local Part',
		name: 'localPart',
		type: 'string',
		default: '',
		placeholder: 'e.g. invoices',
		description: 'The part before the @ (lowercase letters, digits, dots, dashes, underscores). Leave empty to generate a random address.',
		displayOptions: { show: { ...showOnlyForAddresses, operation: ['create'] } },
		routing: {
			send: {
				type: 'body',
				property: 'local_part',
				value: '={{ $value.trim() === "" ? null : $value.trim() }}',
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...showOnlyForAddresses, operation: ['create'] } },
		options: [
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				default: '',
				placeholder: 'e.g. Supplier invoices',
				description: 'Free-text label shown in the dashboard',
				routing: { send: { type: 'body', property: 'label' } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active', description: 'Receive and process email' },
					{
						name: 'Paused',
						value: 'paused',
						description: 'Accept email but do not process it',
					},
				],
				default: 'active',
				routing: { send: { type: 'body', property: 'status' } },
			},
		],
	},

	// ----- delete / get / update -----
	{
		...addressLocator,
		displayOptions: { show: { ...showOnlyForAddresses, operation: ['delete', 'get', 'update'] } },
	},

	// ----- get many -----
	...returnAllAndLimit({ ...showOnlyForAddresses, operation: ['getAll'] }, { paginated: false }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { ...showOnlyForAddresses, operation: ['getAll'] } },
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Paused', value: 'paused' },
					{ name: 'Setup', value: 'setup' },
				],
				default: 'active',
				description: 'Only return addresses with this status',
				routing: { send: { type: 'query', property: 'status' } },
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
		displayOptions: { show: { ...showOnlyForAddresses, operation: ['update'] } },
		options: [
			{
				displayName: 'Download Attachments',
				name: 'downloadAttachments',
				type: 'boolean',
				default: true,
				description: 'Whether attachments of incoming email are stored for this address',
				routing: { send: { type: 'body', property: 'download_attachments' } },
			},
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				default: '',
				placeholder: 'e.g. Supplier invoices',
				description: 'Free-text label shown in the dashboard',
				routing: { send: { type: 'body', property: 'label' } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active', description: 'Receive and process email' },
					{
						name: 'Paused',
						value: 'paused',
						description: 'Accept email but do not process it',
					},
				],
				default: 'active',
				routing: { send: { type: 'body', property: 'status' } },
			},
		],
	},
];
