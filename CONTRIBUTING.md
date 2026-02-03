# Contributing to Cove

Thank you for your interest in contributing to Cove! This document provides guidelines and information for contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/cove.git
   cd cove
   ```
3. **Install dependencies**:
   ```bash
   bun install
   ```
4. **Start the dev server**:
   ```bash
   bun run dev
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:
- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `chore/` — Maintenance tasks

Example: `feat/command-palette`, `fix/modal-focus-trap`

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Formatting (no code change)
- `refactor` — Code restructuring
- `perf` — Performance improvement
- `test` — Adding tests
- `chore` — Maintenance

**Examples:**
```
feat(chat): add message search with date filters
fix(modal): prevent focus escape on Tab key
docs: update deployment guide for Kubernetes
refactor(signals): extract session utilities to separate file
```

### Code Quality

Before committing, run all checks:

```bash
bun run check
```

This runs:
- `oxlint` — Linting
- `oxfmt` — Formatting
- `tsc` — TypeScript type checking
- `knip` — Unused export detection

The pre-commit hook will also run these checks automatically.

## Code Style

### General Principles

1. **Use existing components** — Check `src/components/ui/` before creating new UI elements
2. **Signals over useState** — Use Preact Signals for shared state
3. **Named exports only** — No default exports (enforced by linter)
4. **CSS variables** — Use `var(--color-*)` for theming, no hardcoded colors
5. **i18n everything** — All user-facing strings go through `t()`

### File Organization

```
src/
├── components/
│   ├── ui/           # Reusable primitives (Button, Modal, etc.)
│   ├── chat/         # Chat-specific components
│   ├── layout/       # App shell components
│   └── [feature]/    # Feature-specific components
├── views/            # Page-level components
├── lib/              # Non-React utilities
├── signals/          # Preact Signals state
├── hooks/            # Custom Preact hooks
├── types/            # TypeScript definitions
└── locales/          # i18n translation files
```

### Component Guidelines

```tsx
// ✅ Good: Named export, typed props, uses existing UI components
import { Button } from "@/components/ui";
import { t } from "@/lib/i18n";

interface MyComponentProps {
  title: string;
  onSubmit: () => void;
}

export function MyComponent({ title, onSubmit }: MyComponentProps) {
  return (
    <div>
      <h2>{title}</h2>
      <Button onClick={onSubmit}>{t("actions.submit")}</Button>
    </div>
  );
}

// ❌ Bad: Default export, hardcoded strings, raw button
export default function MyComponent({ title, onSubmit }) {
  return (
    <div>
      <h2>{title}</h2>
      <button onClick={onSubmit} style={{ color: "#007bff" }}>
        Submit
      </button>
    </div>
  );
}
```

### Adding a New View

1. Create the view component in `src/views/MyView.tsx`
2. Add navigation entry in `src/lib/navigation.tsx`
3. Add i18n keys in `src/locales/en.json`
4. Add route case in `src/app.tsx`

### Adding i18n Strings

1. Add keys to `src/locales/en.json`:
   ```json
   {
     "myFeature": {
       "title": "My Feature",
       "description": "This is my feature"
     }
   }
   ```
2. Use in components:
   ```tsx
   import { t } from "@/lib/i18n";
   
   <h1>{t("myFeature.title")}</h1>
   ```

## Pull Request Process

1. **Create a PR** against `main`
2. **Fill out the PR template** (if provided)
3. **Ensure checks pass** — The CI will run linting, formatting, and type checks
4. **Request review** — Tag maintainers if needed
5. **Address feedback** — Make requested changes
6. **Squash and merge** — PRs are squash-merged to keep history clean

### PR Checklist

- [ ] Code follows the style guidelines
- [ ] All checks pass (`bun run check`)
- [ ] New features have appropriate i18n strings
- [ ] UI changes use existing components where possible
- [ ] Breaking changes are documented

## Reporting Issues

### Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS version
- Screenshots if applicable
- Console errors if applicable

### Feature Requests

Include:
- Use case description
- Proposed solution (optional)
- Alternatives considered (optional)

## Getting Help

- **Discord**: [OpenClaw Community](https://discord.com/invite/clawd)
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and ideas

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
