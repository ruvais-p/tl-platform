# Tella Learning Platform

Django API backend, a unified Next.js web frontend for staff and students, and Moodle plugin source for university skill-enhancement experiments. Lesson definitions are authored centrally and delivered at runtime; the installed clients contain generic renderers and solvers, not lesson-specific datasets, coefficients, wording, or material IDs.

## What runs from this checkout

- Django API at `http://127.0.0.1:8000/api/v1/`
- Next.js staff frontend at `http://localhost:3000/login`
- Next.js student frontend at `http://localhost:3000/learn/login`
- PostgreSQL database `tella_dev`
- Moodle plugin source under `moodle/local/tella_workshop/`

A Moodle clone and PHP runtime are not bundled or required for backend/frontend work. Test the student-facing plugin later in an existing Moodle installation by copying only `moodle/local/tella_workshop/` into its `local/` directory.

## One-command Windows setup

For a native Windows demo environment, run PowerShell from the repository root:

```powershell
.\setup-project.cmd
```

The script installs any missing Node.js, Python, and PostgreSQL tooling; creates `tella_backend/.env`; prepares the Python environment and database; installs frontend dependencies; and seeds the mathematics demo. It does not install PHP or a local Moodle site. If PostgreSQL needs a new database, it asks for the PostgreSQL administrator password without storing it in the repository.

Use `-SkipSeed` to omit demo data or `-StartAfterSetup` to start Django + Next.js when setup finishes. Moodle integration testing is optional: pass `-WithMoodle` only when you deliberately want a temporary Moodle 4.5 host around the tracked plugin.

## Backend setup

From PowerShell in the repository root:

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r tella_backend\requirements.txt
Copy-Item tella_backend\.env.example tella_backend\.env
cd tella_backend
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py setup_groups
..\venv\Scripts\python.exe manage.py seed_ai_management
..\venv\Scripts\python.exe manage.py createsuperuser
..\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

PostgreSQL must be running with the credentials configured in `tella_backend/.env`. Django is API-only and serves no HTML administration routes; use the Next.js application for every web workflow.

## Web frontend

In a second PowerShell terminal:

```powershell
cd admin-platform
$env:DJANGO_API_URL = "http://127.0.0.1:8000/api/v1"
$env:ADMIN_SECURE_COOKIES = "false"
npm install
npm run dev
```

Open `http://localhost:3000/login` for the permission-aware staff dashboard covering curriculum, content, media, learners, assessments, access control, and operational reports. Students use `http://localhost:3000/learn/login`; in Moodle deployments, the signed exchange can create the same learner session without a second password prompt.

For a one-click local frontend launch, run this from the repository root:

```powershell
.\launch-frontend.cmd
```

It starts PostgreSQL if needed, starts Django on port 8000, starts Next.js on port 3000, and opens the learner frontend. `launch-demo.cmd` is kept as a compatible alias and now does exactly the same thing. Neither launcher starts or opens Moodle, and PHP is not required.

The default seed creates separate local demo accounts:

| Role | Login URL | Email | Password |
| --- | --- | --- | --- |
| Administrator | `http://localhost:3000/login` | `admin@example.com` | `Admin123!` |
| Content manager | `http://localhost:3000/login` | `content@example.com` | `Content123!` |
| Student | `http://localhost:3000/learn/login` | `student@example.com` | `Student123!` |

Administrators and content managers share the staff sign-in page but receive different capabilities from their Django Groups. Students use the separate learner sign-in and can access only published content for their active enrollments.

To republish the two demo streams and attach `LPP2.mp4` plus `Multivariable_Calculus_Applications_final.mp4` from your Downloads folder, run:

```powershell
.\publish-demo-content.cmd
```

This posts the lesson data into Django-owned content records. Both the LPP and multivariable experiments are published as structured, data-driven GeoGebra workspaces and rendered in the Next.js learner frontend.

## Useful commands

```powershell
# Django
cd tella_backend
..\venv\Scripts\python.exe manage.py migrate
..\venv\Scripts\python.exe manage.py seed_ai_management
..\venv\Scripts\python.exe manage.py test

# Web frontend
cd ..\admin-platform
npm test
npm run lint
npm run typecheck
npm run build

# Moodle experiment runner
cd ..
node --test moodle/local/tella_workshop/tests/*.test.js
node moodle/local/tella_workshop/build-amd.js
```

SSO secret (Moodle plugin setting and Django `MOODLE_SSO_SECRET`) defaults to `tella-dev-sso-secret-change-me`.

See `docs/` for API notes, experiment authoring, Moodle installation, and known limitations.

## Staff workspace

The unified Next.js staff app lives in `admin-platform/`. See `admin-platform/README.md` for setup and the role-specific workspace scope.
