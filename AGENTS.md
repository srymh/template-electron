# AGENTS.md

This repo is an Electron + Vite + React + TypeScript template.
Use this file as the operating manual for agentic coding tools working here.

Checked for additional agent rules:

- `.cursor/rules/`: not present
- `.cursorrules`: not present
- `.github/copilot-instructions.md`: not present

## Core Commands (pnpm)

Install:

- `pnpm install`

Dev (Vite + Electron via vite-plugin-electron):

- `pnpm dev`

Build (renderer + typecheck + package):

- `pnpm build`
  - runs: `vite build && tsc && electron-builder`

Preview built renderer:

- `pnpm serve` (Vite preview)

Typecheck + tests:

- `pnpm test`
  - runs: `tsc --noEmit && vitest run`

Typecheck + lint:

- `pnpm lint`
  - runs: `tsc --noEmit && eslint`

Format:

- `pnpm format` (Prettier write)

Autofix (typecheck + format + eslint fix):

- `pnpm check`
  - runs: `tsc --noEmit && prettier --write . && eslint --fix`

Notes:

- `postinstall` runs `electron-builder install-app-deps` (native deps like better-sqlite3).
- Generated/build outputs: `dist/`, `dist-electron/`, `release/`.

## Running A Single Test (Vitest)

The `pnpm test` script always runs a full typecheck first. For fast iteration, call
Vitest directly.

Run one test file:

- `pnpm vitest run src/components/table/debounced-input.test.tsx`
- `pnpm vitest run electron/shared/lib/ipc/browser/deepMerge.test.ts`

Run tests matching a name pattern:

- `pnpm vitest run -t "DebouncedInput"`
- `pnpm vitest run -t "deepMerge"`

Watch mode for a single file:

- `pnpm vitest src/components/table/debounced-input.test.tsx`

Run with a UI-less, deterministic run (CI-like):

- `pnpm vitest run --reporter=default`

If you need typecheck only:

- `pnpm tsc --noEmit`

## Lint / Format (Single File)

Lint a subset:

- `pnpm eslint src/routes/(app)/demo.table.tsx`
- `pnpm eslint electron/main/index.ts`

Autofix a subset:

- `pnpm eslint --fix src/routes/(app)/demo.table.tsx`

Format a subset:

- `pnpm prettier --write src/routes/(app)/demo.table.tsx`

## Project Layout

- `src/`: renderer (React + TanStack Router/Query, Tailwind)
- `electron/main/`: Electron main process (windows, IPC handlers, DB, MCP, auth)
- `electron/preload/`: preload script, exposes `window.api`
- `electron/shared/`: shared libs (typed IPC framework used by main + renderer)

Aliases (see `tsconfig.json`):

- `@/*` -> `src/*`
- `#/*` -> `electron/*`

## Tooling Configuration (What Agents Must Follow)

TypeScript (`tsconfig.json`):

- `strict: true`
- `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`: on
- `moduleResolution: bundler`, `verbatimModuleSyntax: true`
- `allowImportingTsExtensions: true`
- `noUncheckedSideEffectImports: true` (avoid side-effect imports unless required)

ESLint (`eslint.config.js`):

- Uses `@tanstack/eslint-config` as the base.
- React hooks rules enabled via `eslint-plugin-react-hooks`.
- React Compiler compatibility:
  - `eslint-plugin-use-no-memo` is enabled.
  - Rules:
    - `use-no-memo/react-hook-form`: error
    - `use-no-memo/tanstack-table`: error
- Some paths are ignored by ESLint (not exhaustive):
  - `dist-electron/**`
  - `src/components/ui/**` (vendored/shadcn-like components)
  - `src/lib/utils.ts`
  - `src/features/ui-demo/**`
  - `electron/**` (note: still keep code clean; just know lint may not catch it)

Prettier (`prettier.config.js`):

- `semi: false`
- `singleQuote: true`
- `trailingComma: all`

EditorConfig (`.editorconfig`):

- indent: spaces
- line endings: LF
- final newline: required

## Code Style Guidelines

### Imports

- Prefer ESM imports; this repo uses `"type": "module"`.
- Use `import type { ... } from '...'` for type-only imports.
- Group imports by origin and keep them stable:
  - node builtins
  - external packages
  - internal aliases (`@/`, `#/`)
  - relative imports
  - side-effect imports (CSS) last
- Keep path aliases consistent:
  - renderer code should prefer `@/..`
  - Electron code should prefer `#/..`

### Formatting

- Let Prettier do the work; do not hand-format around it.
- Keep line breaks similar to existing files (this repo commonly wraps long call
  arguments and JSX props onto multiple lines).

### Types and API boundaries

- Keep types explicit at boundaries:
  - IPC APIs (`electron/shared/lib/ipc/**`)
  - public functions exported from feature modules
  - data returned from Electron main to renderer
- Prefer `unknown` over `any` for untrusted inputs, then narrow.
- Use `Awaited<ReturnType<...>>` for deriving async return shapes (already used
  in `src/api.ts`).

### Naming

- React components: `PascalCase`.
- Hooks: `useX`.
- Functions/vars: `camelCase`.
- Types/interfaces: `PascalCase`.
- Constants: `SCREAMING_SNAKE_CASE` when truly constant; otherwise `camelCase`.

### React Compiler / "use no memo" directive

This repo uses React Compiler (via Babel) in non-sourcemap builds and enforces
opt-out directives for incompatible libraries.

- If a component uses TanStack Table (`useReactTable`) or React Hook Form
  (`useForm` etc.) and ESLint flags it, add this directive at the top of the
  component function body:

```ts
function MyComponent() {
  'use no memo'
  // ...
}
```

- Prefer the directive over disabling lint rules.
- If you must disable, keep the scope minimal and include a reason.

### Error handling

- Fail fast with actionable messages at boundaries.
- In Electron main, prefer `try/catch` around IO and initialization, log with
  context, then rethrow (see `electron/main/index.ts` DB open handling).
- In IPC invoke handlers, only throw serializable errors; do not throw raw
  objects.

### Side effects

- Avoid side-effect imports to satisfy `noUncheckedSideEffectImports`.
- Allowed side effects include app entrypoints and CSS:
  - `src/main.tsx` imports `./styles.css` and `./custom.css`.

## Testing Conventions

- Vitest is configured in `vite.config.ts`:
  - environment: `jsdom`
  - globals: `true`
- Test file naming seen in repo:
  - `*.test.ts`, `*.test.tsx`
- Prefer Testing Library for React component tests (`@testing-library/react`).
- Use fake timers only when needed and always restore (`vi.useRealTimers()`).

## Electron + IPC Notes (Common Pitfalls)

- `electron/preload/index.ts` exposes `window.api` via `contextBridge`.
- Renderer code should not import Electron directly; go through `window.api` or
  through `src/api.ts` which provides a mock/non-Electron fallback.
- IPC registration is centralized in `electron/main/ipc/registerIpc.ts` and uses
  the typed IPC framework under `electron/shared/lib/ipc/**`.

## What Not To Touch

- Do not commit generated output folders (`dist/`, `dist-electron/`, `release/`).
- `src/components/ui/**` is vendored UI code; keep changes minimal and prefer
  extending via wrappers instead of rewriting.
