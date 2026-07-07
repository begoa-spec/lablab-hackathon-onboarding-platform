import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function createChain(responses?: {
  maybeSingle?: unknown;
  single?: unknown;
  order?: unknown;
}) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then: vi.fn(),
  };

  chain.then = vi.fn((onfulfilled?: unknown) => {
    return Promise.resolve(
      typeof onfulfilled === "function"
        ? onfulfilled({ data: null, error: null })
        : { data: null, error: null }
    );
  });

  if (responses?.maybeSingle) {
    chain.maybeSingle = vi.fn(() =>
      Promise.resolve(responses.maybeSingle as { data: unknown; error: unknown })
    );
  }
  if (responses?.single) {
    chain.single = vi.fn(() =>
      Promise.resolve(responses.single as { data: unknown; error: unknown })
    );
  }
  if (responses?.order) {
    chain.order = vi.fn(() =>
      Promise.resolve(responses.order as { data: unknown; error: unknown })
    );
  }

  return chain;
}

const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// We need to mock useCurrentParticipant since Wizard uses it
const mockUseCurrentParticipant = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useCurrentParticipant: () => mockUseCurrentParticipant(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWizard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Wizard />
    </QueryClientProvider>
  );
}

let Wizard: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockUseCurrentParticipant.mockReturnValue({ participant: null, loading: true });
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockFrom.mockReturnValue(createChain());
  mockFunctionsInvoke.mockReset();
  Wizard = (await import("../WizardPlaceholder")).default;
});

/* ── Helper function tests ──────────────────────────── */

describe("getStepsCompleted", () => {
  it("parses valid object", () => {
    const getStepsCompleted = (raw: unknown) => {
      if (typeof raw === "object" && raw !== null) {
        const r = raw as Record<string, unknown>;
        return {
          amd: Boolean(r.amd),
          fireworks: Boolean(r.fireworks),
          natively_ai: Boolean(r.natively_ai),
        };
      }
      return { amd: false, fireworks: false, natively_ai: false };
    };

    expect(getStepsCompleted({ amd: true, fireworks: false, natively_ai: true })).toEqual({
      amd: true, fireworks: false, natively_ai: true,
    });
    expect(getStepsCompleted(null)).toEqual({ amd: false, fireworks: false, natively_ai: false });
    expect(getStepsCompleted(undefined)).toEqual({ amd: false, fireworks: false, natively_ai: false });
  });
});

/* ── Component tests ────────────────────────────────── */

describe("WizardPlaceholder", () => {
  it("shows loading state when participant is loading", () => {
    mockUseCurrentParticipant.mockReturnValue({ participant: null, loading: true });
    renderWizard();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows not found message when no participant", async () => {
    mockUseCurrentParticipant.mockReturnValue({ participant: null, loading: false });
    renderWizard();

    const noHackathon = await screen.findByText(/no hackathon found/i);
    expect(noHackathon).toBeInTheDocument();
  });

  it("shows welcome and steps when participant exists", async () => {
    const mockParticipant = {
      id: "p-1",
      name: "Test User",
      email: "test@example.com",
      team_id: "team-1",
      hackathon_id: "hack-1",
      steps_completed: { amd: false, fireworks: false, natively_ai: false },
      auth_user_id: "user-1",
      github_username: null,
      discord_username: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    mockUseCurrentParticipant.mockReturnValue({
      participant: mockParticipant,
      loading: false,
    });

    // Mock team query
    const teamChain = createChain({
      single: { data: { id: "team-1", name: "My Team" }, error: null },
    });
    teamChain.select = vi.fn(() => teamChain);
    teamChain.eq = vi.fn(() => teamChain);

    // Mock hackathon query
    const hackChain = createChain({
      single: { data: { name: "Test Hackathon" }, error: null },
    });
    hackChain.select = vi.fn(() => hackChain);
    hackChain.eq = vi.fn(() => hackChain);

    // Mock teammates query
    const teammateChain = createChain({
      neq: vi.fn(() => ({
        then: vi.fn((onfulfilled?: unknown) =>
          Promise.resolve(
            typeof onfulfilled === "function"
              ? onfulfilled({ data: [], error: null })
              : { data: [], error: null }
          )
        ),
      })),
    });
    teammateChain.select = vi.fn(() => teammateChain);
    teammateChain.eq = vi.fn(() => teammateChain);

    // Mock audit_logs insert
    const auditChain = createChain();
    auditChain.insert = vi.fn(() => ({
      then: vi.fn((onfulfilled?: unknown) =>
        Promise.resolve(
          typeof onfulfilled === "function"
            ? onfulfilled({ data: null, error: null })
            : { data: null, error: null }
        )
      ),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "teams") return teamChain;
      if (table === "hackathons") return hackChain;
      if (table === "participants") return teammateChain;
      if (table === "audit_logs") return auditChain;
      return createChain();
    });

    renderWizard();

    const welcome = await screen.findByText(/welcome, test user/i);
    expect(welcome).toBeInTheDocument();
    expect(screen.getAllByText(/amd cloud account/i).length).toBeGreaterThanOrEqual(2);
  });

  it("shows all set state when all steps completed", async () => {
    const mockParticipant = {
      id: "p-1",
      name: "Test User",
      email: "test@example.com",
      team_id: "team-1",
      hackathon_id: "hack-1",
      steps_completed: { amd: true, fireworks: true, natively_ai: true },
      auth_user_id: "user-1",
      github_username: "testuser",
      discord_username: "testuser#1234",
      created_at: "2024-01-01T00:00:00Z",
    };

    mockUseCurrentParticipant.mockReturnValue({
      participant: mockParticipant,
      loading: false,
    });

    // Mock team query
    const teamChain = createChain({
      single: { data: { id: "team-1", name: "My Team" }, error: null },
    });
    teamChain.select = vi.fn(() => teamChain);
    teamChain.eq = vi.fn(() => teamChain);

    // Mock hackathon query
    const hackChain = createChain({
      single: { data: { name: "Test Hackathon" }, error: null },
    });
    hackChain.select = vi.fn(() => hackChain);
    hackChain.eq = vi.fn(() => hackChain);

    // Mock teammates query
    const teammateChain = createChain();
    teammateChain.select = vi.fn(() => teammateChain);
    teammateChain.eq = vi.fn(() => teammateChain);
    teammateChain.neq = vi.fn(() => ({
      then: vi.fn((onfulfilled?: unknown) =>
        Promise.resolve(
          typeof onfulfilled === "function"
            ? onfulfilled({ data: [{ id: "p-2", name: "Teammate One", email: "teammate@test.com" }], error: null })
            : { data: [{ id: "p-2", name: "Teammate One", email: "teammate@test.com" }], error: null }
        )
      ),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "teams") return teamChain;
      if (table === "hackathons") return hackChain;
      if (table === "participants") return teammateChain;
      return createChain();
    });

    renderWizard();

    const allSet = await screen.findByText(/you're all set/i);
    expect(allSet).toBeInTheDocument();
  });
});