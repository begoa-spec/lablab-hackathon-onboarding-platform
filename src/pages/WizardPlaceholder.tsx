import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useCurrentParticipant } from "../hooks/useAuth";
import { DISCORD_INVITE_URL } from "../lib/config";
import type { Tables } from "../lib/database.types";
import {
  Loader2,
  Check,
  ExternalLink,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Mail,
  User,
} from "lucide-react";
import { SiDiscord, SiGithub } from "react-icons/si";

/* ── Types ─────────────────────────────────────────── */

type StepsCompleted = {
  amd: boolean;
  fireworks: boolean;
  natively_ai: boolean;
  discord: boolean;
  github: boolean;
};

interface StepDef {
  key: keyof StepsCompleted;
  label: string;
  description: string;
  href?: string;
  hrefLabel?: string;
  href2?: string;
  hrefLabel2?: string;
}

const STEPS: StepDef[] = [
  {
    key: "amd",
    label: "AMD Cloud Account",
    description:
      "Create an AMD Cloud account to access accelerated compute for your hackathon project.",
    href: "https://amdcloud.amd.com/",
    hrefLabel: "Sign up for AMD Cloud",
  },
  {
    key: "fireworks",
    label: "Fireworks Promo Code",
    description:
      "Visit AMD DevCloud, request a Fireworks promo code, and check your email. You'll use the promo code later to claim your credits.",
    href: "https://devcloud.amd.com/",
    hrefLabel: "Go to AMD DevCloud",
  },
  {
    key: "natively_ai",
    label: "Natively AI Account",
    description:
      "Sign up for a Natively AI account to deploy and manage your AI pipelines.",
    href: "https://natively.ai/",
    hrefLabel: "Create Natively AI account",
  },
  {
    key: "discord",
    label: "Join Discord",
    description:
      "Join the official hackathon Discord server to communicate with your team and get updates from the organizers.",
    href: DISCORD_INVITE_URL,
    hrefLabel: "Join Discord Server",
  },
  {
    key: "github",
    label: "Join GitHub",
    description:
      "Create a GitHub account (or sign in) so your team can collaborate on code and the organizer can add you to your team's repo.",
    href: "https://github.com/signup",
    hrefLabel: "Create GitHub Account",
    href2: "https://github.com/login",
    hrefLabel2: "Sign in to GitHub",
  },
];

/* ── Helpers ────────────────────────────────────────── */

function getStepsCompleted(
  raw: unknown
): StepsCompleted {
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
}

/* ── Step Card ─────────────────────────────────────── */

