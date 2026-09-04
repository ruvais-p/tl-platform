# Moodle administrator notes

## Install the local plugin

1. Copy `local/tella_workshop` into the Moodle `local/` directory (already present in this checkout).
2. Visit *Site administration → Notifications* or run:

```powershell
php admin/cli/upgrade.php --non-interactive
php admin/cli/purge_caches.php
```

3. Confirm **Tella skill experiments** under *Site administration → Plugins → Local plugins*.

## Configure the Django bridge

*Site administration → Plugins → Local plugins → Tella skill experiments*

| Setting | Local default |
| --- | --- |
| Django API base URL | `http://127.0.0.1:8000` |
| SSO shared secret | `tella-dev-sso-secret-change-me` (must match Django `MOODLE_SSO_SECRET`) |
| Default activity UUID | blank = first published activity with a runtime experiment definition |

Students open `/local/tella_workshop/index.php` while signed into Moodle. The plugin exchanges identity server-side; there is no second login form.

Use `/local/tella_workshop/index.php?activity=<activity-uuid>` to link to a specific admin-published experiment. One installed plugin can therefore deliver any number of GeoGebra and placeholder experiments. Curriculum changes, GeoGebra material IDs, validated workspace data, instructions, tracking objects, and placeholder content do not require a plugin reinstall or cache purge.

The plugin is online-required for identity, tracking, and future AI features. A short interruption after an activity has loaded queues progress until reconnection, but a learner cannot start an activity offline.

## Rebuild AMD modules after JS edits

```powershell
node moodle/local/tella_workshop/build-amd.js
php moodle/admin/cli/purge_caches.php
```

Rebuild and purge only when the renderer code itself changes. Admin-authored experiment changes are loaded from Django at runtime.
