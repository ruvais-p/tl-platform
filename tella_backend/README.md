# Tella Django Backend

The Django API is the platform's source of truth. Moodle is an API client and presentation layer; academic authorization and business rules stay in Django services.

The maintained endpoint and payload reference is [docs/API.md](../docs/API.md). For step-by-step creation of every data segment, see [docs/DATA_ENTRY_GUIDE.md](../docs/DATA_ENTRY_GUIDE.md).

## Implemented architecture (Phases 1–4)

- `config/settings/base.py`: shared environment-driven configuration
- `config/settings/development.py`: local development settings
- `config/settings/production.py`: secure production defaults
- `accounts/models.py`: UUID custom user model using Django Groups and Permissions
- `accounts/services.py`: sensitive account operations and privilege-escalation safeguards
- `accounts/permissions.py`: reusable DRF group and permission classes
- `accounts/management/commands/setup_groups.py`: idempotent RBAC synchronization
- `curriculum/`: Programs, Courses, CourseVersions, Chapters, Subtopics, and LearningActivities
- `content/` and `media_library/`: structured learning content and storage-ready media metadata
- `students/`: cohorts, memberships, versioned enrollments, course assignments, and LMS mappings
- `progress/`: transactional activity progress with persisted subtopic, chapter, and course snapshots
- `assessments/`: reusable questions, learning checks, case studies, attempts, and server-side scoring
- `config/urls.py`: versioned, JSON-only REST endpoints under `/api/v1/`, with no HTML routes

The access-control groups are `SUPER_ADMIN`, `ADMIN`, `ACADEMIC_MANAGER`, `CONTENT_MANAGER`, `TEACHER`, and `STUDENT`. These are Django authentication Groups. Classroom cohorts use the separate `students.StudentGroup` model.

## Requirements and environment

Use Python 3.10+, PostgreSQL 15+, and the compatible dependency ranges in `requirements.txt`.

```bash
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Set a strong `DJANGO_SECRET_KEY`, PostgreSQL credentials, allowed hosts, CORS origins, JWT lifetimes, and optional Redis/object-storage values in `.env`. Never commit `.env`.

## Database and initial access control

```bash
python manage.py migrate
python manage.py setup_groups
python manage.py createsuperuser
```

`setup_groups` is safe to run repeatedly. It resolves permissions by `app_label.codename`, never database IDs, and synchronizes each group's permissions.
The user created by `createsuperuser` can sign in directly to the Next.js staff workspace; Django does not expose an `/admin/` frontend.

## Run and test

```bash
python manage.py check
python manage.py runserver 0.0.0.0:8000
pytest
```

The native Django test runner is also supported:

```bash
python manage.py test
```

## Authentication API

All public APIs are versioned under `/api/v1/`:

- `POST /api/v1/auth/login/` with `email` and `password`
- `POST /api/v1/auth/refresh/` with `refresh`
- `POST /api/v1/auth/logout/` with a Bearer access token and `refresh`
- `GET /api/v1/auth/me/` with a Bearer access token
- `GET`/`POST /api/v1/auth/users/` and `GET`/`PATCH /api/v1/auth/users/{id}/` for guarded staff account management
- `GET /api/v1/auth/groups/`; permission administrators may `PATCH /api/v1/auth/groups/{id}/permissions/`
- `GET /api/v1/auth/permissions/` for the permission-management catalog

Access tokens default to 15 minutes. Refresh tokens default to seven days, rotate on refresh, and are blacklisted after rotation or logout. `/auth/me/` returns Django Groups and effective permissions.

## Authorization design

API views perform authentication and coarse permission checks. Serializers validate input. Services enforce sensitive business rules and use transactions. Selectors own scoped reads. Teachers only see students connected through an assigned StudentGroup, and student content access requires an active, unexpired enrollment for the exact CourseVersion.

Normal administrators receive `manage_users` but not `manage_permissions`. The account service rejects assignment of `SUPER_ADMIN`, changes to protected accounts, and non-superuser self-escalation without permission-management authority.

## Redis, Celery, storage, and Moodle

`REDIS_URL` and storage environment variables are reserved now so Redis caching, Celery workers, and S3-compatible storage can be added without changing domain APIs. Moodle authenticates through versioned endpoints and must not implement academic business rules locally.

## Deployment

Use `config.settings.production`, TLS, a production WSGI/ASGI server, managed PostgreSQL, rotated secrets, restricted CORS/hosts, Redis, and object storage. Run migrations and `setup_groups` during controlled deployment. Do not run demo seed commands in production.
