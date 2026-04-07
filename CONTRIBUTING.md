# Contributing to TIVIFY

Thank you for your interest in contributing to TIVIFY! This project is vibecoded with AI assistance, and human contributions are very welcome.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a feature branch from `main`
5. Make your changes
6. Test your changes
7. Submit a Pull Request

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Go 1.22+ (for backend development)
- Node.js 18+ (for frontend development)
- JDK 17 (for Android development)
- Android Studio (recommended for Android development)

### Backend (Go)

```bash
# Start infrastructure
make dev-up

# Run backend with hot reload
make backend-dev
```

The backend runs on `http://localhost:8080`.

### Frontend (Next.js)

```bash
# Install dependencies
cd frontend && npm install

# Run dev server
make frontend-dev
```

The frontend runs on `http://localhost:3000`.

### Android (Kotlin)

Open the `android/` directory in Android Studio, or build from the command line:

```bash
cd android
./gradlew assembleDebug
```

### Full Stack (Docker)

```bash
cp .env.example .env
# Edit .env with your settings
make up
```

## Project Structure

| Directory | Language | Description |
|-----------|----------|-------------|
| `backend/` | Go | Fiber REST API, GORM models, services |
| `frontend/` | TypeScript | Next.js 14 web application |
| `android/` | Kotlin | Jetpack Compose mobile/TV app |
| `docker/` | YAML | Docker Compose services |
| `nginx/` | Config | Reverse proxy configuration |
| `docs/` | Markdown | Architecture, API, deployment docs |

## Guidelines

### Code Style

- **Go**: Follow standard Go conventions (`gofmt`, `go vet`)
- **TypeScript/React**: Follow the existing code style (Tailwind CSS, App Router patterns)
- **Kotlin**: Follow Kotlin coding conventions, use Jetpack Compose idioms
- Keep functions focused and small
- Write self-documenting code; add comments only when the "why" isn't obvious

### Commits

- Write clear, concise commit messages
- Use the imperative mood ("Add feature" not "Added feature")
- Reference issues when applicable (`Fixes #123`)

### Pull Requests

- Keep PRs focused on a single change
- Provide a clear description of what and why
- Include steps to test your changes
- Update documentation if you change behavior

### Versioning

TIVIFY uses semantic versioning. The `VERSION` file at the root is the single source of truth.

When making changes that affect the Android app:
1. Update `VERSION` (semver: MAJOR.MINOR.PATCH)
2. Increment `versionCode` in `android/app/build.gradle.kts` (integer, always +1)

### Security

- Never commit `.env` files, credentials, or API keys
- Follow the security practices outlined in the README
- Report security vulnerabilities privately (do not open public issues)

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include steps to reproduce for bugs
- Include your environment details (OS, Docker version, browser, etc.)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
