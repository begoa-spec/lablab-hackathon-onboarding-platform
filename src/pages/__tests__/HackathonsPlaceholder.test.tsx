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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderHackathons() {
  return render(
    <QueryClientProvider client={queryClient}>
      <Hackathons />
    </QueryClientProvider>
  );
}

let Hackathons: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockFrom.mockReturnValue(createChain());
  mockFunctionsInvoke.mockReset();
  Hackathons = (await import("../HackathonsPlaceholder")).default;
});

/* ── Helper function tests ──────────────────────────── */

describe("slugify", () => {
  it("creates valid slugs", () => {
    const slugify = (name: string): string =>
      name
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .trim();

    expect(slugify("AMD AI Hackathon 2025")).toBe("amd-ai-hackathon-2025");
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("  Spaces   everywhere  ")).toBe("spaces-everywhere");
    expect(slugify("")).toBe("");
  });
});

describe("formatDate", () => {
  it("returns formatted date or em-dash for null", () => {
    const fmt = (dateStr: string | null): string => {
      if (!dateStr) return "\u2014";
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    expect(fmt(null)).toBe("\u2014");
    expect(fmt("2025-06-01T00:00:00Z")).toBe("Jun 1, 2025");
    expect(fmt("2024-12-25T00:00:00Z")).toBe("Dec 25, 2024");
  });
});

describe("isValidEmail", () => {
  it("validates email format", () => {
    const isValidEmail = (email: string): boolean =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@domain.co")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("@domain.com")).toBe(false);
    expect(isValidEmail("user@domain")).toBe(false);
  });
});

/* ── Component tests ────────────────────────────────── */

describe("HackathonsPlaceholder", () => {
  it("shows empty state when no session (query disabled)", async () => {
    renderHackathons();
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

    renderHackathons();

    const empty = await screen.findByText(/no hackathons yet/i);
    expect(empty).toBeInTheDocument();
  });

  it("shows list of hackathons", async () => {
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
      order: {
        data: [{
          id: "hack-1",
          name: "AMD AI Hackathon 2025",
          slug: "amd-ai-hackathon-2025",
          start_date: "2025-06-01T00:00:00Z",
          end_date: "2025-08-01T00:00:00Z",
          github_org: "amd-ai",
          discord_server_id: "123456789012345678",
          welcome_message: null,
          created_at: "2025-01-01T00:00:00Z",
        }],
        error: null,
      },
    });
    hackathonsChain.select = vi.fn(() => hackathonsChain);
    hackathonsChain.in = vi.fn(() => hackathonsChain);

    // Mock counts query: teams and participants
    const teamsCountChain = createChain();
    teamsCountChain.select = vi.fn(() => teamsCountChain);
    teamsCountChain.in = vi.fn(() =>
      Promise.resolve({ data: [{ id: "t-1", hackathon_id: "hack-1" }], error: null })
    );

    const partsCountChain = createChain();
    partsCountChain.select = vi.fn(() => partsCountChain);
    partsCountChain.in = vi.fn(() =>
      Promise.resolve({ data: [{ id: "p-1", hackathon_id: "hack-1" }], error: null })
    );

    mockFrom.mockImplementation((table: string) => {
      if (table === "organizers") return organizerChain;
      if (table === "organizer_hackathons") return linksChain;
      if (table === "hackathons") return hackathonsChain;
      if (table === "teams") return teamsCountChain;
      if (table === "participants") return partsCountChain;
      return createChain();
    });

    renderHackathons();

    const hackName = await screen.findByText("AMD AI Hackathon 2025");
    expect(hackName).toBeInTheDocument();
  });
});