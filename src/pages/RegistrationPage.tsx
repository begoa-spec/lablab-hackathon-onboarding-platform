import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import type { Tables } from "../lib/database.types";
import {
  Loader2,
  Check,
  Trophy,
  Users,
  Calendar,
  ChevronRight,
  Sparkles,
  UserPlus,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface HackathonWithTeams extends Tables<"hackathons"> {
  teams: Tables<"teams">[];
  teamCount: number;
}

type RegistrationStep = "role" | "hackathon" | "team" | "confirming" | "done";

/* ── Helpers ────────────────────────────────────────── */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Main Registration Page ────────────────────────── */

export default function RegistrationPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<RegistrationStep>(
    auth.role === "unknown" ? "role" : "hackathon"
  );
  const [chosenRole, setChosenRole] = useState<"participant" | "organizer">(
    auth.role === "organizer" ? "organizer" : "participant"
  );
  const [hackathons, setHackathons] = useState<HackathonWithTeams[]>([]);
  const [loadingHackathons, setLoadingHackathons] = useState(true);
  const [selectedHackathon, setSelectedHackathon] =
    useState<HackathonWithTeams | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Tables<"teams"> | null>(
    null
  );
  const [newTeamName, setNewTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch hackathons with teams
  useEffect(() => {
    async function fetchHackathons() {
      setLoadingHackathons(true);
      const { data: hackData } = await supabase
        .from("hackathons")
        .select("*")
        .order("start_date", { ascending: true, nullsLast: true });

      if (!hackData) {
        setLoadingHackathons(false);
        return;
      }

      const { data: teamData } = await supabase
        .from("teams")
        .select("*");

      const teamsByHackathon = new Map<string, Tables<"teams">[]>();
      for (const t of teamData ?? []) {
        const arr = teamsByHackathon.get(t.hackathon_id) ?? [];
        arr.push(t);
        teamsByHackathon.set(t.hackathon_id, arr);
      }

      const enriched: HackathonWithTeams[] = (hackData as Tables<"hackathons">[]).map(
        (h) => {
          const teams = teamsByHackathon.get(h.id) ?? [];
          return { ...h, teams, teamCount: teams.length };
        }
      );

      setHackathons(enriched);
      setLoadingHackathons(false);
    }
    fetchHackathons();
  }, []);

  /* ── Role Selection ───────────────────────────────── */

  const handleRoleSelect = useCallback((role: "participant" | "organizer") => {
    setChosenRole(role);
    setError(null);
    setStep("hackathon");
  }, []);

  /* ── Hackathon Selection ──────────────────────────── */

  const handleHackathonSelect = useCallback(
    (hack: HackathonWithTeams) => {
      setSelectedHackathon(hack);
      setSelectedTeam(null);
      setNewTeamName("");
      setError(null);

      if (chosenRole === "organizer") {
        setStep("confirming");
      } else {
        setStep("team");
      }
    },
    [chosenRole]
  );

  /* ── Team Selection ───────────────────────────────── */

  const handleTeamSelect = useCallback((team: Tables<"teams">) => {
    setSelectedTeam(team);
    setNewTeamName("");
    setError(null);
  }, []);

  const handleCreateTeam = useCallback(async () => {
    if (!newTeamName.trim() || !selectedHackathon) return;
    setSubmitting(true);
    setError(null);

    const { data, error: createError } = await supabase
      .from("teams")
      .insert({
        hackathon_id: selectedHackathon.id,
        name: newTeamName.trim(),
        is_approved: false,
      })
      .select()
      .single();

    if (createError) {
      setError("Failed to create team. Please try again.");
      setSubmitting(false);
      return;
    }

    setSelectedTeam(data as Tables<"teams">);
    setNewTeamName("");
    setSubmitting(false);
  }, [newTeamName, selectedHackathon]);

  /* ── Submit Registration ──────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (!selectedHackathon) return;

    setSubmitting(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setError("Session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const userId = session.user.id;
    const email = session.user.email ?? "";

    try {
      if (chosenRole === "organizer") {
        // Create or update organizers record
        const { data: organizer, error: orgError } = await supabase
          .from("organizers")
          .upsert(
            { auth_user_id: userId, email },
            { onConflict: "auth_user_id" }
          )
          .select("id")
          .single();

        if (orgError) throw new Error(orgError.message);

        // Link organizer to hackathon
        const { error: linkError } = await supabase
          .from("organizer_hackathons")
          .insert({
            organizer_id: organizer.id,
            hackathon_id: selectedHackathon.id,
          });

        if (linkError) {
          // Ignore duplicate
          if (!linkError.message.includes("duplicate")) {
            throw new Error(linkError.message);
          }
        }

        setStep("done");
      } else {
        // Participant registration
        if (!selectedTeam) {
          setError("Please select or create a team.");
          setSubmitting(false);
          return;
        }

        const { error: participantError } = await supabase
          .from("participants")
          .upsert(
            {
              auth_user_id: userId,
              email,
              name: email.split("@")[0], // Use email prefix as name
              hackathon_id: selectedHackathon.id,
              team_id: selectedTeam.id,
            },
            { onConflict: "auth_user_id" }
          );

        if (participantError) throw new Error(participantError.message);

        setStep("done");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [selectedHackathon, selectedTeam, chosenRole]);

  /* ── After success, redirect ──────────────────────── */

  useEffect(() => {
    if (step === "done") {
      const timer = setTimeout(() => {
        if (chosenRole === "organizer") {
          navigate("/dashboard");
        } else {
          navigate("/wizard");
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, chosenRole, navigate]);

  /* ── Loading ──────────────────────────────────────── */

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  // Redirect unauthenticated users to sign-in
  if (auth.status === "unauthenticated") {
    navigate("/", { replace: true });
    return null;
  }

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <span className="text-accent font-heading text-2xl">LL</span>
          </div>
          <h1 className="font-heading text-3xl text-foreground tracking-wider uppercase">
            Join the Hackathon
          </h1>
          <p className="text-foreground/60 text-sm mt-2 font-sans">
            Register to participate or organize
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* ─── Step: Choose Role ───────────────────── */}
        {step === "role" && (
          <div className="space-y-4">
            <p className="text-foreground/60 text-sm text-center mb-6">
              How would you like to participate?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Participant card */}
              <button
                type="button"
                onClick={() => handleRoleSelect("participant")}
                className="bg-muted border border-border rounded-2xl p-6 text-left hover:border-accent/40 hover:bg-muted/80 transition-all duration-200 active:scale-[0.98] cursor-pointer group"
                aria-label="Register as participant"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors duration-200">
                  <Users className="w-6 h-6 text-accent" aria-hidden="true" />
                </div>
                <h3 className="font-heading text-base text-foreground tracking-wider uppercase mb-2">
                  Participant
                </h3>
                <p className="text-sm text-foreground/60 leading-relaxed">
                  Join a team, complete onboarding steps, and build your project
                  to win.
                </p>
              </button>

              {/* Organizer card */}
              <button
                type="button"
                onClick={() => handleRoleSelect("organizer")}
                className="bg-muted border border-border rounded-2xl p-6 text-left hover:border-accent/40 hover:bg-muted/80 transition-all duration-200 active:scale-[0.98] cursor-pointer group"
                aria-label="Register as organizer"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors duration-200">
                  <ShieldCheck
                    className="w-6 h-6 text-secondary"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="font-heading text-base text-foreground tracking-wider uppercase mb-2">
                  Organizer
                </h3>
                <p className="text-sm text-foreground/60 leading-relaxed">
                  Manage hackathons, import teams, approve participants, and
                  track progress.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Choose Hackathon ──────────────── */}
        {step === "hackathon" && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-accent" aria-hidden="true" />
              </div>
              <p className="text-foreground/70 text-sm">
                {chosenRole === "organizer"
                  ? "Select a hackathon to organize"
                  : "Select a hackathon to join"}
              </p>
            </div>

            {loadingHackathons ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : hackathons.length === 0 ? (
              <div className="bg-muted border border-border rounded-2xl p-10 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-foreground/30" aria-hidden="true" />
                <p className="text-foreground/80 font-medium">No hackathons available</p>
                <p className="text-foreground/40 text-sm mt-1">
                  {chosenRole === "organizer"
                    ? "Create one from your dashboard after registering."
                    : "Check back later for new hackathons."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {hackathons.map((hack, index) => (
                  <button
                    key={hack.id}
                    type="button"
                    onClick={() => handleHackathonSelect(hack)}
                    className="bg-muted border border-border rounded-2xl p-5 text-left hover:border-accent/40 hover:bg-muted/80 transition-all duration-200 active:scale-[0.98] cursor-pointer group text-start"
                    style={{
                      animationDelay: `${index * 60}ms`,
                    }}
                    aria-label={`Select ${hack.name}`}
                  >
                    {/* Hackathon name */}
                    <h3 className="font-heading text-sm text-foreground tracking-wider uppercase truncate mb-2">
                      {hack.name}
                    </h3>

                    {/* Status badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border mb-3 ${
                        hack.start_date &&
                        new Date(hack.start_date) > new Date()
                          ? "bg-secondary/10 border-secondary/30 text-secondary"
                          : hack.end_date &&
                              new Date(hack.end_date) < new Date()
                            ? "bg-foreground/5 border-foreground/20 text-foreground/50"
                            : "bg-accent/10 border-accent/30 text-accent"
                      }`}
                    >
                      {hack.start_date &&
                      new Date(hack.start_date) > new Date()
                        ? "Upcoming"
                        : hack.end_date &&
                            new Date(hack.end_date) < new Date()
                          ? "Ended"
                          : "Active"}
                    </span>

                    {/* Dates */}
                    <div className="flex items-center gap-1.5 text-xs text-foreground/40 mb-2">
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      <span>
                        {formatDate(hack.start_date)}
                        {hack.end_date ? ` — ${formatDate(hack.end_date)}` : ""}
                      </span>
                    </div>

                    {/* Teams count */}
                    <div className="flex items-center gap-1.5 text-xs text-foreground/40">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      <span>{hack.teamCount} team{hack.teamCount !== 1 ? "s" : ""}</span>
                    </div>

                    {/* Select indicator */}
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span>Select</span>
                      <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Step: Choose Team ───────────────────── */}
        {step === "team" && selectedHackathon && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="text-foreground/70 text-sm">
                  Join a team for{" "}
                  <span className="text-accent font-medium">
                    {selectedHackathon.name}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep("hackathon");
                    setSelectedHackathon(null);
                  }}
                  className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors duration-150 cursor-pointer"
                >
                  Choose different hackathon
                </button>
              </div>
            </div>

            {/* Existing teams */}
            {selectedHackathon.teams.length > 0 && (
              <div className="space-y-2 mb-6">
                <p className="text-xs text-foreground/50 uppercase tracking-wider mb-3">
                  Join an existing team
                </p>
                {selectedHackathon.teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => handleTeamSelect(team)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
                      selectedTeam?.id === team.id
                        ? "bg-accent/10 border-accent text-accent"
                        : "bg-muted border-border hover:border-accent/30 hover:bg-muted/80"
                    }`}
                    aria-label={`Join team ${team.name}`}
                    aria-pressed={selectedTeam?.id === team.id}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center">
                        <span className="font-heading text-xs text-foreground/60">
                          {team.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-foreground font-medium">
                        {team.name}
                      </span>
                    </div>
                    {selectedTeam?.id === team.id && (
                      <Check className="w-5 h-5 text-accent" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Create new team */}
            <div className="border-t border-border/40 pt-5">
              <p className="text-xs text-foreground/50 uppercase tracking-wider mb-3">
                Or create a new team
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => {
                    setNewTeamName(e.target.value);
                    if (selectedTeam) setSelectedTeam(null);
                  }}
                  placeholder="Your team name"
                  className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
                  aria-label="New team name"
                />
                <button
                  type="button"
                  onClick={handleCreateTeam}
                  disabled={submitting || !newTeamName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                  )}
                  Create
                </button>
              </div>
            </div>

            {/* Continue */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setStep("confirming")}
                disabled={!selectedTeam || submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                Continue with {selectedTeam?.name ?? "selected team"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Confirming / Submitting ────────── */}
        {step === "confirming" && selectedHackathon && (
          <div className="bg-muted border border-border rounded-2xl p-6">
            <h2 className="font-heading text-base text-foreground tracking-wider uppercase mb-4">
              Confirm Registration
            </h2>

            {/* Summary */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-xs text-foreground/50 uppercase tracking-wider">Role</span>
                <span className="text-sm text-foreground font-medium capitalize">
                  {chosenRole}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-xs text-foreground/50 uppercase tracking-wider">Hackathon</span>
                <span className="text-sm text-foreground font-medium">
                  {selectedHackathon.name}
                </span>
              </div>
              {chosenRole === "participant" && selectedTeam && (
                <div className="flex items-center justify-between py-2 border-b border-border/40">
                  <span className="text-xs text-foreground/50 uppercase tracking-wider">Team</span>
                  <span className="text-sm text-foreground font-medium">
                    {selectedTeam.name}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setStep(chosenRole === "organizer" ? "hackathon" : "team")
                }
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground/70 hover:bg-muted transition-all duration-150 disabled:opacity-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Registering…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Confirm & Register
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Done ──────────────────────────── */}
        {step === "done" && (
          <div className="bg-muted border border-border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-accent" aria-hidden="true" />
            </div>
            <h2 className="font-heading text-xl text-foreground tracking-wider uppercase mb-2">
              You&apos;re In!
            </h2>
            <p className="text-foreground/60 text-sm mb-2">
              {chosenRole === "organizer"
                ? `You are now an organizer for ${selectedHackathon?.name}.`
                : `You are now registered for ${selectedHackathon?.name}`}
            </p>
            <p className="text-foreground/40 text-xs">
              Redirecting to your{" "}
              {chosenRole === "organizer" ? "dashboard" : "onboarding page"}…
            </p>
            <div className="mt-4 flex justify-center">
              <Loader2 className="w-5 h-5 text-accent animate-spin" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}