import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* ── Current step labels (must match STEPS in WizardPlaceholder) ── */
const EXPECTED_STEP_LABELS = [
  "Sign up for AMD AI Developer Program",
  "Claim your Fireworks promo code",
  "Create a Natively AI account",
  "Join the lablab Discord for mentor support",
  "Join the team Discord server",
  "Join team GitHub repository",
];

const EXPECTED_STEP_KEYS = [
  "amd",
  "fireworks",
  "natively_ai",
  "lablab_discord",
  "discord",
  "github",
];

/* ── Chain builder ──────────────────────────────────── */

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
        : { data: null, error: null },
    );
  });

  if (responses?.maybeSingle) {
    chain.maybeSingle = vi.fn(() =>
      Promise.resolve(
        responses.maybeSingle as { data: unknown; error: unknown },
      ),
    );
  }
  if (responses?.single) {
    chain.single = vi.fn(() =>
      Promise.resolve(responses.single as { data: unknown; error: unknown }),
    );
  }
  if (responses?.order) {
    chain.order = vi.fn(() =>
      Promise.resolve(responses.order as { data: unknown; error: unknown }),
    );
  }

  return chain;
}

const mockGetSession = vi.fn();
const mockFrom = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockUseCurrentParticipant = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useCurrentParticipant: () => mockUseCurrentParticipant(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

/** Wrap in both MemoryRouter (for useNavigate) and QueryClientProvider */
function renderWizard(Wizard: React.ComponentType) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Wizard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

let Wizard: React.ComponentType;

function makeBaseParticipant(overrides?: Record<string, unknown>) {
  return {
    id: "p-1",
    name: "Test User",
    email: "test@example.com",
    team_id: "team-1",
    hackathon_id: "hack-1",
    steps_completed: {
      amd: false,
      fireworks: false,
      natively_ai: false,
      lablab_discord: false,
      discord: false,
      github: false,
    },
    auth_user_id: "user-1",
    github_username: null,
    discord_username: null,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

async function setupDefaultMocks(
  participantOverride?: Record<string, unknown>,
  teamOverride?: Record<string, unknown>,
) {
  const participant = participantOverride ?? makeBaseParticipant();

  mockUseCurrentParticipant.mockReturnValue({ participant, loading: false });

  const teamChain = createChain({
    single: {
      data: teamOverride ?? {
        id: "team-1",
        name: "My Team",
        is_approved: false,
        github_repo_url: null,
        discord_channel_id: null,
        mentor_name: null,
        mentor_discord_username: null,
      },
      error: null,
    },
  });
  teamChain.select = vi.fn(() => teamChain);
  teamChain.eq = vi.fn(() => teamChain);

  const hackChain = createChain({
    single: { data: { name: "Test Hackathon" }, error: null },
  });
  hackChain.select = vi.fn(() => hackChain);
  hackChain.eq = vi.fn(() => hackChain);

  const teammateChain = createChain();
  teammateChain.select = vi.fn(() => teammateChain);
  teammateChain.eq = vi.fn(() => teammateChain);
  teammateChain.neq = vi.fn(() => ({
    then: vi.fn((cb?: unknown) =>
      Promise.resolve(
        typeof cb === "function"
          ? cb({ data: [], error: null })
          : { data: [], error: null },
      ),
    ),
  }));

  const auditChain = createChain();
  auditChain.insert = vi.fn(() => ({
    then: vi.fn((cb?: unknown) =>
      Promise.resolve(
        typeof cb === "function"
          ? cb({ data: null, error: null })
          : { data: null, error: null },
      ),
    ),
  }));

  mockFrom.mockImplementation((table: string) => {
    if (table === "teams") return teamChain;
    if (table === "hackathons") return hackChain;
    if (table === "participants") return teammateChain;
    if (table === "audit_logs") return auditChain;
    return createChain();
  });

  return participant;
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockUseCurrentParticipant.mockReturnValue({
    participant: null,
    loading: true,
  });
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockFrom.mockReturnValue(createChain());
  Wizard = (await import("../WizardPlaceholder")).default;
});

/* ── getStepsCompleted tests ────────────────────────── */

describe("getStepsCompleted helper", () => {
  it("parses all 6 keys from a valid object", () => {
    const getStepsCompleted = (raw: unknown) => {
      if (typeof raw === "object" && raw !== null) {
        const r = raw as Record<string, unknown>;
        return {
          amd: Boolean(r.amd),
          fireworks: Boolean(r.fireworks),
          natively_ai: Boolean(r.natively_ai),
          lablab_discord: Boolean(r.lablab_discord),
          discord: Boolean(r.discord),
          github: Boolean(r.github),
        };
      }
      return {
        amd: false,
        fireworks: false,
        natively_ai: false,
        lablab_discord: false,
        discord: false,
        github: false,
      };
    };

    const allTrue = {
      amd: true,
      fireworks: true,
      natively_ai: true,
      lablab_discord: true,
      discord: true,
      github: true,
    };
    expect(getStepsCompleted(allTrue)).toEqual(allTrue);

    const allFalse = {
      amd: false,
      fireworks: false,
      natively_ai: false,
      lablab_discord: false,
      discord: false,
      github: false,
    };
    expect(getStepsCompleted(null)).toEqual(allFalse);
    expect(getStepsCompleted(undefined)).toEqual(allFalse);
    expect(getStepsCompleted({})).toEqual(allFalse);
  });

  it("returns false for any missing keys", () => {
    const getStepsCompleted = (raw: unknown) => {
      if (typeof raw === "object" && raw !== null) {
        const r = raw as Record<string, unknown>;
        return {
          amd: Boolean(r.amd),
          fireworks: Boolean(r.fireworks),
          natively_ai: Boolean(r.natively_ai),
          lablab_discord: Boolean(r.lablab_discord),
          discord: Boolean(r.discord),
          github: Boolean(r.github),
        };
      }
      return {
        amd: false,
        fireworks: false,
        natively_ai: false,
        lablab_discord: false,
        discord: false,
        github: false,
      };
    };

    const partial = getStepsCompleted({ amd: true });
    expect(partial.amd).toBe(true);
    expect(partial.fireworks).toBe(false);
    expect(partial.natively_ai).toBe(false);
    expect(partial.lablab_discord).toBe(false);
    expect(partial.discord).toBe(false);
    expect(partial.github).toBe(false);
  });

  it("has the expected 6 step keys", () => {
    expect(EXPECTED_STEP_KEYS).toHaveLength(6);
    expect(EXPECTED_STEP_KEYS).toContain("lablab_discord");
  });
});

/* ── Step ordering tests ────────────────────────────── */

describe("WizardPlaceholder — step order", () => {
  it("shows all 6 step labels in the checklist", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    for (const label of EXPECTED_STEP_LABELS) {
      const stepButton = await screen.findByRole("button", {
        name: new RegExp(label, "i"),
      });
      expect(stepButton, `Missing step label: "${label}"`).toBeInTheDocument();
    }
  });

  it("renders step indices 1–6 on the checklist circles", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    for (let i = 1; i <= 6; i++) {
      const nums = await screen.findAllByText(String(i));
      expect(nums.length, `Step number ${i} not found`).toBeGreaterThanOrEqual(
        1,
      );
    }
  });

  it("all checklist step buttons are enabled (no locking in new UI)", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    // Every step label button in the checklist should be clickable (not disabled)
    for (const label of EXPECTED_STEP_LABELS) {
      const btn = await screen.findByRole("button", {
        name: new RegExp(label, "i"),
      });
      expect(btn).not.toBeDisabled();
    }
  });

  it("first step detail panel is open by default", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    // The first step's description text should be visible in the detail panel
    expect(await screen.findByText(/accelerated compute/i)).toBeInTheDocument();
  });
});

