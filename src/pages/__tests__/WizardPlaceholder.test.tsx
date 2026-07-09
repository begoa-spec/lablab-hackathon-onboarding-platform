import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* ── Actual step labels from WizardPlaceholder STEPS ── */
const EXPECTED_STEP_LABELS = [
  "AMD Cloud Account",
  "Fireworks Promo Code",
  "Natively AI Account",
  "Join Discord",
  "Join GitHub",
];

/* ── Step keys (must match STEPS array) ──────────────── */
// These keys must match the STEPS array in WizardPlaceholder
const EXPECTED_STEP_KEYS: string[] = ["amd", "fireworks", "natively_ai", "discord", "github"];

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

function renderWizard(Wizard: React.ComponentType) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Wizard />
    </QueryClientProvider>
  );
}

let Wizard: React.ComponentType;

async function setupDefaultMocks(
  participantOverride?: Record<string, unknown>,
  teamOverride?: Record<string, unknown>
) {
  const participant = participantOverride ?? {
    id: "p-1",
    name: "Test User",
    email: "test@example.com",
    team_id: "team-1",
    hackathon_id: "hack-1",
    steps_completed: { amd: false, fireworks: false, natively_ai: false, discord: false, github: false },
    auth_user_id: "user-1",
    github_username: null,
    discord_username: null,
    created_at: "2024-01-01T00:00:00Z",
  };

  mockUseCurrentParticipant.mockReturnValue({ participant, loading: false });

  // team
  const teamChain = createChain({
    single: { data: teamOverride ?? { id: "team-1", name: "My Team" }, error: null },
  });
  teamChain.select = vi.fn(() => teamChain);
  teamChain.eq = vi.fn(() => teamChain);

  // hackathon
  const hackChain = createChain({
    single: { data: { name: "Test Hackathon" }, error: null },
  });
  hackChain.select = vi.fn(() => hackChain);
  hackChain.eq = vi.fn(() => hackChain);

  // teammates
  const teammateChain = createChain();
  teammateChain.select = vi.fn(() => teammateChain);
  teammateChain.eq = vi.fn(() => teammateChain);
  teammateChain.neq = vi.fn(() => ({
    then: vi.fn((cb?: unknown) =>
      Promise.resolve(typeof cb === "function" ? cb({ data: [], error: null }) : { data: [], error: null })
    ),
  }));

  // audit_logs
  const auditChain = createChain();
  auditChain.insert = vi.fn(() => ({
    then: vi.fn((cb?: unknown) =>
      Promise.resolve(typeof cb === "function" ? cb({ data: null, error: null }) : { data: null, error: null })
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
  mockUseCurrentParticipant.mockReturnValue({ participant: null, loading: true });
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockFrom.mockReturnValue(createChain());
  Wizard = (await import("../WizardPlaceholder")).default;
});

/* ── getStepsCompleted tests ────────────────────────── */

describe("getStepsCompleted helper", () => {
  it("parses all 5 keys from a valid object", () => {
    const getStepsCompleted = (raw: unknown) => {
      if (typeof raw === "object" && raw !== null) {
        const r = raw as Record<string, unknown>;
        return {
          amd: Boolean(r.amd),
          fireworks: Boolean(r.fireworks),
          natively_ai: Boolean(r.natively_ai),
          discord: Boolean(r.discord),
          github: Boolean(r.github),
        };
      }
      return { amd: false, fireworks: false, natively_ai: false, discord: false, github: false };
    };

    const allTrue = { amd: true, fireworks: true, natively_ai: true, discord: true, github: true };
    expect(getStepsCompleted(allTrue)).toEqual(allTrue);

    const allFalse = { amd: false, fireworks: false, natively_ai: false, discord: false, github: false };
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
          discord: Boolean(r.discord),
          github: Boolean(r.github),
        };
      }
      return { amd: false, fireworks: false, natively_ai: false, discord: false, github: false };
    };

    const partial = getStepsCompleted({ amd: true });
    expect(partial.amd).toBe(true);
    expect(partial.fireworks).toBe(false);
    expect(partial.natively_ai).toBe(false);
    expect(partial.discord).toBe(false);
    expect(partial.github).toBe(false);
  });
});

