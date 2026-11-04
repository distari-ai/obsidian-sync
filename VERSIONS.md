# Supported versions

As of 2026-11-04, 0.2.2 is prepared to fix generated paper backlinks; publication and full mobile acceptance are pending. Version 0.2.1 is published with the Android compression fix. Version 0.2.0 was released for the `distari://` note scheme the service switched to on 2026-10-13 (#812). 0.1.x clients may fail to import note images and links against that service.

| Version | Minimum Obsidian | Availability | Required upgrade |
| --- | --- | --- | --- |
| 0.2.2 | 1.13.0 | Prepared 2026-11-04; publication and Android acceptance pending | Adds an alias to generated bracket-ended paper links so Obsidian resolves their full target |
| 0.2.1 | 1.13.0 | GitHub and Android Community Browse install/import 2026-11-04; generated paper backlink fix pending | Lets Obsidian negotiate compression; supported through at least 2027-02-02 |
| 0.2.0 | 1.13.0 | GitHub release 2026-10-14; Community directory update from 0.1.1 verified 2026-10-30 on 1.14.5 | Parses only `distari://` paper/note links and images; no retired-scheme fallback |
| 0.1.1 | 1.13.0 | GitHub release and Community directory 2026-10-10 | Upgrade to 0.2.0 for the new server scheme; old image parsing may break |
| 0.1.0 | 1.13.0 | GitHub release 2026-10-10; desktop acceptance on 1.13.7 and 1.14.4 | Upgrade to 0.2.0 for the new server scheme; old image parsing may break |

The 2026-10-13 pre-release policy supersedes the earlier 90-day promise for these disposable test versions. The previously announced 0.1.0 retirement floor of 2027-01-08 is withdrawn for this scheme change. No rewrite, dual parsing or compatibility bridge is provided. Preserve historical entries in `versions.json`.

The manifest permits mobile installation because the bundle uses browser-safe APIs. On 2026-11-04, released 0.2.0 passed Browse installation and Keychain/settings persistence on Obsidian 1.15.0 in an Android 16/API 36 ARM64 emulator. Project refresh against dev failed before import: the explicit gzip request returned compressed bytes that the Android transport passed to JSON parsing ([#721](https://github.com/distari-ai/project/issues/721)). Mobile import remains unverified; iOS and mobile plugin upgrades are untested. A compatible published candidate must pass import before advertising mobile support. The minimum version is an API requirement, not evidence of a test on every supported Obsidian version.

After public launch, each official version stays supported while current and for at least 90 calendar days after its successor is available. Record actual availability and retirement dates before announcing a successor; preparation does not start a retirement clock. Backend changes then preserve supported versions unless an urgent security fix documents a required upgrade. Privacy and authorization checks always apply.

Versions 0.2.1 and 0.2.2 change no API contract or stored settings/checkpoint format. Version 0.2.0 remains supported through at least 2027-02-02, 90 days after 0.2.1 became available. Record 0.2.1's retirement floor when 0.2.2 becomes available.
