import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';
import { hideMyApiListAll } from '../shared/transport';

const MAX_ADDRESSES_FOR_PIPELINE_SEARCH = 30;

function matches(filter: string | undefined, ...haystack: Array<unknown>): boolean {
	if (!filter) return true;
	const needle = filter.toLowerCase();
	return haystack.some((value) => typeof value === 'string' && value.toLowerCase().includes(needle));
}

function addressLabel(alias: IDataObject): string {
	const address = String(alias.address ?? '');
	const label = typeof alias.label === 'string' && alias.label.trim() !== '' ? alias.label : null;
	const status = alias.status && alias.status !== 'active' ? ` [${String(alias.status)}]` : '';
	return label ? `${address} (${label})${status}` : `${address}${status}`;
}

export async function getAddresses(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const aliases = await hideMyApiListAll.call(this, '/aliases');
	const results: INodeListSearchItems[] = aliases
		.filter((alias) => matches(filter, alias.address, alias.label))
		.map((alias) => ({ name: addressLabel(alias), value: String(alias.id) }));
	return { results };
}

/** Address currently selected on the node, if any (resource locator or plain option). */
function currentAddressId(this: ILoadOptionsFunctions): string | undefined {
	try {
		const value = this.getCurrentNodeParameter('address', { extractValue: true });
		return typeof value === 'string' && value.trim() !== '' ? value : undefined;
	} catch {
		return undefined;
	}
}

export async function getPipelines(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const addressId = currentAddressId.call(this);
	const results: INodeListSearchItems[] = [];

	if (addressId) {
		const pipelines = await hideMyApiListAll.call(this, `/aliases/${addressId}/pipelines`);
		for (const pipeline of pipelines) {
			if (matches(filter, pipeline.name)) {
				results.push({ name: String(pipeline.name), value: String(pipeline.id) });
			}
		}
		return { results };
	}

	// No address selected on the node: search across every address.
	const aliases = (await hideMyApiListAll.call(this, '/aliases')).slice(
		0,
		MAX_ADDRESSES_FOR_PIPELINE_SEARCH,
	);
	for (const alias of aliases) {
		if (!alias.pipelines) continue;
		const pipelines = await hideMyApiListAll.call(this, `/aliases/${String(alias.id)}/pipelines`);
		for (const pipeline of pipelines) {
			if (matches(filter, pipeline.name, alias.address)) {
				results.push({
					name: `${String(pipeline.name)} · ${String(alias.address)}`,
					value: String(pipeline.id),
				});
			}
		}
	}
	return { results };
}

export async function getChannels(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const channels = await hideMyApiListAll.call(this, '/channels');
	const results: INodeListSearchItems[] = channels
		.filter((channel) => matches(filter, channel.name, channel.type))
		.map((channel) => ({
			name: `${String(channel.name)} (${String(channel.type)})`,
			value: String(channel.id),
		}));
	return { results };
}

export async function getAddressOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const aliases = await hideMyApiListAll.call(this, '/aliases');
	return aliases.map((alias) => ({ name: addressLabel(alias), value: String(alias.id) }));
}

export async function getChannelOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const channels = await hideMyApiListAll.call(this, '/channels');
	return channels.map((channel) => ({
		name: `${String(channel.name)} (${String(channel.type)})`,
		value: String(channel.id),
	}));
}

export async function getTransformerOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const transformers = await hideMyApiListAll.call(this, '/transformers');
	return transformers.map((transformer) => ({
		name: String(transformer.name),
		value: String(transformer.id),
	}));
}
