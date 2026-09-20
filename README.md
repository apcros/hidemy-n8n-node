# n8n-nodes-hidemy

This is an n8n community node. It lets you use [HideMy.world](https://hidemy.world) in your n8n workflows.

HideMy.world gives you private email addresses (`anything@you.hidemy.world`) with rules, AI classification, field extraction and delivery to webhooks, Slack, Discord, Telegram, ntfy, Notion or a forwarding address. This package lets a workflow manage those addresses, pipelines and delivery channels, search received emails, and start whenever an email arrives.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Trigger](#trigger)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-hidemy`.

## Operations

The **HideMy.world** node exposes these resources and operations:

| Resource | Operations |
|---|---|
| Address | Create, Delete, Get, Get Many, Update |
| Pipeline | Attach Channel, Create, Delete, Detach Channel, Get, Get Many, Update |
| Channel | Create, Delete, Get, Get Many, Test, Update |
| Email | Delete, Get, Get Many |
| Account | Get Usage |

Notes:

- **Address > Create** creates the address active right away. Leave *Local Part* empty to get a random address. Deleting an address is permanent: the address can never be provisioned again.
- **Pipeline > Create / Update** describe the rules either with the **Builder** (a list of field or AI conditions combined with AND or OR) or as raw **JSON** (the full nested ruleset, see `GET /v1` of the API for the shape). No condition means the pipeline matches every email sent to the address. AI conditions need a plan with AI rules.
- **Channel > Create** supports every delivery type: webhook, Slack, Discord, ntfy, Notion, Telegram and forward. A forwarding address has to be verified in the dashboard first, and Telegram has to be linked in the dashboard before a Telegram channel can be created.
- **Email > Get Many** searches by keyword (subject and sender), address, processing status and date, with *Return All* pagination. **Email > Get** returns the parsed email, the rule results and the transformed fields; turn off *Simplify* to get the raw document including the HTML body and delivery attempts.

## Trigger

The **HideMy.world Trigger** node starts the workflow when an email arrives at one of your addresses.

1. Pick the **Address**.
2. Optionally pick an existing **Pipeline**. Its rules and transformer then decide which emails reach the workflow and what the transformed fields contain.
3. Leave the pipeline empty to let the trigger create a dedicated pipeline that receives every email sent to the address.

When the workflow is activated the node creates a webhook delivery channel in your account (named after the *Channel Name* option) and attaches it to the chosen or newly created pipeline. When the workflow is deactivated the channel is removed again, together with the pipeline the trigger created. An address that is still in the dashboard's setup wizard is activated when the workflow starts, because an address in setup never processes email.

Every delivery carries an `X-HideMy-Signature` header. The trigger verifies the HMAC-SHA256 signature with the channel secret and answers `401` to anything that does not match, so only HideMy.world can start your workflow.

The item the trigger emits is the HideMy.world delivery payload:

```json
{
  "version": "2026-09-01",
  "event": "email.received",
  "delivery_id": "…",
  "message_id": "<…>",
  "email_id": "…",
  "alias": "invoices@you.hidemy.world",
  "pipeline": { "id": "…", "name": "n8n workflow" },
  "email": { "subject": "…", "from": { "name": "…", "email": "…" }, "text": "…", "html": "…", "attachments": [], "auth": { "spf": "pass", "dkim": "pass", "dmarc": "pass" } },
  "transformed": { "template": "…", "fields": { "…": "…" } }
}
```

With *Payload Mode* set to **Transformed** the `email` key is `null` and only the transformed fields are sent. Deliveries that fail are retried with backoff, so make the rest of the workflow idempotent on `message_id`.

## Credentials

1. Sign in to [HideMy.world](https://hidemy.world), open **API keys** in the dashboard and create a key. The key is shown once.
2. In n8n create a **HideMy.world API** credential and paste the key. The node always talks to `https://api.hidemy.world`.

API access is available on every plan.

## Compatibility

Node API version 1. Tested against n8n 2.17 (every operation executed through the n8n runtime, trigger lifecycle verified against the HideMy.world API). The trigger needs an n8n instance whose webhook URL is reachable from the internet, because HideMy.world posts to it.

## Usage

- The Address, Pipeline and Channel parameters are resource locators: pick from a list or paste an ID (24 hexadecimal characters).
- Every operation maps to the public API documented by `GET https://api.hidemy.world/v1`. Errors from the API are surfaced with their message, for example a plan limit (`402`) or a webhook URL rejected by the SSRF guard (`400`).
- The main node can be used as a tool by AI agents.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [HideMy.world](https://hidemy.world) and its [developer page](https://hidemy.world/use-cases/developers)
* API description: `GET https://api.hidemy.world/v1` with your key

## Version history

* **0.1.0**: initial release with the HideMy.world node (Address, Pipeline, Channel, Email, Account) and the HideMy.world Trigger node.
