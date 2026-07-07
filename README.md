# LabLab Hackathon Onboarding Platform

A web application for managing hackathon participant onboarding — from sign-up through team formation, approvals, and infrastructure provisioning.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Supabase Setup](#supabase-setup)
- [Deployment](#deployment)

---

## Prerequisites

- **Node.js** 20.x or later
- **npm** 9.x or later
- A **Supabase** project (free tier works)
- A **GitHub** account (for OAuth login)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/lablab-onboarding.git
cd lablab-onboarding

# 2. Install dependencies
npm install

# 3. Set up environment variables (see next section)
cp .env.example .env
# Edit .env with your Supabase project credentials

# 4. Start the development server
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## Environment Variables

The app requires two Supabase environment variables. They are **never committed** to the repository.

| Variable | Description | Where to find it |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous public key | Supabase Dashboard → Settings → API → anon public key |

### Local setup

```bash
cp .env.example .env
```

Then open `.env` and replace the placeholder values with your real credentials.

> ⚠️ **Never commit `.env` to the repository.** It is already in `.gitignore`.

---

## Project Structure

```
├── .github/workflows/deploy.yml   # CI/CD — deploys to Vercel
├── public/                         # Static assets
├── src/
│   ├── components/                 # Shared UI components
│   │   ├── Auth.tsx               # Sign-in / sign-up form
│   │   └── AppLayout.tsx          # Main layout wrapper
│   ├── hooks/                     # React hooks
│   │   └── useAuth.ts            # Auth state, role detection, navigation
│   ├── lib/                       # Core utilities
│   │   ├── config.ts             # App constants (name, tagline)
│   │   ├── supabase.ts           # Supabase client setup
│   │   └── database.types.ts     # TypeScript types for DB schema
│   ├── pages/                     # Route pages
│   │   ├── WizardPlaceholder.tsx  # Participant onboarding wizard
│   │   ├── DashboardPlaceholder.tsx # Organizer dashboard
│   │   └── HackathonsPlaceholder.tsx # Hackathon management
│   ├── App.tsx                    # Root component + routing
│   ├── main.tsx                   # App entry point
│   └── index.css                  # Global styles + Tailwind theme tokens
├── supabase/functions/            # Supabase Edge Functions
│   ├── import-teams/             # CSV team import
│   ├── verify-fireworks/         # Submission verification
│   └── create-team-infrastructure/ # Auto-provision GitHub repos & Discord channels
├── .env.example                   # Template for local environment variables
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json                    # Vercel deployment config
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode (re-runs on file changes) |
| `npm run test:coverage` | Run tests with coverage report |

---

## Testing

This project uses [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for unit and integration tests. Tests live alongside the code they test inside `__tests__` directories.

### Running tests

```bash
# Run all tests once (CI-friendly)
npm test

# Run tests in watch mode — great while you build
npm run test:watch

# Run tests with a coverage report
npm run test:coverage
```

### Writing tests

#### File conventions

- Test files go in a `__tests__` folder next to the code under test.
- Name them `[ComponentName].test.tsx` for components or `[module].test.ts` for utilities.

```
src/components/__tests__/Auth.test.tsx      ← tests src/components/Auth.tsx
src/hooks/__tests__/useAuth.test.ts         ← tests src/hooks/useAuth.ts
src/lib/__tests__/config.test.ts            ← tests src/lib/config.ts
```

#### Mocking Supabase

Every test file that hits Supabase uses the same shared mock at `src/test/mocks/supabase.ts`. The mock provides a Supabase client whose methods (`from`, `select`, `insert`, `upsert`, `auth`, etc.) return Vitest spies. Import it in your test, cast it to `vi.Mock`, and chain `.mockResolvedValue()` / `.mockRejectedValue()` to control what Supabase returns.

```typescript
import { supabase } from "../lib/supabase";
import { mockSupabase } from "../test/mocks/supabase";

vi.mock("../lib/supabase", () => ({ supabase: mockSupabase }));

// Simulate a query
const mockSupabaseTyped = mockSupabase as ReturnType<typeof vi.fn>;
mockSupabaseTyped.mockReturnValue({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
});
```

#### Mocking react-router-dom

Pages that navigate use `useNavigate`. Mock it with a spy:

```typescript
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));
```

#### What each test covers

| Test file | What it exercises |
|---|---|
| `config.test.ts` | App name, tagline, and other constants are defined |
| `supabase.test.ts` | Supabase client is created with correct URL and anon key |
| `Auth.test.tsx` | Sign-in / sign-up form — renders, validates inputs, toggles mode, calls sign-in/sign-up, handles errors |
| `useAuth.test.ts` | Auth hook — detects user, role, loading, and redirect states |
| `App.test.tsx` | Router — renders home page, redirects guests, shows placeholders after sign-in |
| `AppLayout.test.tsx` | Shell — renders header, logo, user menu, and child routes; handles sign-out |
| `DashboardPlaceholder.test.tsx` | Dashboard — shows welcome message with user name, zero-state when no metrics exist |
| `HackathonsPlaceholder.test.tsx` | Hackathons — lists hackathons, shows empty state, handles loading and errors |
| `WizardPlaceholder.test.tsx` | Onboarding wizard — renders step layout, shows first step content, handles navigation |
| `RegistrationPage.test.tsx` | Registration flow — role selection, hackathon picker, team creation, confirmation, submission, and error recovery |

### Testing checklist for new components

When you add a new component or page, write tests that cover:

1. **Loading state** — what the user sees before data arrives (spinner, skeleton)
2. **Empty state** — what the user sees when there is no data (helpful message, next action)
3. **Success state** — the happy path with real-looking data
4. **Error state** — what the user sees when the API fails (message, retry button)
5. **User interactions** — clicks, form submissions, keyboard navigation
6. **Edge cases** — very long names, zero results, rapid double-clicks

---

## Supabase Setup

This project uses Supabase for authentication, database, and Edge Functions.

### Database tables

The following tables are expected in your Supabase project:

- **organizers** — hackathon organizers (linked to auth users)
- **hackathons** — hackathon events
- **teams** — participant teams
- **participants** — individual participants (linked to teams)
- **organizer_hackathons** — which organizers manage which hackathons
- **audit_logs** — activity tracking

### Authentication

- **Email / password** — built-in sign-up and sign-in
- **GitHub OAuth** — requires a GitHub OAuth App configured in your Supabase Auth settings
- Email confirmation can be enabled or disabled in the Supabase dashboard (Auth → Settings → General → Confirm email)

### Edge Functions

To deploy Edge Functions locally:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Deploy a function
supabase functions deploy import-teams
```

---

## Deployment

The project deploys to **Vercel** via GitHub Actions.

### CI/CD workflow

On every push to `main` (and on pull requests), the workflow at `.github/workflows/deploy.yml`:

1. Installs dependencies
2. Creates a `.env` file from **GitHub Action secrets** (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)
3. Builds the project with Vercel CLI
4. Deploys to Vercel
5. Comments a preview URL on pull requests

### GitHub Secrets required

Configure these in your repository: **Settings → Secrets and variables → Actions**

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VERCEL_TOKEN` | Vercel API token (from Account Settings → Tokens) |
| `VERCEL_TEAM_ID` | Your Vercel team ID |
| `VERCEL_PROJECT_ID` | Your Vercel project ID |

### Vercel environment variables

The same two Supabase variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) should also be added in the Vercel dashboard under your project → Settings → Environment Variables.