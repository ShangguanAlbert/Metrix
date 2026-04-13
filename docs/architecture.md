# EduChat Architecture

## Current shape
- Frontend keeps a single React + Vite app, but routes now compose from `src/features/*/routes.js` instead of importing page implementations directly in `src/App.jsx`.
- Backend keeps one Express server, but chat/image route registration is split into `server/modules/chat` and `server/modules/images`, with a compatibility bridge over the legacy mixed registrar.
- Shared API contracts live in `shared/contracts/*` and are intended to be the only place for cross-boundary response normalizers.

## Dependency direction
- `src/App.jsx` -> `src/app/routes` -> `src/features/*/routes.js` -> feature page facades.
- Feature routes should depend on `src/features/*/pages/*`, not `src/pages/*`.
- `server/index.js` should depend on `server/modules/*` for bounded contexts and avoid importing mixed legacy route registrars directly.
- `shared/contracts/*` may be imported by both frontend API clients and backend routes/services.

## Transitional rules
- Existing feature implementations under `src/pages/*` remain valid, but new route entrypoints should be exposed through `src/features/*`.
- `server/routes/chat-and-images.js` remains a legacy compatibility unit; new route work should go into `server/modules/chat` or `server/modules/images`.
- The current goal is boundary clarity, not a full workspace or TypeScript migration.

## Naming conventions
- Frontend feature folders use `src/features/<feature>/{pages,routes}` first; expand with `api`, `hooks`, `store`, `types`, `utils` when the feature grows.
- Backend feature folders use `server/modules/<feature>/{create*Deps,routes}` for entry wiring; shared infra belongs in `server/platform`.
- Shared payload shaping belongs in `shared/contracts/<feature>.js`.
