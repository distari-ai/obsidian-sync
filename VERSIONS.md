# Supported versions

As of 2026-11-04, 0.2.2 is the current release. It includes the Android compression fix from 0.2.1 and adds aliases to generated paper links so Obsidian preserves bracket-ended ID targets. Versions 0.2.x use the `distari://` scheme introduced on 2026-10-13 (#812); 0.1.x may fail to import note images and links against the current service.

| Version | Minimum Obsidian | Availability | Required upgrade |
| --- | --- | --- | --- |
| 0.2.2 | 1.13.0 | GitHub and Android Community Browse installation/import verified 2026-11-04 on Obsidian 1.15.0 | Current release; fixes Android compression and generated paper backlinks |
| 0.2.1 | 1.13.0 | GitHub and Android Browse installation/import 2026-11-04; native update to 0.2.2 verified that day | Upgrade to 0.2.2 for correct generated paper backlinks; supported through at least 2027-02-02 |
| 0.2.0 | 1.13.0 | GitHub release 2026-10-14; Community update from 0.1.1 verified 2026-10-30 on 1.14.5 | Android users should upgrade to 0.2.2; supported through at least 2027-02-02 |
| 0.1.1 | 1.13.0 | GitHub release and Community directory 2026-10-10 | Upgrade to 0.2.2 for the current scheme and Android fixes; old image parsing may break |
| 0.1.0 | 1.13.0 | GitHub release 2026-10-10; desktop acceptance on 1.13.7 and 1.14.4 | Upgrade to 0.2.2 for the current scheme and Android fixes; old image parsing may break |

The 2026-10-13 pre-release policy superseded the earlier 90-day promise for the disposable 0.1.x builds. The previously announced 0.1.0 retirement floor of 2027-01-08 was withdrawn for the scheme change. No retired-scheme fallback is provided. Preserve the historical entries in `versions.json`.

[#721](https://github.com/distari-ai/project/issues/721) records Android acceptance of released 0.2.2 in a fresh Android 16/API 36 ARM64 emulator on Obsidian 1.15.0 against dev: Community Browse install, Keychain link, paper/two-note import, all four resolved internal links, unchanged repeat and force-stop/relaunch persistence. The native 0.2.1-to-0.2.2 update preserved settings, Keychain availability, checkpoint paths and the three files; only the faulty generated backlink changed. Plugin settings store only the secret name. The earlier 0.2.0 gzip failure and 0.2.1 backlink failure remain historical evidence. iOS is untested; the minimum version is an API requirement, not evidence of a run on every supported Obsidian version.

After public launch, each official version stays supported while current and for at least 90 calendar days after its successor becomes available. Releases 0.2.1 and 0.2.2 became available on 2026-11-04, establishing a minimum retirement floor of 2027-02-02 for both 0.2.0 and 0.2.1. No retirement is announced for current 0.2.2. These patches change no API contract, plugin ID or settings/checkpoint format, and keep file paths and the local-edit conflict policy. Backend changes must preserve supported versions unless an urgent security fix documents a required upgrade. Privacy and authorization checks always apply.
