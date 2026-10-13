# Community distribution runbook

## Ownership and source

Distribution target: a dedicated public `distari-ai/obsidian-sync` GitHub repository, with the plugin files at its root. The private `distari-ai/project` monorepo remains the development source of truth. Export only this plugin's reviewed source, build inputs, licenses and documentation; never publish the monorepo or its history. The public repository accepts bug reports; port fixes into the monorepo before the next export.

Oshan owns release approval, publication and directory submission; Sumedhe Dissanayake is the backup maintainer and reviewer. Directory ownership should belong to the Distari team organization with both maintainers able to manage it. This is a product team, with no implication of incorporation or Latenari ownership. Confirm both maintainers' access before submission. Use the project's `accounts@distari.com` Obsidian login for service administration, not a new personal account. GitHub's linked identity must actually own or administer the distribution repository; do not rely on `distari-team`, whose org access is unverified.

The MIT license covers this plugin subtree and the exported plugin only. It does not license the rest of Distari. Oshan approved the license and the public source export on 2026-10-10, with Sumedhe informed; a change of license needs both owners. `THIRD_PARTY_LICENSES.md` carries the bundled SHA-256 dependency's license. Do not add a self-updater; Obsidian manages updates.

As of 2026-10-14, `distari-ai/obsidian-sync` has published 0.1.0, 0.1.1 and 0.2.0. A push to the monorepo does not publish this plugin. There is deliberately no automatic publishing workflow.

The monorepo's `make release` and `make deploy` commands manage Distari service releases with `vMAJOR.MINOR.PATCH` tags. They do not publish Obsidian assets or change the plugin version. Publish this plugin separately in its distribution repository, using the exact manifest version without the `v` prefix.

## Prepare a candidate

Use Node 22.18 or newer and the locked dependencies. From `plugins/obsidian/` in the monorepo, or the public plugin root once it exists:

```sh
npm ci
npm run release:prepare -- --output "$TMPDIR/obsidian-release"
```

Choose a new absolute output path whose parent exists, outside the plugin source. The command refuses an existing destination. It runs sync tests, TypeScript, the bundle and distribution checks, then creates:

- `repository/`: the reviewed plugin files, including root `manifest.json`, `versions.json`, README, license, source and locked build inputs.
- `assets/`: `main.js` and `manifest.json`, for separate release attachments. There is no stylesheet.
- `release.json`: the target repository, exact version tag and asset SHA-256 values for review. This is local preparation metadata, not an Obsidian install asset.

The exporter uses an explicit file allowlist. Update it when adding a required plugin source file. Never export a vault's `data.json`, Keychain, `.env`, dependencies or unrelated repo files. Rebuild the exported source with `npm ci && npm run check` in a clean checkout and compare `main.js` with the prepared asset. Do not publish from an unreviewed or dirty source revision. Record the reviewed monorepo commit in the public commit and release notes after the change has landed.

As of 2026-10-04, `npm audit` reports two pre-existing moderate findings through the development-only Obsidian SDK's `moment` dependency ([GHSA-4p3w-j4w9-5jqw](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw)). Neither package is bundled in `main.js`. Review the dependency scan before publication; do not use the audit command's proposed SDK downgrade, which would remove required APIs.

For a new version, update `manifest.json` and `package.json`, refresh the package lock without changing the toolchain, add the version/minimum-app pair to `versions.json`, and update `VERSIONS.md`. Keep `distari-sync` unchanged so vault settings and checkpoints survive upgrades. The release tag must be exactly the manifest version, for example `0.1.0`, without a `v` prefix.

## Initial submission packet

