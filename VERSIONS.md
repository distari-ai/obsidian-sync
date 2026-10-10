# Supported versions

As of 2026-10-10, version 0.1.1 is the current GitHub release for manual installation, and 0.1.0 stays supported until at least its earliest retirement date. Neither is listed in the community directory yet. Preparing assets does not start a retirement clock.

| Version | Minimum Obsidian | Availability | Successor available | Earliest retirement | Required upgrade |
| --- | --- | --- | --- | --- | --- |
| 0.1.1 | 1.13.0 | GitHub release 2026-10-10; settings use the declarative settings API and appear in settings search | None | None announced; supported | None |
| 0.1.0 | 1.13.0 | GitHub release 2026-10-10; desktop acceptance on 1.13.7 and 1.14.4 | 0.1.1, 2026-10-10 | 2027-01-08 or later; supported until then | None: 0.1.1 changes only the settings tab, with the same data and API use |

The manifest permits mobile installation because the bundle uses browser-safe APIs. Mobile installation, Keychain and import/update acceptance remain unverified; they must pass on the released candidate before advertising mobile support. The minimum version is an API requirement, not evidence of a test on every supported Obsidian version.

Each official version stays supported while current and for at least 90 calendar days after its successor is available to users. Record the actual availability date, predecessor's earliest retirement date and required upgrade here and in release notes before announcing a successor. Keep every overlapping support window and all historical entries in `versions.json`. A successor's draft or preparation date does not count as availability. The manual 0.1.0 build receives the same predecessor window once a successor is published.

Backend note-route changes must keep working with every supported plugin version until its announced retirement date. An urgent security fix may shorten a window only with a published reason and required upgrade. Privacy and authorization checks always apply.
