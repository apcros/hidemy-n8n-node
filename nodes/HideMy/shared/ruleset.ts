import type { IDataObject, IExecuteSingleFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, jsonParse } from 'n8n-workflow';

export const RULES_FIELDS = ['subject', 'sender', 'body', 'cc', 'bcc', 'reply_to'] as const;
export const RULES_OPERATORS = ['contains', 'equals', 'not_contains', 'not_equals'] as const;

type ConditionRow = {
	kind: 'field' | 'ai';
	field?: string;
	operator?: string;
	value?: string;
	caseSensitive?: boolean;
	prompt?: string;
};

/**
 * Parameters shared by "Pipeline > Create" and "Pipeline > Update" to describe
 * the ruleset. `allowKeep` adds a "Keep Existing" mode used by Update.
 */
export function rulesetProperties(
	show: Record<string, string[]>,
	options: { allowKeep: boolean },
): INodeProperties[] {
	const modeOptions = [
		{
			name: 'Builder',
			value: 'builder',
			description: 'Describe the conditions with the fields below',
		},
		{
			name: 'JSON',
			value: 'json',
			description: 'Provide the full ruleset as JSON (nested and/or groups)',
		},
	];
	if (options.allowKeep) {
		modeOptions.push({
			name: 'Keep Existing',
			value: 'keep',
			description: 'Leave the rules of the pipeline unchanged',
		});
	}
	const modeDefault = options.allowKeep ? 'keep' : 'builder';

	return [
		{
			displayName: 'Rules',
			name: 'rulesMode',
			type: 'options',
			noDataExpression: true,
			options: modeOptions,
			default: modeDefault,
			description: 'How to define which emails the pipeline handles. Without any condition, every email sent to the address matches.',
			displayOptions: { show },
		},
		{
			displayName: 'Match',
			name: 'matchMode',
			type: 'options',
			options: [
				{
					name: 'All Conditions (AND)',
					value: 'all',
					description: 'Every condition has to match',
				},
				{
					name: 'Any Condition (OR)',
					value: 'any',
					description: 'At least one condition has to match',
				},
			],
			default: 'all',
			description: 'How the conditions combine',
			displayOptions: { show: { ...show, rulesMode: ['builder'] } },
		},
		{
			displayName: 'Conditions',
			name: 'conditions',
			type: 'fixedCollection',
			typeOptions: { multipleValues: true },
			placeholder: 'Add Condition',
			default: {},
			description: 'Conditions an email has to satisfy. Leave empty to match every email sent to the address.',
			displayOptions: { show: { ...show, rulesMode: ['builder'] } },
			options: [
				{
					displayName: 'Condition',
					name: 'condition',
					values: [
						{
							displayName: 'Condition Type',
							name: 'kind',
							type: 'options',
							options: [
								{
									name: 'AI',
									value: 'ai',
									description:
										'A natural-language question answered by the AI rules engine (plans with AI rules)',
								},
								{
									name: 'Field',
									value: 'field',
									description: 'Compare a field of the email with a value',
								},
							],
							default: 'field',
						},
						{
							displayName: 'Field',
							name: 'field',
							type: 'options',
							options: [
								{ name: 'BCC', value: 'bcc' },
								{ name: 'Body', value: 'body' },
								{ name: 'CC', value: 'cc' },
								{ name: 'Reply-To', value: 'reply_to' },
								{ name: 'Sender', value: 'sender' },
								{ name: 'Subject', value: 'subject' },
							],
							default: 'subject',
							description: 'Sender matches both the email address and the display name',
							displayOptions: { show: { kind: ['field'] } },
						},
						{
							displayName: 'Match Case',
							name: 'caseSensitive',
							type: 'boolean',
							default: false,
							description: 'Whether the comparison distinguishes upper and lower case',
							displayOptions: { show: { kind: ['field'] } },
						},
						{
							displayName: 'Operator',
							name: 'operator',
							type: 'options',
							options: [
								{ name: 'Contains', value: 'contains' },
								{ name: 'Does Not Contain', value: 'not_contains' },
								{ name: 'Does Not Equal', value: 'not_equals' },
								{ name: 'Equals', value: 'equals' },
							],
							default: 'contains',
							displayOptions: { show: { kind: ['field'] } },
						},
						{
							displayName: 'Prompt',
							name: 'prompt',
							type: 'string',
							default: '',
							placeholder: 'e.g. Is this a booking confirmation from a train company?',
							description: 'Question the AI answers with yes or no for each email',
							displayOptions: { show: { kind: ['ai'] } },
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
							placeholder: 'e.g. booking confirmation',
							displayOptions: { show: { kind: ['field'] } },
						},
					],
				},
			],
		},
		{
			displayName: 'Ruleset (JSON)',
			name: 'rulesetJson',
			type: 'json',
			default:
				'{\n  "combinator": "and",\n  "groups": [\n    {\n      "combinator": "or",\n      "conditions": [\n        { "kind": "field", "field": "subject", "op": "contains", "value": "invoice" }\n      ]\n    }\n  ]\n}',
			description: 'Full ruleset: groups of conditions combined with and/or. See the HideMy.world API description (GET /v1) for the shape.',
			displayOptions: { show: { ...show, rulesMode: ['json'] } },
		},
	];
}

/** Builds the API ruleset from the node parameters, or `undefined` when the rules are kept. */
export function buildRuleset(this: IExecuteSingleFunctions): IDataObject | undefined {
	const mode = this.getNodeParameter('rulesMode', 'builder') as string;
	if (mode === 'keep') return undefined;

	if (mode === 'json') {
		const raw = this.getNodeParameter('rulesetJson', '{}');
		let parsed: IDataObject;
		if (typeof raw === 'string') {
			try {
				parsed = jsonParse<IDataObject>(raw);
			} catch {
				throw new NodeOperationError(
					this.getNode(),
					"'Ruleset (JSON)' is not valid JSON. Provide an object with a 'groups' array",
				);
			}
		} else {
			parsed = raw as IDataObject;
		}
		if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.groups)) {
			throw new NodeOperationError(
				this.getNode(),
				"'Ruleset (JSON)' must be an object with a 'groups' array (an empty array matches every email)",
			);
		}
		return { combinator: parsed.combinator ?? 'and', groups: parsed.groups };
	}

	const matchMode = this.getNodeParameter('matchMode', 'all') as string;
	const collection = this.getNodeParameter('conditions', {}) as { condition?: ConditionRow[] };
	const rows = collection.condition ?? [];
	const conditions: IDataObject[] = rows.map((row, index) => {
		if (row.kind === 'ai') {
			const prompt = (row.prompt ?? '').trim();
			if (!prompt) {
				throw new NodeOperationError(
					this.getNode(),
					`Condition ${index + 1}: an AI condition needs a 'Prompt'`,
				);
			}
			return { kind: 'ai', prompt };
		}
		const value = row.value ?? '';
		if (value === '') {
			throw new NodeOperationError(
				this.getNode(),
				`Condition ${index + 1}: a field condition needs a 'Value' to compare with`,
			);
		}
		return {
			kind: 'field',
			field: row.field ?? 'subject',
			op: row.operator ?? 'contains',
			value,
			case_sensitive: row.caseSensitive === true,
		};
	});

	if (conditions.length === 0) {
		return { combinator: 'and', groups: [] };
	}
	return {
		combinator: 'and',
		groups: [{ combinator: matchMode === 'any' ? 'or' : 'and', conditions }],
	};
}