function StepCard({
  step,
  index,
  isComplete,
  isActive,
  children,
  onToggle,
}: {
  step: StepDef;
  index: number;
  isComplete: boolean;
  isActive: boolean;
  children: React.ReactNode;
  onToggle: () => void;
}) {
  const isLocked = !isComplete && !isActive;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        isActive
          ? "border-accent/40 bg-muted/80 shadow-[0_0_20px_rgba(34,197,94,0.06)]"
          : isComplete
            ? "border-border bg-muted/40"
            : "border-border/60 bg-muted/20 opacity-50"
      }`}
    >
      {/* Header (always clickable) */}
      <button
        type="button"
        onClick={isLocked ? undefined : onToggle}
        disabled={isLocked}
        className="w-full flex items-center gap-4 p-5 text-left cursor-pointer transition-colors duration-150"
      >
        {/* Status icon */}
        <div
          className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
            isComplete
              ? "bg-accent/15 border-accent text-accent"
              : isActive
                ? "bg-background border-accent/50 text-accent"
                : "bg-background border-border text-foreground/40"
          }`}
        >
          {isComplete ? (
            <Check className="w-5 h-5" aria-hidden="true" />
          ) : isActive ? (
            <span className="font-heading text-sm">{index + 1}</span>
          ) : (
            <span className="font-heading text-sm">{index + 1}</span>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium transition-colors duration-200 ${
              isComplete
                ? "text-accent"
                : isActive
                  ? "text-foreground"
                  : "text-foreground/50"
            }`}
          >
            {step.label}
            {!isActive && isComplete && (
              <span className="ml-2 text-xs text-accent/70 font-normal">
                Complete
              </span>
            )}
          </h3>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`w-4 h-4 text-foreground/40 transition-transform duration-200 ${
            isActive ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isActive ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 pt-0 border-t border-border/40">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Main Wizard ───────────────────────────────────── */

export default function WizardPlaceholder() {
  const { participant, loading: participantLoading } = useCurrentParticipant();
  const [steps, setSteps] = useState<StepsCompleted>({
    amd: false,
    fireworks: false,
    natively_ai: false,
    discord: false,
    github: false,
  });
  const [githubUsername, setGithubUsername] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [team, setTeam] = useState<Tables<"teams"> | null>(null);
  const [teammates, setTeammates] = useState<Tables<"participants">[]>([]);
  const [hackathonName, setHackathonName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [completedMessage, setCompletedMessage] = useState(false);
  const [infraCreating, setInfraCreating] = useState(false);
  const [infraResult, setInfraResult] = useState<{
    github_repo_url: string | null;
    discord_channel_id: string | null;
    discord_guild_id: string | null;
    github_error: string | null;
    discord_error: string | null;
    status: string;
  } | null>(null);

  // Determine which step is active (first incomplete step)
  const firstIncomplete = STEPS.findIndex((s) => !steps[s.key]);
  const currentStepIndex =
    firstIncomplete === -1 ? STEPS.length : firstIncomplete;

  const allFiveDone =
    steps.amd && steps.fireworks && steps.natively_ai && steps.discord && steps.github;
  const githubDiscordDone = githubUsername.trim().length > 0 && discordUsername.trim().length > 0;

  // Load participant data
  useEffect(() => {
    if (!participant) return;

    const raw = participant.steps_completed;
    const parsed = getStepsCompleted(raw);
    setSteps(parsed);

    if (participant.github_username) setGithubUsername(participant.github_username);
    if (participant.discord_username) setDiscordUsername(participant.discord_username);

    // Fetch team + hackathon
    if (participant.team_id) {
      supabase
        .from("teams")
        .select("*")
        .eq("id", participant.team_id)
        .single()
        .then(({ data }) => {
          if (data) setTeam(data);
        });
    }

    if (participant.hackathon_id) {
      supabase
        .from("hackathons")
        .select("name")
        .eq("id", participant.hackathon_id)
        .single()
        .then(({ data }) => {
          if (data) setHackathonName(data.name);
        });
    }
  }, [participant]);

  // Fetch teammates
  useEffect(() => {
    if (!participant?.team_id) return;
    supabase
      .from("participants")
      .select("*")
      .eq("team_id", participant.team_id)
      .neq("id", participant.id)
      .then(({ data }) => {
        if (data) setTeammates(data);
      });
  }, [participant]);

  // Show completed message after all steps done AND infrastructure attempted
  useEffect(() => {
    if (!allFiveDone || !githubDiscordDone) return;
    // Either we have an infra result from a fresh attempt, or the team
    // already has infrastructure from a previous session.
    const teamHasInfra = team?.is_approved || team?.github_repo_url || team?.discord_channel_id;
    if (infraResult || teamHasInfra) {
      setCompletedMessage(true);
    }
  }, [allFiveDone, githubDiscordDone, infraResult, team]);

  /* ── Actions ──────────────────────────────────────── */

  const markStep = useCallback(
    async (key: keyof StepsCompleted) => {
      if (!participant) return;
      setSaving(true);
      setSaveError("");

      const updated = { ...steps, [key]: true };

      const { error } = await supabase
        .from("participants")
        .update({ steps_completed: updated })
        .eq("id", participant.id);

      if (error) {
        setSaveError("Failed to save progress. Please try again.");
        setSaving(false);
        return;
      }

      // Log to audit
      await supabase.from("audit_logs").insert({
        hackathon_id: participant.hackathon_id,
        actor_id: participant.id,
        actor_role: "participant",
        action: "step_completed",
        metadata: { step: key },
      });

      setSteps(updated);
      setSaving(false);

      // Auto-advance to next step
      const nextIdx = STEPS.findIndex((s) => !updated[s.key]);
      setExpandedStep(nextIdx === -1 ? null : nextIdx);
    },
    [participant, steps]
  );

  const saveGitHubDiscord = useCallback(async () => {
    if (!participant) return;
    setSaving(true);
    setSaveError("");

    const { error } = await supabase
      .from("participants")
      .update({
        github_username: githubUsername.trim(),
        discord_username: discordUsername.trim(),
      })
      .eq("id", participant.id);

    if (error) {
      setSaveError("Failed to save usernames. Try again.");
      setSaving(false);
      return;
    }

    // Also log
    await supabase.from("audit_logs").insert({
      hackathon_id: participant.hackathon_id,
      actor_id: participant.id,
      actor_role: "participant",
      action: "step_completed",
      metadata: { step: "github_discord" },
    });

    setSaving(false);

    // Trigger infrastructure creation for the team
    if (participant.team_id) {
      setInfraCreating(true);
      const { data: infraResp, error: infraErr } = await supabase.functions.invoke(
        "create-team-infrastructure",
        { body: { team_id: participant.team_id } }
      );
      setInfraCreating(false);

      if (infraErr || !infraResp) {
        // Real error (network, function crash, etc.)
        setInfraResult({
          github_repo_url: null,
          discord_channel_id: null,
          discord_guild_id: null,
          github_error: infraErr?.message ?? "Could not reach infrastructure service",
          discord_error: infraErr?.message ?? "Could not reach infrastructure service",
          status: "error",
        });
      } else {
        // All business responses now come as data (status 200)
        setInfraResult(infraResp as typeof infraResult);
      }

      // Refresh team data to get updated repo/channel info
      if (participant.team_id) {
        const { data: updatedTeam } = await supabase
          .from("teams")
          .select("*")
          .eq("id", participant.team_id)
          .single();
        if (updatedTeam) setTeam(updatedTeam);
      }
    }
  }, [participant, githubUsername, discordUsername]);

  /* ── Loading ──────────────────────────────────────── */

  if (participantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Loading wizard">
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <h1 className="font-heading text-xl text-foreground tracking-wider uppercase">
          No Hackathon Found
        </h1>
        <p className="text-foreground/60 mt-3 max-w-md mx-auto">
          Your email isn&apos;t registered in any active hackathon. Contact
          your organizer to get set up.
        </p>
      </div>
    );
  }

  /* ── All done state ─────────────────────────────── */

  if (completedMessage) {
    const teamHasRepo = team?.github_repo_url || infraResult?.github_repo_url;
    const teamHasChannel = team?.discord_channel_id || infraResult?.discord_channel_id;
    const infraSuccess =
      infraResult?.status === "complete" ||
      infraResult?.status === "partial" ||
      Boolean(teamHasRepo) ||
      Boolean(teamHasChannel);
    const waitingForTeammates = infraResult?.status === "incomplete";

    return (
      <div className="max-w-2xl mx-auto">
        {/* Welcome */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/15 border border-accent/30 mb-4">
            <Sparkles className="w-8 h-8 text-accent" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl text-foreground tracking-wider uppercase">
            {infraSuccess ? "You're All Set!" : "Onboarding Complete!"}
          </h1>
          <p className="text-foreground/60 mt-2 max-w-md mx-auto">
            {waitingForTeammates
              ? "Your steps are done! Waiting for your teammates to finish before we create your team infrastructure."
              : infraSuccess
                ? "Your team's repo and Discord channel are ready."
                : "All onboarding steps are complete. Infrastructure could not be created — check back later."}
          </p>
        </div>

        {/* Team card */}
        <div className="bg-muted border border-border rounded-2xl p-6 mb-8">
          <h2 className="font-heading text-xs tracking-wider text-accent uppercase mb-3">
            Your Team
          </h2>
          <p className="text-lg font-medium">{team?.name ?? participant.name}</p>
          <p className="text-foreground/40 text-sm font-mono mt-1">
            {participant.email}
          </p>

          {teammates.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
              <p className="text-xs text-foreground/40 uppercase tracking-wider">
                Teammates
              </p>
              {teammates.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center">
                    <User className="w-4 h-4 text-foreground/40" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground/80">{t.name}</p>
                    <p className="text-xs text-foreground/40 font-mono">
                      {t.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Repo link */}
          {teamHasRepo && (
            <a
              href={teamHasRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
            >
              <SiGithub className="w-4 h-4" aria-hidden="true" />
              View your team repo
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}

          {infraResult?.github_error && !teamHasRepo && (
            <p className="mt-4 text-sm text-foreground/50">
              GitHub repo not created: {infraResult.github_error}
            </p>
          )}

          {/* Discord channel */}
          {teamHasChannel && (
            <div className="mt-3">
              <a
                href={`https://discord.com/channels/${infraResult?.discord_guild_id ?? "@me"}/${infraResult?.discord_channel_id ?? team.discord_channel_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[#5865F2] hover:text-[#4752C4] transition-colors duration-150 cursor-pointer"
              >
                <SiDiscord className="w-4 h-4" aria-hidden="true" />
                Open Discord Channel
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          )}

          {infraResult?.discord_error && !teamHasChannel && (
            <p className="mt-4 text-sm text-foreground/50">
              Discord channel not created: {infraResult.discord_error}
            </p>
          )}

          {/* Waiting for teammates */}
          {waitingForTeammates && (
            <div className="mt-4 p-4 rounded-xl bg-secondary/5 border border-secondary/10">
              <div className="flex items-center gap-2 text-secondary text-sm">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                <span>Waiting for all teammates to complete their steps before creating the team infrastructure.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Main Wizard ─────────────────────────────────── */

  return (
    <div className="max-w-2xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl text-foreground tracking-wider uppercase">
          Welcome, {participant.name}
        </h1>
        <p className="text-foreground/60 mt-1">
          {hackathonName && (
            <span className="text-accent">{hackathonName}</span>
          )}{" "}
          — Complete each step below to set up your accounts.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const done = steps[s.key];
          const isCurrent = i === currentStepIndex;
          return (
            <div key={s.key} className="flex-1 flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  done
                    ? "bg-accent shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                    : isCurrent
                      ? "bg-accent/60"
                      : "bg-muted border border-border"
                }`}
                aria-label={
                  done
                    ? `${s.label} complete`
                    : isCurrent
                      ? `Current step: ${s.label}`
                      : s.label
                }
              />
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px transition-colors duration-300 ${
                    done ? "bg-accent/40" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Team card */}
      <div className="bg-muted border border-border rounded-2xl p-5 mb-8">
        <h2 className="font-heading text-xs tracking-wider text-accent uppercase mb-2">
          Your Team
        </h2>
        <p className="text-lg font-medium">{team?.name ?? participant.name}</p>
        <p className="text-foreground/40 text-sm font-mono">{participant.email}</p>
        {teammates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {teammates.map((t) => (
              <span
                key={t.id}
                className="text-xs bg-background border border-border/60 rounded-full px-3 py-1 text-foreground/60"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
        {team?.github_repo_url && (
          <a
            href={team.github_repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
          >
            <SiGithub className="w-3.5 h-3.5" aria-hidden="true" />
            Team repo
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-6 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {saveError}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isComplete = steps[step.key];
          const isActive =
            expandedStep === i || (!isComplete && expandedStep === null && currentStepIndex === i);

          return (
            <StepCard
              key={step.key}
              step={step}
              index={i}
              isComplete={isComplete}
              isActive={isActive}
              onToggle={() =>
                setExpandedStep(expandedStep === i ? null : i)
              }
            >
              <div className="space-y-4 mt-3">
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {step.description}
                </p>

                {/* Step 1: AMD */}
                {step.key === "amd" && !isComplete && (
                  <div className="space-y-3">
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      {step.hrefLabel}
                    </a>
                    <button
                      type="button"
                      onClick={() => markStep("amd")}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      I&apos;ve signed up — Mark Complete
                    </button>
                  </div>
                )}

                {/* Step 2: Fireworks */}
                {step.key === "fireworks" && !isComplete && (
                  <div className="space-y-3">
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      {step.hrefLabel}
                    </a>
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/5 border border-secondary/10">
                      <Mail className="w-4 h-4 text-secondary shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-xs text-foreground/60 leading-relaxed">
                        After requesting your promo code on AMD DevCloud, check
                        your email inbox. You don&apos;t need to paste anything
                        here — just confirm you received the email.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => markStep("fireworks")}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      I got the promo code — Mark Complete
                    </button>
                  </div>
                )}

                {/* Step 3: Natively AI */}
                {step.key === "natively_ai" && !isComplete && (
                  <div className="space-y-3">
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      {step.hrefLabel}
                    </a>
                    <button
                      type="button"
                      onClick={() => markStep("natively_ai")}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      I&apos;ve signed up — Mark Complete
                    </button>
                  </div>
                )}

                {/* Step 4: Discord */}
                {step.key === "discord" && !isComplete && (
                  <div className="space-y-3">
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      {step.hrefLabel}
                    </a>
                    <button
                      type="button"
                      onClick={() => markStep("discord")}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      I&apos;ve joined — Mark Complete
                    </button>
                  </div>
                )}

                {/* Step 5: GitHub */}
                {step.key === "github" && !isComplete && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={step.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        {step.hrefLabel}
                      </a>
                      {step.href2 && step.hrefLabel2 && (
                        <a
                          href={step.href2}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          {step.hrefLabel2}
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => markStep("github")}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      I have a GitHub account — Mark Complete
                    </button>
                  </div>
                )}

                {/* Completed state for any step */}
                {isComplete && (
                  <div className="flex items-center gap-2 text-accent text-sm">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </StepCard>
          );
        })}

        {/* Usernames — only after all 5 steps completed */}
        <div
          className={`rounded-2xl border transition-all duration-200 ${
            allFiveDone ? "border-accent/40 bg-muted/80" : "border-border/60 bg-muted/20 opacity-50"
          }`}
        >
          <div className="flex items-center gap-4 p-5">
            <div
              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 ${
                githubDiscordDone
                  ? "bg-accent/15 border-accent text-accent"
                  : allFiveDone
                    ? "bg-background border-accent/50 text-accent"
                    : "bg-background border-border text-foreground/40"
              }`}
            >
              {githubDiscordDone ? (
                <Check className="w-5 h-5" aria-hidden="true" />
              ) : (
                <span className="font-heading text-sm">6</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`font-medium ${
                  githubDiscordDone
                    ? "text-accent"
                    : allFiveDone
                      ? "text-foreground"
                      : "text-foreground/50"
                }`}
              >
                Share Your Usernames
                {githubDiscordDone && (
                  <span className="ml-2 text-xs text-accent/70 font-normal">
                    Complete
                  </span>
                )}
              </h3>
            </div>
          </div>

          {allFiveDone && !githubDiscordDone && (
            <div className="px-5 pb-5 pt-0 border-t border-border/40">
              <div className="mt-3 space-y-3">
                <p className="text-sm text-foreground/70 leading-relaxed">
                  Share your GitHub and Discord usernames so we can add you to
                  your team&apos;s repo and communication channel.
                </p>

                {/* GitHub username */}
                <div>
                  <label
                    htmlFor="github-username"
                    className="text-xs text-foreground/50 uppercase tracking-wider block mb-1.5"
                  >
                    GitHub Username
                  </label>
                  <div className="relative">
                    <SiGithub
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"
                      aria-hidden="true"
                    />
                    <input
                      id="github-username"
                      type="text"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      placeholder="your-github-handle"
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
                    />
                  </div>
                </div>

                {/* Discord username */}
                <div>
                  <label
                    htmlFor="discord-username"
                    className="text-xs text-foreground/50 uppercase tracking-wider block mb-1.5"
                  >
                    Discord Username
                  </label>
                  <div className="relative">
                    <SiDiscord
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"
                      aria-hidden="true"
                    />
                    <input
                      id="discord-username"
                      type="text"
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                      placeholder="your_discord_handle"
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveGitHubDiscord}
                  disabled={
                    saving ||
                    !githubUsername.trim() ||
                    !discordUsername.trim()
                  }
                  className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  )}
                  Save & Finish
                </button>
              </div>
            </div>
          )}

          {githubDiscordDone && (
            <div className="px-5 pb-5 pt-0 border-t border-border/40">
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2 text-accent text-sm">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Usernames saved</span>
                </div>
                {githubUsername && (
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <SiGithub className="w-4 h-4 text-foreground/40" aria-hidden="true" />
                    <span className="font-mono">{githubUsername}</span>
                  </div>
                )}
                {discordUsername && (
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <MessageSquare className="w-4 h-4 text-foreground/40" aria-hidden="true" />
                    <span className="font-mono">{discordUsername}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!allFiveDone && (
            <div className="px-5 pb-5 pt-0 border-t border-border/40">
              <p className="text-sm text-foreground/40 mt-3">
                Complete steps 1–5 above first, then enter your GitHub and Discord
                usernames here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}