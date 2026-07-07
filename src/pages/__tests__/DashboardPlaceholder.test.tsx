import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Build a mock chain that returns fresh promises per method
function createChain(responses?: {
  maybeSingle?: unknown;
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
      signOut: vi.fn(),
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderDashboard() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

let Dashboard: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
  mockFrom.mockReturnValue(createChain());
  mockFunctionsInvoke.mockReset();
  Dashboard = (await import("../DashboardPlaceholder")).default;
});

/* ── Helper function tests ──────────────────────────── */

describe("parseSteps", () => {
  it("parses valid steps object", () => {
    const parseSteps = (raw: unknown) => {
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

    expect(parseSteps({ amd: true, fireworks: false, natively_ai: true })).toEqual({
      amd: true,
      fireworks: false,
      natively_ai: true,
    });
    expect(parseSteps(null)).toEqual({ amd: false, fireworks: false, natively_ai: false });
    expect(parseSteps("invalid")).toEqual({ amd: false, fireworks: false, natively_ai: false });
  });
});

describe("calcCompletionPct", () => {
  it("returns 0 for empty array", () => {
    const calc = (participants: { steps: { amd: boolean; fireworks: boolean; natively_ai: boolean } }[]) => {
      if (participants.length === 0) return 0;
      const totalSteps = participants.length * 3;
      const done = participants.reduce(
        (sum, p) =>
          sum + (p.steps.amd ? 1 : 0) + (p.steps.fireworks ? 1 : 0) + (p.steps.natively_ai ? 1 : 0),
        0
      );
      return Math.round((done / totalSteps) * 100);
    };

    expect(calc([])).toBe(0);
  });

  it("returns correct percentage", () => {
    const calc = (participants: { steps: { amd: boolean; fireworks: boolean; natively_ai: boolean } }[]) => {
      if (participants.length === 0) return 0;
      const totalSteps = participants.length * 3;
      const done = participants.reduce(
        (sum, p) =>
          sum + (p.steps.amd ? 1 : 0) + (p.steps.fireworks ? 1 : 0) + (p.steps.natively_ai ? 1 : 0),
        0
      );
      return Math.round((done / totalSteps) * 100);
    };

    const p1 = { steps: { amd: true, fireworks: true, natively_ai: true } };
    const p2 = { steps: { amd: true, fireworks: false, natively_ai: false } };
    expect(calc([p1])).toBe(100);
    expect(calc([p2])).toBe(33);
    expect(calc([p1, p2])).toBe(67);
  });
});

describe("allStepsDone", () => {
  it("returns true only when all three steps are done", () => {
    const allDone = (p: { steps: { amd: boolean; fireworks: boolean; natively_ai: boolean } }) =>
      p.steps.amd && p.steps.fireworks && p.steps.natively_ai;

    expect(allDone({ steps: { amd: true, fireworks: true, natively_ai: true } })).toBe(true);
    expect(allDone({ steps: { amd: true, fireworks: false, natively_ai: true } })).toBe(false);
    expect(allDone({ steps: { amd: false, fireworks: false, natively_ai: false } })).toBe(false);
  });
});

/* ── Component tests ────────────────────────────────── */

describe("DashboardPlaceholder", () => {
  it("shows empty state when no session (query disabled)", async () => {
    renderDashboard();
    // No session → organizerId never set → query disabled → empty state
    const empty = await screen.findByText(/no hackathons yet/i);
    expect(empty).toBeInTheDocument();
  });

  it("shows empty state when no hackathons exist", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "org-1", email: "org@example.com" },
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
        },
      },
      error: null,
    });

    const organizerChain = createChain({
      maybeSingle: { data: { id: "org-1" }, error: null },
    });

    const linksChain = createChain();
    linksChain.select = vi.fn(() => linksChain);
    linksChain.eq = vi.fn(() => Promise.resolve({ data: [], error: null }));
    linksChain.in = vi.fn(() => linksChain);

    mockFrom.mockImplementation((table: string) => {
      if (table === "organizers") return organizerChain;
      if (table === "organizer_hackathons") return linksChain;
      return createChain();
    });

    renderDashboard();

    const noHackathons = await screen.findByText(/no hackathons yet/i);
    expect(noHackathons).toBeInTheDocument();
  });

  it("shows no teams state", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "org-1", email: "org@example.com" },
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
        },
      },
      error: null,
    });

    const organizerChain = createChain({
      maybeSingle: { data: { id: "org-1" }, error: null },
    });

    const linksChain = createChain();
    linksChain.select = vi.fn(() => linksChain);
    linksChain.eq = vi.fn(() => Promise.resolve({ data: [{ hackathon_id: "hack-1" }], error: null }));
    linksChain.in = vi.fn(() => linksChain);

    const hackathonsChain = createChain({
      order: { data: [{ id: "hack-1", name: "Test Hackathon", slug: "test-hack", start_date: null, end_date: null, github_org: null, discord_server_id: null, welcome_message: null, created_at: "2024-01-01T00:00:00Z" }], error: null },
    });
    hackathonsChain.select = vi.fn(() => hackathonsChain);
    hackathonsChain.in = vi.fn(() => hackathonsChain);

    const teamsChain = createChain({
      order: { data: [], error: null },
    });
    teamsChain.select = vi.fn(() => teamsChain);
    teamsChain.eq = vi.fn(() => teamsChain);

    mockFrom.mockImplementation((table: string) => {
      if (table === "organizers") return organizerChain;
      if (table === "organizer_hackathons") return linksChain;
      if (table === "hackathons") return hackathonsChain;
      if (table === "teams") return teamsChain;
      return createChain();
    });

    renderDashboard();

    const noTeams = await screen.findByText(/no teams yet/i);
    expect(noTeams).toBeInTheDocument();
  });

  it("shows table with teams when data exists", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "org-1", email: "org@example.com" },
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
        },
      },
      error: null,
    });

    const organizerChain = createChain({
      maybeSingle: { data: { id: "org-1" }, error: null },
    });

    const linksChain = createChain();
    linksChain.select = vi.fn(() => linksChain);
    linksChain.eq = vi.fn(() => Promise.resolve({ data: [{ hackathon_id: "hack-1" }], error: null }));
    linksChain.in = vi.fn(() => linksChain);

    const hackathonsChain = createChain({
      order: { data: [{ id: "hack-1", name: "Test Hack", slug: "test-hack", start_date: null, end_date: null, github_org: null, discord_server_id: null, welcome_message: null, created_at: "2024-01-01T00:00:00Z" }], error: null },
    });
    hackathonsChain.select = vi.fn(() => hackathonsChain);
    hackathonsChain.in = vi.fn(() => hackathonsChain);

    const teamsChain = createChain({
      order: { data: [{ id: "team-1", name: "Team Alpha", hackathon_id: "hack-1", is_approved: false, github_repo_url: null, discord_channel_id: null, created_at: "2024-01-01T00:00:00Z" }], error: null },
    });
    teamsChain.select = vi.fn(() => teamsChain);
    teamsChain.eq = vi.fn(() => teamsChain);

    const participantsChain = createChain();
    participantsChain.select = vi.fn(() => participantsChain);
    participantsChain.eq = vi.fn(() => Promise.resolve({
      data: [{ id: "p-1", team_id: "team-1", name: "Alice", email: "alice@test.com", steps_completed: { amd: true, fireworks: true, natively_ai: true }, github_username: "alice", discord_username: "alice#1234", hackathon_id: "hack-1" }],
      error: null,
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "organizers") return organizerChain;
      if (table === "organizer_hackathons") return linksChain;
      if (table === "hackathons") return hackathonsChain;
      if (table === "teams") return teamsChain;
      if (table === "participants") return participantsChain;
      return createChain();
    });

    renderDashboard();

    const teamName = await screen.findByText("Team Alpha");
    expect(teamName).toBeInTheDocument();
  });
});