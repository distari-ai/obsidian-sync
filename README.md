# Distari sync for Obsidian

This Obsidian plugin imports selected Distari projects as Markdown. Each paper gets a file with bibliographic frontmatter and its current summary. Your own Distari notes become separate files, with paper and note links rewritten as Obsidian wiki links.

## Availability and requirements

As of 2026-10-14, version 0.2.0 is the current release. Install it from Obsidian's community plugins ([directory listing](https://community.obsidian.md/plugins/distari-sync)), or manually from the GitHub releases in [`distari-ai/obsidian-sync`](https://github.com/distari-ai/obsidian-sync). Native desktop checks passed on Obsidian 1.13.7 and 1.14.4. The minimum app version is 1.13.0; mobile acceptance is still unverified.

You need a Distari account, access to the projects you select, and an active personal token with `read` scope. The plugin is free. Distari offers paid plans and credits for its service; this plugin only reads existing papers, summaries and notes, so importing them does not spend credits. See [Distari pricing](https://distari.com/pricing/).

## Manual installation

Download the individual `main.js` and `manifest.json` attachments from the exact version at `https://github.com/distari-ai/obsidian-sync/releases` and compare their SHA-256 values with the release notes. To build from source instead, run `npm ci && npm run check` in this directory and use the resulting `main.js`. Do not install GitHub's source archive as a plugin or mix assets from different versions.

Close Obsidian, create `<vault>/.obsidian/plugins/distari-sync/`, and copy only `manifest.json` and `main.js` into it. If your vault uses a custom configuration directory, substitute it for `.obsidian`. Reopen Obsidian, turn off Restricted mode if you want to use community plugins, and enable **Distari sync** under **Settings > Community plugins**. No stylesheet is required.

The simplest route is **Settings > Community plugins > Browse**: search for **Distari sync**, then choose **Install** and **Enable**. Obsidian appends a `/* nosourcemap */` comment to the `main.js` it installs, so to compare an installed file with the release checksum, hash it without its last 18 bytes.

## Updating and rollback

Back up your vault before updating. Close Obsidian and retain copies of the old plugin assets and `.obsidian/plugins/distari-sync/data.json` if it exists. Replace only `main.js` and `manifest.json` with matching assets from the new release, then reopen Obsidian. Keep the `distari-sync` directory, `data.json`, Keychain entry and imported Markdown files. `data.json` holds settings and sync checkpoints, including the Keychain secret's name; removing it loses local-edit detection history.

Verify your token selection, projects, folder and automatic-import interval, then run an unchanged import. Existing file paths and checkpoints should survive without new conflicts. If you installed from the directory, use Obsidian's community-plugin **Check for updates** and **Update** controls instead of replacing files manually, and make the same checks. There is no plugin-managed updater.

If an update fails, close Obsidian and restore the saved old assets. If the new version changed checkpoint data, restore the matching backed-up `data.json` as well. Preserve your vault's Markdown and local edits; do not uninstall to troubleshoot an update. Check [supported versions](VERSIONS.md) before reverting, especially after a security-required upgrade.

## Connect and import

1. In Distari, open **Account settings > Personal access tokens** and create a token with the `read` scope. Keep the token private.
2. In Obsidian, open **Settings > Keychain** and add that token, or use **Link…** beside **Personal access token** in **Settings > Community plugins > Distari sync**. The plugin saves the secret's name, never its value, in its own settings.
3. Select the Distari projects to import and choose a folder inside the vault. The default is `Distari`.
4. Choose **Import from Distari** from Obsidian's command menu, ribbon, or a file's context menu. You can also use **Import now** in the plugin settings. Automatic import runs every 30 minutes while Obsidian is open by default.

The plugin makes one stable subfolder per project, with `Papers` and `Notes` below it. File names include stable Distari IDs. A later title change updates the file in place. Paper frontmatter includes title, authors, year, venue, DOI, tags, a Distari link and the paper ID. The body contains available summary sections and links to your notes. Notes are Markdown files with their original body and rewritten links. Shared notes authored by someone else are excluded.

## Sync behavior

The import is one way, from Distari to Obsidian. It does not upload Obsidian edits or delete local files when a Distari item disappears. A file that still matches the last imported content is updated when Distari changes. If you edited the file locally, the plugin leaves it untouched and writes the new Distari version beside it as a dated conflict copy. Repeating a sync does not make another copy for the same remote version. Moving or deleting a managed file is treated as a local change; a later remote change goes to a conflict copy.

Stored paper/note Markdown links resolve to vault wiki links when their target is imported. Unresolved `distari://` references remain unchanged, including missing targets and reference-style links; the scheme marks an unresolved Distari reference and does not promise an installed deep-link handler. Inline images still use relative paths to downloaded assets. Only the current `distari://` scheme is parsed; retired schemes are not rewritten or resolved. The source note remains unchanged in Distari. Existing locally edited vault files are preserved under the conflict-copy policy above.

The API is paged for papers and notes. The plugin fetches current summaries on each run, then uses source timestamps and content hashes to decide which vault files need an update. A revoked or expired token, a lost project permission, or a failed request stops the current import and displays an error. Completed files keep their checkpoints and are safe to retry.

## Support and API stability

Distari maintains this official plugin as a first-party Distari client, including any future community-directory release. It is independent of Obsidian's own plugins. Oshan owns releases and submission, with Sumedhe Dissanayake as backup maintainer. The [supported-version ledger](VERSIONS.md) records availability, retirement dates and required upgrades. Before public launch, the pre-release policy permits breaking disposable test data and old plugin versions without a compatibility window. Version 0.2.0 requires `distari://` note references, which the Distari service has used since 2026-10-13; 0.1.x versions may fail to import note images and links against it, so upgrade to 0.2.0. See [VERSIONS.md](VERSIONS.md) for the release state.

The plugin's `GET /api/v1/projects/{project_id}/notes` dependency is outside Distari's supported public API. After public launch, each official version remains supported while current and for at least 90 days after its successor becomes available, and compatible plugin assets and upgrade instructions must precede a breaking backend change. Other note routes and third-party clients do not gain a public compatibility promise from this plugin's access.

The server requires the token's `read` scope and current project access, and excludes other members' private notes. The plugin then excludes other authors' shared notes using `is_mine`. Notes are a plain array with `limit` (default 100, maximum 200) and zero-based `offset`; concurrent source changes can repeat or omit rows until a later refresh. Successful native smoke checks prove the tested revision works, not that those routes are public API.

## Privacy and network access

The plugin sends authenticated GET requests to `https://api.distari.com` by default for project lists, papers, current summaries and notes. You can configure your own HTTPS API origin, or an HTTP localhost API for development. Only choose an API you trust: it receives your personal token. The plugin does not send vault contents or local edits to Distari and includes no client analytics, ads or requests to other services. Distari's API handles authenticated requests under its [privacy policy](https://distari.com/privacy/).

Files are read and written through Obsidian's Vault API, within your chosen vault folder. The plugin accesses no files outside the vault. Obsidian Keychain stores your token; plugin settings store only its secret name. Revoke the token in Distari to stop further reads, and remove its Keychain entry when you no longer need it. Existing exported Markdown remains in your vault.

## Development and distribution

Use Node 22.18 or newer and run `npm ci && npm run check`. Checks cover sync behavior, TypeScript, the production bundle, release metadata and an isolated packaged install/update regression. The plugin uses Obsidian's `requestUrl`, Vault API and SecretStorage API. It bundles browser-safe SHA-256 from `@noble/hashes`.

The plugin is prepared under the [MIT license](LICENSE); bundled dependency notices are in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) and the JavaScript asset. This license applies to the plugin, not the rest of Distari. Oshan approved the license and the public source export on 2026-10-10. See [RELEASE.md](RELEASE.md) for the distribution decision, export command, submission packet and published-installation gates.

Native installation, import, source updates, local-edit conflicts and token revocation passed in Obsidian 1.13.7 against an isolated local API. Local package checks do not establish a public download, directory review, native published update or deployed-account pass. Report problems at <https://github.com/distari-ai/obsidian-sync/issues>, with app/plugin versions and redacted errors. Never attach tokens, Keychain data or private notes.


Inline note images are fetched with the same read token from `/api/v1/note-assets/<id>` and saved under the project's `Assets/` folder, with portable relative Markdown links. Only the member's own notes are synced. Images are immutable by ID; a locally edited asset is preserved and the source gets a separate content-hash copy. Failed image reads stop before replacing the corresponding note. This endpoint has the same internal-plugin compatibility boundary as the notes endpoint. No vault bytes or image edits are uploaded. Existing assets remain after source note removal so local vault references are not deleted.
