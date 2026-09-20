# Changelog

## 0.1.0

Initial release.

- `HideMy.world` node: Address (create, delete, get, get many, update), Pipeline
  (create, delete, get, get many, update, attach channel, detach channel),
  Channel (create, delete, get, get many, test, update), Email (get, get many,
  delete) and Account (get usage).
- `HideMy.world Trigger` node: starts a workflow when an email arrives at an
  address, registering a signed webhook channel (and a match-all pipeline when
  none is selected) and verifying every delivery's `X-HideMy-Signature`.
- `HideMy.world API` credential (API key) with a connection test.