The current process uses the [Obsidian Community directory submission form](https://docs.obsidian.md/plugins/releasing/submit-plugin), rather than a pull request to `obsidian-releases`. Recheck the official requirements before submitting. Prepare these form values:

| Field | Value |
| --- | --- |
| GitHub repository URL | `https://github.com/distari-ai/obsidian-sync` |
| Owner | Distari team organization, after both maintainers' access is confirmed |
| Identifier / name | `distari-sync` / Distari sync, from the root manifest; verify both are unique before submission |
| Description | Import your Distari papers, summaries, and notes into this vault. |
| Payment category | Optional payment: the plugin is free, and Distari has paid plans/credits; syncing existing data does not spend credits |
| Website / privacy | `https://distari.com` / `https://distari.com/privacy/` |

The account, network, payment and file-access disclosures are in the README. Follow the [developer policies](https://docs.obsidian.md/community-directory/developer-policies) and [plugin submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins). The directory can inspect the exported source and build command. Run the official [Obsidian ESLint checks](https://github.com/obsidianmd/eslint-plugin) against the candidate and address automated review feedback; this repository's packaging checks do not substitute for that review.

After license/export approval, create the public repository with a default branch containing the exported root files. Create a non-draft, non-prerelease GitHub release with the exact version tag and attach the two files individually. Generated GitHub source archives or a ZIP alone are insufficient. Verify anonymous access to the root manifest and both assets, and verify their checksums. Keep the previous release intact on every upgrade.

Sign into the Community directory, link a maintainer's GitHub identity, select the team owner and prepare **New plugin**. The directory owns the entry through its organization Distari (`@distari`). It proves repository ownership through the linked account's public membership of the GitHub org, so that membership must be public (`gh api -X PUT orgs/distari-ai/public_members/<login>`), or submission fails with "You do not own this repository". Repeated attempts are rate-limited ("Please wait before trying again"). Obtain approval immediately before granting OAuth, accepting policies or submitting. Record the directory entry URL and review results. Resolve errors with a new version and release; do not replace published bytes under an existing tag.

## Installation and update acceptance gates

Record acceptance for the exact published version on the source issue, with sanitized artifacts kept outside tracked documentation under the monorepo's `docs/engineering/run-evidence.md` rules, then update OBS-SYNC and roadmap. The first-party note-route decision is complete; retain its read scope, member isolation, live offset pagination and supported-version windows. Check supported plugin versions against the proposed API before a backend breaking change.

1. In a fresh disposable desktop vault, install **downloaded public release assets**, using the README's manual steps, and compare their bytes with the release checksums. Enable the plugin and connect a synthetic read-only token to an isolated API. Record Obsidian, plugin and source versions. Do not reuse a preinstalled development bundle.
2. Run the native import, unchanged repeat, changed-summary, locally edited file/conflict-repeat and revoked-token journey. Verify another member's notes are absent. This must preserve local edits, make one conflict per source version and leave files/checkpoints unchanged after refusal.
3. With a genuine published successor, upgrade the same vault by replacing only release assets. Verify the Keychain name, projects, folder, interval, checkpoints, stable paths and local edits survive; an unchanged import must remain unchanged. Keep backups for rollback. A local simulated upgrade is preparation evidence only.
4. After the directory approves and publishes the entry, use **Settings > Community plugins > Browse** in another fresh vault to find and install Distari sync. Repeat the workflow and, when a successor is available, use Obsidian's community-plugin update action in the same vault. Record the actual installed versions and settings/file comparisons. Obsidian appends `\n\n/* nosourcemap */` (18 bytes) to a `main.js` it installs from the directory, so compare everything before that suffix with the release checksum. The in-app catalog comes from `obsidianmd/obsidian-releases/community-plugins.json`, which picked up the published entry about an hour after **Publish**. Approval, a GitHub download or a local mock alone does not prove the directory path. Update the README's availability and install/update instructions only to the level these checks establish.
5. Before claiming mobile support, repeat released-candidate installation, Keychain, sync and update preservation on mobile. Until then describe mobile as unverified.

Use local synthetic fixtures for these checks, or only the disposable production smoke account and cleanup rules in the monorepo's `scripts/production-smoke/README.md` for a separately authorized deployed API check. Never use another account's papers or notes. Revoke the fixture token, remove its Keychain entry and dispose of the test vault after recording redacted evidence.

## Release notes template

```md
Distari sync X.Y.Z

Source: reviewed distari-ai/project commit <hash>
Available: YYYY-MM-DD; minimum Obsidian: X.Y.Z
Changes: <user-visible changes and any required upgrade>
Supported predecessors: <none before launch under the pre-release policy; after launch, versions and retirement dates at least 90 days after successor availability>
Validation: <public-asset/native evidence; directory install/update evidence or explicitly pending>
Known constraints: first-party note reads, live offset pagination, desktop/mobile acceptance state
Assets: <SHA-256 for main.js and manifest.json>
```

Keep the release notes, `VERSIONS.md`, manifest and directory listing consistent. If maintenance ends, transfer or remove the listing rather than leaving an unsupported plugin advertised.

## 0.2.0 (#812)

0.2.0 switches internal note paper/note/image parsing to `distari://` and removes the outbound scheme rewrite. It deliberately does not parse the retired scheme, so 0.1.x clients may lose note images and links against the current service; the pre-release policy permits that break. It was published on 2026-10-14, the day after the server switched schemes; acceptance is recorded on the issue.