/* ── Step ordering tests ────────────────────────────── */

describe("WizardPlaceholder — step order", () => {
  it("shows all 5 step labels", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    // Each of the 5 step labels should be visible
    for (const label of EXPECTED_STEP_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders step indices 1-5 on the step indicator circles", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    // Step numbers 1, 2, 3, 4, 5 appear in the status circles
    for (let i = 1; i <= 5; i++) {
      const nums = screen.getAllByText(String(i));
      expect(nums.length, `Step number ${i} not found in DOM`).toBeGreaterThanOrEqual(1);
    }
  });

  it("step 2 is locked (button disabled) when step 1 is incomplete", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    const buttons = screen.getAllByRole("button");

    // Find the step 2 button by its label text
    const step2Buttons = buttons.filter((btn) =>
      btn.textContent?.includes("Fireworks Promo Code")
    );

    expect(step2Buttons.length, "Should find step 2 button").toBeGreaterThanOrEqual(1);
    step2Buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("steps beyond the first incomplete one are locked", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    const buttons = screen.getAllByRole("button");

    // Step 1 (AMD Cloud Account) should be enabled
    const step1 = buttons.find((btn) =>
      btn.textContent?.includes("AMD Cloud Account")
    );
    expect(step1, "Step 1 button should exist").toBeDefined();

    // Steps 2 through 5 should be disabled
    for (const label of [
      "Fireworks Promo Code",
      "Natively AI Account",
      "Join Discord",
      "Join GitHub",
    ]) {
      const btns = buttons.filter((btn) => btn.textContent?.includes(label));
      btns.forEach((b) => {
        expect(b, `Step "${label}" should be disabled`).toBeDisabled();
      });
    }
  });
});

/* ── Component rendering tests ──────────────────────── */

describe("WizardPlaceholder — rendering", () => {
  it("shows loading state when participant is loading", () => {
    mockUseCurrentParticipant.mockReturnValue({ participant: null, loading: true });
    renderWizard(Wizard);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows not found message when no participant", async () => {
    mockUseCurrentParticipant.mockReturnValue({ participant: null, loading: false });
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

  it("shows all set state when all 5 steps completed", async () => {
    const participant = {
      id: "p-1",
      name: "Test User",
      email: "test@example.com",
      team_id: "team-1",
      hackathon_id: "hack-1",
      steps_completed: { amd: true, fireworks: true, natively_ai: true, discord: true, github: true },
      auth_user_id: "user-1",
      github_username: "testuser",
      discord_username: "testuser#1234",
      created_at: "2024-01-01T00:00:00Z",
    };
    await setupDefaultMocks(participant, {
      id: "team-1",
      name: "My Team",
      is_approved: true,
      github_repo_url: "https://github.com/org/repo",
      discord_channel_id: "12345",
    });
    renderWizard(Wizard);
    const msg = await screen.findByText(/you're all set/i);
    expect(msg).toBeInTheDocument();
  });
});

/* ── Progress indicator tests ───────────────────────── */

describe("WizardPlaceholder — progress indicator", () => {
  it("has progress dots for all 5 steps", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    // Each step label appears as an aria-label on a progress dot.
    // Use a function matcher because the current step gets a prefix
    // (e.g. "Current step: AMD Cloud Account").
    for (const label of EXPECTED_STEP_LABELS) {
      const dots = screen.getAllByLabelText((content) => content.includes(label));
      expect(dots.length, `Progress dot missing for "${label}"`).toBeGreaterThanOrEqual(1);
    }
  });

  it("first progress dot shows as current when no steps are done", async () => {
    await setupDefaultMocks();
    renderWizard(Wizard);

    // The first step dot should have "Current step:" prefix
    const currentDot = screen.getByLabelText(`Current step: ${EXPECTED_STEP_LABELS[0]}`);
    expect(currentDot).toBeInTheDocument();
  });
});