import type { INodeProperties } from 'n8n-workflow';

const showOnlyForAccount = { resource: ['account'] };

export const accountDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForAccount },
		options: [
			{
				name: 'Get Usage',
				value: 'getUsage',
				action: 'Get the usage of the account',
				description: 'Current billing-period usage of the account against its plan limits',
				routing: {
					request: { method: 'GET', url: '/usage' },
				},
			},
		],
		default: 'getUsage',
	},
];
