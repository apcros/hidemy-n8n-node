import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import {
	getAddressOptions,
	getAddresses,
	getChannelOptions,
	getChannels,
	getPipelines,
	getTransformerOptions,
} from './listSearch';
import { accountDescription } from './resources/account';
import { addressDescription } from './resources/address';
import { channelDescription } from './resources/channel';
import { emailDescription } from './resources/email';
import { pipelineDescription } from './resources/pipeline';
import { API_BASE_URL } from './shared/transport';

export class HideMy implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HideMy.world',
		name: 'hideMy',
		icon: { light: 'file:../../icons/hidemy.svg', dark: 'file:../../icons/hidemy.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Manage HideMy.world email addresses, pipelines and delivery channels, and search received emails',
		defaults: {
			name: 'HideMy.world',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'hideMyApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: API_BASE_URL,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Address', value: 'address' },
					{ name: 'Channel', value: 'channel' },
					{ name: 'Email', value: 'email' },
					{ name: 'Pipeline', value: 'pipeline' },
				],
				default: 'email',
			},
			...accountDescription,
			...addressDescription,
			...channelDescription,
			...emailDescription,
			...pipelineDescription,
		],
	};

	methods = {
		listSearch: {
			getAddresses,
			getChannels,
			getPipelines,
		},
		loadOptions: {
			getAddressOptions,
			getChannelOptions,
			getTransformerOptions,
		},
	};
}
