import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	JsonObject,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { getAddresses, getPipelines } from './listSearch';
import { addressLocator, pipelineLocator } from './shared/descriptions';
import { hideMyApiRequest } from './shared/transport';

type TriggerStaticData = {
	channelId?: string;
	channelSecret?: string;
	pipelineId?: string;
	pipelineCreated?: boolean;
	webhookUrl?: string;
};

type TriggerOptions = {
	channelName?: string;
	payloadMode?: string;
	pipelineName?: string;
	storeCopy?: boolean;
};

const SIGNATURE_HEADER = 'x-hidemy-signature';

function isNotFound(error: unknown): boolean {
	const status = (error as { httpCode?: string | number; statusCode?: number })?.httpCode;
	return String(status) === '404';
}

/**
 * Verifies `X-HideMy-Signature: t=<unix>,v1=<hex hmac_sha256(secret, "<t>.<body>")>`.
 * No timestamp window on purpose: HideMy.world retries failed deliveries for
 * hours with the exact same payload and signature.
 */
export function verifySignature(rawBody: Buffer | string, header: unknown, secret: string): boolean {
	if (typeof header !== 'string' || !secret) return false;
	const parts: Record<string, string> = {};
	for (const pair of header.split(',')) {
		const [key, value] = pair.split('=', 2);
		if (key && value) parts[key.trim()] = value.trim();
	}
	if (!parts.t || !parts.v1) return false;
	const expected = createHmac('sha256', secret)
		.update(`${parts.t}.`)
		.update(rawBody)
		.digest('hex');
	const given = parts.v1.toLowerCase();
	if (given.length !== expected.length) return false;
	return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

export class HideMyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HideMy.world Trigger',
		name: 'hideMyTrigger',
		icon: { light: 'file:../../icons/hidemy.svg', dark: 'file:../../icons/hidemy.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '=email received',
		description: 'Starts the workflow when an email arrives at a HideMy.world address',
		defaults: {
			name: 'HideMy.world Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'hideMyApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				...addressLocator,
				description: 'The address whose incoming email starts the workflow',
			},
			{
				...pipelineLocator,
				required: false,
				description:
					'Existing pipeline to attach this workflow to, so its rules and transformer apply. Leave empty to create a dedicated pipeline that receives every email sent to the address',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Channel Name',
						name: 'channelName',
						type: 'string',
						default: 'n8n workflow',
						description: 'Name of the webhook delivery channel created in HideMy.world',
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
						description: 'What the trigger receives for each email',
					},
					{
						displayName: 'Pipeline Name',
						name: 'pipelineName',
						type: 'string',
						default: 'n8n workflow',
						description: 'Name of the pipeline created when no existing pipeline is selected',
					},
					{
						displayName: 'Store Copy',
						name: 'storeCopy',
						type: 'boolean',
						default: true,
						description:
							'Whether emails handled by the pipeline created by this trigger are kept in your HideMy.world inbox',
					},
				],
			},
		],
	};

	methods = {
		listSearch: {
			getAddresses,
			getPipelines,
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				if (!staticData.channelId) return false;
				try {
					const channel = await hideMyApiRequest.call(
						this,
						'GET',
						`/channels/${staticData.channelId}`,
					);
					const config = (channel.config ?? {}) as IDataObject;
					if (config.url === webhookUrl) {
						return true;
					}
				} catch (error) {
					if (!isNotFound(error)) throw new NodeApiError(this.getNode(), error as JsonObject);
				}
				// Channel gone or pointing elsewhere: register again.
				delete staticData.channelId;
				delete staticData.channelSecret;
				delete staticData.pipelineId;
				delete staticData.pipelineCreated;
				delete staticData.webhookUrl;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const addressId = this.getNodeParameter('address', undefined, {
					extractValue: true,
				}) as string;
				const pipelineId = (this.getNodeParameter('pipeline', '', {
					extractValue: true,
				}) ?? '') as string;
				const options = this.getNodeParameter('options', {}) as TriggerOptions;

				if (!addressId) {
					throw new NodeOperationError(
						this.getNode(),
						"Select the 'Address' whose email should start the workflow",
					);
				}

				// An address still in the dashboard's setup wizard never processes
				// email; attaching a workflow is how its setup completes.
				const address = await hideMyApiRequest.call(this, 'GET', `/aliases/${addressId}`);
				if (address.status === 'setup') {
					await hideMyApiRequest.call(this, 'PATCH', `/aliases/${addressId}`, {
						status: 'active',
					});
				}

				const channel = await hideMyApiRequest.call(this, 'POST', '/channels', {
					type: 'webhook',
					name: options.channelName?.trim() || 'n8n workflow',
					config: {
						url: webhookUrl,
						payload_mode: options.payloadMode ?? 'combined',
					},
				});
				const channelId = String(channel.id);
				const channelSecret = String(((channel.config ?? {}) as IDataObject).secret ?? '');

				try {
					if (pipelineId) {
						await hideMyApiRequest.call(
							this,
							'POST',
							`/pipelines/${pipelineId}/channels/${channelId}`,
						);
						staticData.pipelineId = pipelineId;
						staticData.pipelineCreated = false;
					} else {
						const pipeline = await hideMyApiRequest.call(
							this,
							'POST',
							`/aliases/${addressId}/pipelines`,
							{
								name: options.pipelineName?.trim() || 'n8n workflow',
								ruleset: { combinator: 'and', groups: [] },
								channel_ids: [channelId],
								store_copy: options.storeCopy ?? true,
							},
						);
						staticData.pipelineId = String(pipeline.id);
						staticData.pipelineCreated = true;
					}
				} catch (error) {
					// Do not leave an orphan channel behind; the original error is the useful one.
					try {
						await hideMyApiRequest.call(this, 'DELETE', `/channels/${channelId}`);
					} catch (cleanupError) {
						this.logger.warn(
							`HideMy.world Trigger: could not remove channel ${channelId} after a failed activation: ${(cleanupError as Error).message}`,
						);
					}
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}

				staticData.channelId = channelId;
				staticData.channelSecret = channelSecret;
				staticData.webhookUrl = webhookUrl;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
				if (staticData.pipelineCreated && staticData.pipelineId) {
					try {
						await hideMyApiRequest.call(this, 'DELETE', `/pipelines/${staticData.pipelineId}`);
					} catch (error) {
						if (!isNotFound(error)) {
							this.logger.warn(
								`HideMy.world Trigger: could not delete pipeline ${staticData.pipelineId}: ${(error as Error).message}`,
							);
							return false;
						}
					}
				}
				if (staticData.channelId) {
					try {
						// Deleting the channel also detaches it from every pipeline.
						await hideMyApiRequest.call(this, 'DELETE', `/channels/${staticData.channelId}`);
					} catch (error) {
						if (!isNotFound(error)) {
							this.logger.warn(
								`HideMy.world Trigger: could not delete channel ${staticData.channelId}: ${(error as Error).message}`,
							);
							return false;
						}
					}
				}
				delete staticData.channelId;
				delete staticData.channelSecret;
				delete staticData.pipelineId;
				delete staticData.pipelineCreated;
				delete staticData.webhookUrl;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;

		const rawBody =
			(req as unknown as { rawBody?: Buffer }).rawBody ??
			(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
		const signature = req.headers[SIGNATURE_HEADER];
		if (!staticData.channelSecret || !verifySignature(rawBody, signature, staticData.channelSecret)) {
			res.status(401).json({ error: 'invalid X-HideMy-Signature' });
			return { noWebhookResponse: true };
		}

		const payload = this.getBodyData() as IDataObject;
		return {
			workflowData: [this.helpers.returnJsonArray(payload)],
		};
	}
}