/* ── Component rendering tests ──────────────────────── */

describe("WizardPlaceholder — rendering", () => {
  it("shows loading state when participant is loading", () => {
    mockUseCurrentParticipant.mockReturnValue({
      participant: null,
      loading: true,
    });
    renderWizard(Wizard);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows not found message when no participant", async () => {
    mockUseCurrentParticipant.mockReturnValue({
      participant: null,
      loading: false,
    });
    renderWizard(Wizard);
    const msg = await screen.findByText(/no hackathon found/i);
    expect(msg).toBeInTheDocument();
  });

  it("shows welcome message with participant name", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);
    const welcome = await screen.findByText(/welcome, test user/i);
    expect(welcome).toBeInTheDocument();
  });

  it("shows all-done banner when all 6 steps completed", async () => {
    const participant = makeBaseParticipant({
      steps_completed: {
        amd: true,
        fireworks: true,
        natively_ai: true,
        lablab_discord: true,
        discord: true,
        github: true,
      },
    });
    await setupDefaultMocks(participant, {
      id: "team-1",
      name: "My Team",
      is_approved: true,
      github_repo_url: "https://github.com/org/repo",
      discord_channel_id: "12345",
      mentor_name: null,
      mentor_discord_username: null,
    });
    renderWizard(Wizard);
    // Banner text shown when all steps done
    const banner = await screen.findByText(/all steps complete/i);
    expect(banner).toBeInTheDocument();
  });

  it("shows 'no mentor assigned' placeholder when mentor_name is null", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);
    const placeholder = await screen.findByText(/no mentor assigned yet/i);
    expect(placeholder).toBeInTheDocument();
  });

  it("shows the completion banner when the team is already approved from a previous session", async () => {
    const participant = makeBaseParticipant({
      steps_completed: {
        amd: true,
        fireworks: true,
        natively_ai: true,
        lablab_discord: true,
        discord: true,
        github: true,
      },
      github_username: "testuser",
      discord_username: "testuser#1234",
    });
    await setupDefaultMocks(participant, {
      id: "team-1",
      name: "My Team",
      is_approved: true,
    });
    renderWizard(Wizard);
    const banner = await screen.findByText(/all steps complete/i);
    expect(banner).toBeInTheDocument();
  });
});

/* ── Progress indicator tests ───────────────────────── */

describe("WizardPlaceholder — progress indicator", () => {
  it("renders a progressbar element", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);
    const bar = await screen.findByRole("progressbar");
    expect(bar).toBeInTheDocument();
  });

  it("progressbar starts at 0 when no steps are done", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);
    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "6");
  });

  it("progressbar reflects completed steps count", async () => {
    const participant = makeBaseParticipant({
      steps_completed: {
        amd: true,
        fireworks: true,
        natively_ai: false,
        lablab_discord: false,
        discord: false,
        github: false,
      },
    });
    await setupDefaultMocks(participant);
    renderWizard(Wizard);
    const bar = await screen.findByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
  });

  it("checklist has 6 items", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);
    const list = await screen.findByRole("list", { name: /setup checklist/i });
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(6);
  });
});
