# Supported versions

As of 2026-10-14, 0.2.0 is the current release, for the `distari://` note scheme the service switched to on 2026-10-13 (#812). 0.1.x clients may fail to import note images and links against that service.

| Version | Minimum Obsidian | Availability | Required upgrade |
| --- | --- | --- | --- |
| 0.2.0 | 1.13.0 | GitHub release 2026-10-14 | Parses only `distari://` paper/note links and images; no retired-scheme fallback |
| 0.1.1 | 1.13.0 | GitHub release and Community directory 2026-10-10 | Upgrade to 0.2.0 for the new server scheme; old image parsing may break |
| 0.1.0 | 1.13.0 | GitHub release 2026-10-10; desktop acceptance on 1.13.7 and 1.14.4 | Upgrade to 0.2.0 for the new server scheme; old image parsing may break |

The 2026-10-13 pre-release policy supersedes the earlier 90-day promise for these disposable test versions. The previously announced 0.1.0 retirement floor of 2027-01-08 is withdrawn for this scheme change. No rewrite, dual parsing or compatibility bridge is provided. Preserve historical entries in `versions.json`.

The manifest permits mobile installation because the bundle uses browser-safe APIs. Mobile installation, Keychain and import/update acceptance remain unverified; they must pass on the released candidate before advertising mobile support. The minimum version is an API requirement, not evidence of a test on every supported Obsidian version.

After public launch, each official version stays supported while current and for at least 90 calendar days after its successor is available. Record actual availability and retirement dates before announcing a successor; preparation does not start a retirement clock. Backend changes then preserve supported versions unless an urgent security fix documents a required upgrade. Privacy and authorization checks always apply.
