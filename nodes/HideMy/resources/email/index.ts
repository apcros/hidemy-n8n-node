import type {
	IDataObject,
	IExecuteSingleFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { returnAllAndLimit, rootPropertyItems } from '../../shared/descriptions';

const showOnlyForEmails = { resource: ['email'] };

const EMAIL_STATUS_OPTIONS = [
	{ name: 'Blocked (Address Disabled)', value: 'blocked_disabled' },
	{ name: 'Dropped', value: 'dropped' },
	{ name: 'Duplicate', value: 'duplicate' },
	{ name: 'Failed', value: 'failed' },
	{ name: 'Held (Over Quota)', value: 'held' },
	{ name: 'Loop Detected', value: 'loop_detected' },
	{ name: 'No Match', value: 'no_match' },
	{ name: 'Processed', value: 'processed' },
	{ name: 'Received', value: 'received' },
];

async function simplifyEmail(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const simplify = this.getNodeParameter('simplify', true) as boolean;
	if (!simplify) return items;
	return items.map((item) => {
		const doc = item.json as IDataObject;
		const email = (doc.email ?? {}) as IDataObject;
		const results = Array.isArray(doc.pipeline_results)
			? (doc.pipeline_results as IDataObject[])
			: [];
		const transformed = results.find((r) => r.matched && r.transformed)?.transformed ?? null;
		return {
			json: {
				id: doc.id,
				alias: doc.alias,
				status: doc.status,
				matched: doc.matched,
				received_at: doc.received_at,
				subject: email.subject,
				from: email.from,
				to: email.to,
				reply_to: email.reply_to,
				date: email.date,
				text: email.text,
				attachments: email.attachments,
				auth: doc.auth,
				transformed,
			},
			pairedItem: item.pairedItem,
		};
	});
}

export const emailDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForEmails },
		options: [
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an email',
				description: 'Delete a received email and its stored content',
				routing: {
					request: { method: 'DELETE', url: '=/emails/{{$parameter.emailId}}' },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an email',
				description: 'Get a received email with its body, rule results and transformed fields',
				routing: {
					request: { method: 'GET', url: '=/emails/{{$parameter.emailId}}' },
					output: { postReceive: [simplifyEmail] },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many emails',
				description: 'Search received emails by keyword, status, address or date',
				routing: {
					request: { method: 'GET', url: '/emails' },
					output: rootPropertyItems,
				},
			},
		],
		default: 'getAll',
	},

	// ----- delete / get -----
	{
		displayName: 'Email ID',
		name: 'emailId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 68b5f2a1c9e4d7a3b1c2d3e4',
		description: 'ID of the received email, as returned by Get Many or by the trigger (email_id)',
		displayOptions: { show: { ...showOnlyForEmails, operation: ['delete', 'get'] } },
	},
	{
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		displayOptions: { show: { ...showOnlyForEmails, operation: ['get'] } },
	},

	// ----- get many -----
	...returnAllAndLimit({ ...showOnlyForEmails, operation: ['getAll'] }, { paginated: true }),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { ...showOnlyForEmails, operation: ['getAll'] } },
		options: [
			{
				displayName: 'Address Name or ID',
				name: 'aliasId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAddressOptions' },
				default: '',
				description: 'Only emails received by this address. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: { send: { type: 'query', property: 'alias_id' } },
			},
			{
				displayName: 'Keyword',
				name: 'q',
				type: 'string',
				default: '',
				placeholder: 'e.g. invoice',
				description: 'Case-insensitive match against the subject and the sender',
				routing: { send: { type: 'query', property: 'q' } },
			},
			{
				displayName: 'Since',
				name: 'since',
				type: 'dateTime',
				default: '',
				description: 'Only emails received at or after this time',
				routing: { send: { type: 'query', property: 'since' } },
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: EMAIL_STATUS_OPTIONS,
				default: [],
				description: 'Only emails in one of these processing states',
				routing: {
					send: {
						type: 'query',
						property: 'status',
						value: '={{ $value.join(",") }}',
					},
				},
			},
		],
	},
];
