# Tella Learning Platform (local)

Production-oriented Moodle plugin plus Django backend for university skill-enhancement workshops. Phase 1 delivers the Business Mathematics multivariable modelling workshop.

## Local stack (this checkout)

- Moodle 4.5 at `http://localhost:8080`
- Django API at `http://127.0.0.1:8000`
- PostgreSQL 16 databases `moodle` and `tella_dev`
- PHP 8.3 NTS (portable, under `tools/php`)
- Python 3.12 virtualenv in `venv/`

This environment uses a **native Windows install**, not Docker.

## Launch the demo

If this is a fresh checkout, install the local runtimes and Python dependencies first:

```bat
setup-local.cmd
```

The setup script creates `venv\`, downloads the portable PHP runtime to `tools\php\`, installs Moodle 4.5 source into `moodle\` while preserving the Tella plugin, configures the PHP extensions Moodle requires, installs `tella_backend\requirements.txt`, creates `tella_backend\.env`, runs Django migrations, synchronises groups, and seeds demo data.

PostgreSQL 15+ is the one external prerequisite. Start its service and, once as a PostgreSQL administrator, create the local role and databases expected by the checked-in development configuration:

```sql
CREATE ROLE tella LOGIN PASSWORD 'tella_dev_local';
CREATE DATABASE tella_dev OWNER tella;
CREATE DATABASE moodle OWNER tella;
```

On first use, the script opens Moodle’s web installer. Use `moodledata\` as its data directory and the `tella` PostgreSQL role for the `moodle` database.

The first run opens Moodle’s web installer at `http://localhost:8080`. Complete it using PostgreSQL, then rerun `setup-local.cmd`; the rerun completes Moodle upgrades, purges caches, and creates the `Tella Business Mathematics Demo` course idempotently. Finally run `launch-demo.cmd`.

From the project directory (double-click `launch-demo.cmd`, or run):

```powershell
.\launch-demo.ps1
```

This starts PostgreSQL if needed, Moodle on port 8080, Django on port 8000, then opens the Skill Enhancement tab in your browser.

Or in two terminals:

```powershell
# Moodle
$env:Path = "D:\prod\TL-Platform\tools\php;" + $env:Path
cd D:\prod\TL-Platform\moodle
php -S localhost:8080 router.php

# Django
cd D:\prod\TL-Platform\tella_backend
..\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

## Logins

| Surface | URL | Credentials |
| --- | --- | --- |
| Moodle | http://localhost:8080 | `admin` / `Admin123!` |
| Django admin | http://127.0.0.1:8000/admin/ | `admin@example.com` / `Admin123!` |
| Skill Enhancement tab | http://localhost:8080/local/tella_workshop/index.php | Moodle session (no second login) |

Content manager: `content@example.com` / `Admin123!`

## Useful commands

```powershell
# Moodle caches / plugin install
cd moodle
php admin/cli/purge_caches.php
php admin/cli/upgrade.php --non-interactive

# Django
cd tella_backend
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py seed_workshop
..\venv\Scripts\python.exe manage.py test

# Plugin structure
node --test moodle/local/tella_workshop/tests/phase3.test.js
```

SSO secret (Moodle plugin setting and Django `MOODLE_SSO_SECRET`) defaults to `tella-dev-sso-secret-change-me`.

See `docs/` for API notes, Moodle admin install, and known limitations.
