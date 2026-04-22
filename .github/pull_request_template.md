<!--
  Thanks for contributing to TIVIFY.
  Please fill in the sections that apply. Delete anything that doesn't.
-->

## Summary

<!-- 1–3 bullets describing what changes and why. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor / code cleanup
- [ ] Docs / chore
- [ ] Infra / CI

## Affected areas

- [ ] Backend (Go / Fiber)
- [ ] Frontend (Next.js)
- [ ] Android (Kotlin / Compose)
- [ ] nginx
- [ ] Docker / compose
- [ ] Docs
- [ ] CI / CD

## Test plan

<!--
  How did you verify this? Include commands, manual steps, screenshots, logs.
  CI runs `go test`, `npm test`, `./gradlew testDebugUnitTest` automatically.
-->

- [ ] `go test ./...` (backend)
- [ ] `npm test && npm run build` (frontend)
- [ ] `./gradlew assembleDebug` (android, if touched)
- [ ] Manual smoke in `docker compose` (if infra/backend changed)

## Versioning

<!-- If this changes the Android app or backend behavior that users see: -->

- [ ] Bumped `VERSION` (semver)
- [ ] Bumped `android/app/build.gradle.kts` → `versionCode` (+1)
- [ ] N/A

## Security / breaking changes

- [ ] No security-sensitive surface changed
- [ ] No breaking API / schema changes
- [ ] Breaking changes are documented in the description
