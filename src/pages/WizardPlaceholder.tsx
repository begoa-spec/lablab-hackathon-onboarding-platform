import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentParticipant } from "../hooks/useAuth";
import { DISCORD_INVITE_URL } from "../lib/config";
import type { Tables } from "../lib/database.types";
import {
  Loader2,
  Check,
  ExternalLink,
  AlertCircle,
  User,
  Clock,
  MessageCircle,
  Flag,
  X,
  ShieldAlert,
} from "lucide-react";
import { SiDiscord, SiGithub } from "react-icons/si";

/* ── Types ─────────────────────────────────────────── */

type StepsCompleted = {
  amd: boolean;
  fireworks: boolean;
  natively_ai: boolean;
  lablab_discord: boolean;
  discord: boolean;
  github: boolean;
};

interface SupportLink {
  href: string;
  label: string;
  note: string;
}

interface StepDef {
  key: keyof StepsCompleted;
  label: string;
  description: string;
  href?: string;
  hrefLabel?: string;
  href2?: string;
  hrefLabel2?: string;
  support?: SupportLink;
}

type ReportTarget = {
  id: string;
  name: string;
  role: "teammate" | "mentor";
};

const STEPS: StepDef[] = [
  {
    key: "amd",
    label: "Sign up for AMD Cloud",
    description: "Create an AMD Cloud account to access accelerated compute for your hackathon project.",
    href: "https://amdcloud.amd.com/",
    hrefLabel: "Go to AMD Cloud →",
    support: {
      href: "https://cloudsupport.digitalocean.com/s/?teamId=001QP00001dnlA6YAI",
      label: "Open AMD Cloud support ticket →",
      note: "Credits not showing up in your account?",
    },
  },
  {
    key: "fireworks",
    label: "Claim your Fireworks promo code",
    description: "Visit AMD DevCloud, request a Fireworks promo code, and check your email. You'll use the promo code to claim your credits.",
    href: "https://devcloud.amd.com/",
    hrefLabel: "Go to AMD DevCloud →",
    support: {
      href: "https://fireworks.ai/contact",
      label: "Contact Fireworks.ai support →",
      note: "Promo code not received within 24 hours?",
    },
  },
  {
    key: "natively_ai",
    label: "Create a Natively AI account",
    description: "Sign up for a Natively AI account to deploy and manage your AI pipelines.",
    href: "https://natively.ai/",
    hrefLabel: "Go to Natively AI →",
    support: {
      href: "https://discord.com/invite/uP2TQVtkRj",
      label: "Get help on Natively AI Discord →",
      note: "Credits not auto-allocated to your account?",
    },
  },
  {
    key: "lablab_discord",
    label: "Join the lablab Discord for mentor support",
    description: "Join the lablab Discord server to connect with mentors, ask questions, and get support throughout the hackathon.",
    href: "https://discord.com/invite/lablabai",
    hrefLabel: "Join lablab Discord →",
  },
  {
    key: "discord",
    label: "Join the team Discord server",
    description: "Join the official hackathon Discord server to communicate with your team and get updates from the organizers.",
    href: DISCORD_INVITE_URL,
    hrefLabel: "Join Discord →",
  },
  {
    key: "github",
    label: "Set up your GitHub account",
    description: "Create a GitHub account (or sign in) so your team can collaborate on code and the organizer can add you to your team's repo.",
    href: "https://github.com/signup",
    hrefLabel: "Create GitHub account →",
    href2: "https://github.com/login",
    hrefLabel2: "Sign in to GitHub →",
  },
];

/* ── Helpers ────────────────────────────────────────── */

function getStepsCompleted(raw: unknown): StepsCompleted {
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
  return { amd: false, fireworks: false, natively_ai: false, lablab_discord: false, discord: false, github: false };
}

/* ── Step Detail Panel ─────────────────────────────── */

function StepDetail({
  step, index, isComplete, saving, onMark,
}: {
  step: StepDef;
  index: number;
  isComplete: boolean;
  saving: boolean;
  onMark: (key: keyof StepsCompleted) => void;
}) {
  return (
    <div className="bg-muted/60 border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${isComplete ? "bg-accent border-accent text-background" : "bg-background border-accent/50 text-accent"}`}>
          {isComplete ? <Check className="w-4 h-4" aria-hidden="true" /> : <span className="text-xs font-bold">{index + 1}</span>}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{step.label}</h3>
          {isComplete && (
            <span className="inline-flex items-center gap-1 text-xs text-accent mt-0.5">
              <Check className="w-3 h-3" /> Done
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground/60 leading-relaxed pl-11">{step.description}</p>
      {!isComplete && (
        <div className="pl-11 space-y-2">
          {step.href && (
            <a href={step.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150">
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />{step.hrefLabel}
            </a>
          )}
          {step.href2 && step.hrefLabel2 && (
            <a href={step.href2} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 block">
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />{step.hrefLabel2}
            </a>
          )}
          <button type="button" onClick={() => onMark(step.key)} disabled={saving} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-background text-sm font-semibold hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
            Mark as done
          </button>
          {step.support && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-xs text-foreground/40 mb-1.5">{step.support.note}</p>
              <a href={step.support.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground/80 transition-colors duration-150">
                <ExternalLink className="w-3 h-3" aria-hidden="true" />{step.support.label}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Report Modal ──────────────────────────────────── */

const REPORT_REASONS = [
  "Inappropriate language or harassment",
  "Hate speech or discrimination",
  "Threatening or violent behavior",
  "Spam or disruptive conduct",
  "Cheating or rule violation",
  "Other",
] as const;

function ReportModal({
  target, reporterId, hackathonId, teamId, onClose,
}: {
  target: ReportTarget;
  reporterId: string;
  hackathonId: string;
  teamId: string | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!reason) { setError("Please select a reason."); return; }
    setSubmitting(true);
    setError("");
    const { error: dbError } = await supabase.from("audit_logs").insert({
      hackathon_id: hackathonId,
      actor_id: reporterId,
      actor_role: "participant",
      action: "report_user",
      metadata: {
        reported_id: target.id,
        reported_name: target.name,
        reported_role: target.role,
        team_id: teamId,
        reason,
        notes: notes.trim() || null,
      },
    });
    setSubmitting(false);
    if (dbError) { setError("Failed to submit report. Please try again."); return; }
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-destructive" aria-hidden="true" />
            <h2 id="report-modal-title" className="text-sm font-semibold text-foreground">
              Report {target.role === "mentor" ? "Mentor" : "Teammate"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-all duration-150" aria-label="Close">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {submitted ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
                <Check className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">Report submitted</p>
              <p className="text-xs text-foreground/50 leading-relaxed">
                Your report has been sent to the organizers. Thank you for helping keep this hackathon safe and respectful.
              </p>
              <button type="button" onClick={onClose} className="mt-2 px-5 py-2 rounded-xl bg-muted border border-border text-sm text-foreground/70 hover:text-foreground transition-all duration-150">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 border border-border/60">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-foreground/40" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground leading-none">{target.name}</p>
                  <p className="text-xs text-foreground/40 mt-0.5 capitalize">{target.role}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-foreground/50 uppercase tracking-wider mb-2">
                  Reason <span className="text-destructive">*</span>
                </p>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label key={r} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 ${reason === r ? "bg-destructive/10 border-destructive/40 text-foreground" : "border-border hover:bg-muted/60 text-foreground/70"}`}>
                      <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => { setReason(r); setError(""); }} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${reason === r ? "border-destructive" : "border-border"}`}>
                        {reason === r && <div className="w-2 h-2 rounded-full bg-destructive" />}
                      </div>
                      <span className="text-sm leading-snug">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="report-notes" className="text-xs text-foreground/50 uppercase tracking-wider block mb-2">
                  Additional details <span className="text-foreground/30">(optional)</span>
                </label>
                <textarea id="report-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="Describe what happened…" className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 resize-none transition-all duration-150" />
                <p className="text-xs text-foreground/30 mt-1 text-right">{notes.length}/500</p>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{error}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground hover:bg-muted transition-all duration-150">
                  Cancel
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Flag className="w-4 h-4" aria-hidden="true" />}
                  Submit report
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Person Row ────────────────────────────────────── */

function PersonRow({
  name, subtitle, discordUsername, role, reportTarget, onReport,
}: {
  name: string;
  subtitle?: string;
  discordUsername?: string | null;
  role: "teammate" | "mentor";
  reportTarget: ReportTarget;
  onReport: (target: ReportTarget) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${role === "mentor" ? "bg-secondary/10 border-secondary/30" : "bg-background border-border"}`}>
        <User className={`w-4 h-4 ${role === "mentor" ? "text-secondary/70" : "text-foreground/40"}`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground/90 leading-none truncate">{name}</p>
        {subtitle && <p className="text-xs text-foreground/40 mt-0.5 truncate">{subtitle}</p>}
        {discordUsername && <p className="text-xs text-foreground/30 font-mono mt-0.5 truncate">@{discordUsername}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {discordUsername && (
          <a
            href="https://discord.com/channels/@me"
            target="_blank"
            rel="noopener noreferrer"
            title={`Message ${name} on Discord (@${discordUsername})`}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5865F2] hover:bg-[#5865F2]/10 transition-all duration-150"
            aria-label={`Open Discord to message ${name}`}
          >
            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onReport(reportTarget)}
          title={`Report ${name}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
          aria-label={`Report ${name}`}
        >
          <Flag className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ── Main Wizard ───────────────────────────────────── */

export default function WizardPlaceholder() {
  const { participant, loading: participantLoading } = useCurrentParticipant();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepsCompleted>({
    amd: false, fireworks: false, natively_ai: false,
    lablab_discord: false, discord: false, github: false,
  });
  const [team, setTeam] = useState<Tables<"teams"> | null>(null);
  const [teammates, setTeammates] = useState<Tables<"participants">[]>([]);
  const [hackathonName, setHackathonName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [infraCreating, setInfraCreating] = useState(false);
  const [infraResult, setInfraResult] = useState<{
    github_repo_url: string | null;
    discord_channel_id: string | null;
    discord_guild_id: string | null;
    github_error: string | null;
    discord_error: string | null;
    status: string;
  } | null>(null);

  const completedCount = STEPS.filter((s) => steps[s.key]).length;
  const allDone = completedCount === STEPS.length;

  useEffect(() => {
    if (!participant) return;
    const parsed = getStepsCompleted(participant.steps_completed);
    setSteps(parsed);
    const firstIncomplete = STEPS.findIndex((s) => !parsed[s.key]);
    setActiveStep(firstIncomplete === -1 ? null : firstIncomplete);
    if (participant.team_id) {
      supabase.from("teams").select("*").eq("id", participant.team_id).single()
        .then(({ data }) => { if (data) setTeam(data); });
    }
    if (participant.hackathon_id) {
      supabase.from("hackathons").select("name").eq("id", participant.hackathon_id).single()
        .then(({ data }) => { if (data) setHackathonName(data.name); });
    }
  }, [participant]);

  useEffect(() => {
    if (!participant?.team_id) return;
    supabase.from("participants").select("*")
      .eq("team_id", participant.team_id)
      .neq("id", participant.id)
      .then(({ data }) => { if (data) setTeammates(data); });
  }, [participant]);

  useEffect(() => {
    if (!allDone) return;
    const teamHasInfra = team?.is_approved || team?.github_repo_url || team?.discord_channel_id;
    if (infraResult || teamHasInfra) {
      const timer = setTimeout(() => navigate("/register"), 2500);
      return () => clearTimeout(timer);
    }
  }, [allDone, infraResult, team, navigate]);

  const markStep = useCallback(
    async (key: keyof StepsCompleted) => {
      if (!participant) return;
      setSaving(true);
      setSaveError("");
      const updated = { ...steps, [key]: true };
      const { error } = await supabase.from("participants")
        .update({ steps_completed: updated }).eq("id", participant.id);
      if (error) {
        setSaveError("Failed to save progress. Please try again.");
        setSaving(false);
        return;
      }
      await supabase.from("audit_logs").insert({
        hackathon_id: participant.hackathon_id,
        actor_id: participant.id,
        actor_role: "participant",
        action: "step_completed",
        metadata: { step: key },
      });
      setSteps(updated);
      setSaving(false);
      const nowAllDone = STEPS.every((s) => updated[s.key]);
      if (nowAllDone && participant.team_id) {
        setInfraCreating(true);
        const { data: infraResp, error: infraErr } = await supabase.functions.invoke(
          "create-team-infrastructure",
          { body: { team_id: participant.team_id } }
        );
        setInfraCreating(false);
        if (infraErr || !infraResp) {
          setInfraResult({
            github_repo_url: null, discord_channel_id: null, discord_guild_id: null,
            github_error: infraErr?.message ?? "Could not reach infrastructure service",
            discord_error: infraErr?.message ?? "Could not reach infrastructure service",
            status: "error",
          });
        } else {
          setInfraResult(infraResp as typeof infraResult);
        }
        const { data: updatedTeam } = await supabase.from("teams").select("*")
          .eq("id", participant.team_id).single();
        if (updatedTeam) setTeam(updatedTeam);
      } else {
        const nextIdx = STEPS.findIndex((s) => !updated[s.key]);
        setActiveStep(nextIdx === -1 ? null : nextIdx);
      }
    },
    [participant, steps, infraResult]
  );

  if (participantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Loading">
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <h1 className="font-heading text-xl text-foreground tracking-wider uppercase">No Hackathon Found</h1>
        <p className="text-foreground/60 mt-3 max-w-md mx-auto">
          Your email isn&apos;t registered in any active hackathon. Contact your organizer to get set up.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-heading text-xl text-foreground tracking-wider uppercase">
          {hackathonName || "Hackathon Setup"}
        </h1>
        <p className="text-foreground/50 text-sm mt-1">
          Welcome, {participant.name} — complete each step below to get your team ready.
        </p>
      </div>

      {/* All done banner */}
      {allDone && (
        <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-2xl px-5 py-4 mb-6 text-sm text-accent">
          <Clock className="w-4 h-4 shrink-0 animate-pulse" aria-hidden="true" />
          <span>All steps complete! Setting up your team infrastructure and redirecting you to the home page…</span>
        </div>
      )}

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-6 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{saveError}
        </div>
      )}

      {/* Infra creating banner */}
      {infraCreating && (
        <div className="flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 mb-6 text-sm text-accent">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
          Setting up your team&apos;s GitHub repo and Discord channel…
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

        {/* ── Left ── */}
        <div className="space-y-4">
          {activeStep !== null && !allDone ? (
            <StepDetail
              step={STEPS[activeStep]}
              index={activeStep}
              isComplete={steps[STEPS[activeStep].key]}
              saving={saving}
              onMark={markStep}
            />
          ) : allDone ? (
            <div className="bg-muted/60 border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-heading text-sm tracking-wider text-accent uppercase">Team Infrastructure</h2>
              {(team?.github_repo_url || infraResult?.github_repo_url) ? (
                <a href={team?.github_repo_url ?? infraResult?.github_repo_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150">
                  <SiGithub className="w-4 h-4" aria-hidden="true" />View team GitHub repo<ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              ) : infraResult?.github_error ? (
                <p className="text-sm text-foreground/50">GitHub repo: {infraResult.github_error}</p>
              ) : null}
              {(team?.discord_channel_id || infraResult?.discord_channel_id) ? (
                <a href={`https://discord.com/channels/${infraResult?.discord_guild_id ?? "@me"}/${infraResult?.discord_channel_id ?? team?.discord_channel_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#5865F2] hover:text-[#4752C4] transition-colors duration-150">
                  <SiDiscord className="w-4 h-4" aria-hidden="true" />Open team Discord channel<ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              ) : infraResult?.discord_error ? (
                <p className="text-sm text-foreground/50">Discord channel: {infraResult.discord_error}</p>
              ) : null}
              {infraResult?.status === "incomplete" && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/5 border border-secondary/10 text-secondary text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Waiting for all teammates to complete their steps before creating your team infrastructure.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-muted/40 border border-border/40 rounded-2xl p-8 text-center text-foreground/40 text-sm">
              Select a step from the checklist to get started.
            </div>
          )}

          {/* Team card */}
          <div className="bg-muted/60 border border-border rounded-2xl p-5">
            <h2 className="font-heading text-xs tracking-wider text-accent uppercase mb-1">Your Team</h2>
            <p className="text-base font-semibold text-foreground">{team?.name ?? participant.name}</p>
            <p className="text-foreground/40 text-xs font-mono mt-0.5">{participant.email}</p>

            {/* Mentor */}
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-xs text-foreground/40 uppercase tracking-wider mb-2">Assigned Mentor</p>
              {team?.mentor_name ? (
                <PersonRow
                  name={team.mentor_name}
                  subtitle="Mentor"
                  discordUsername={team.mentor_discord_username}
                  role="mentor"
                  reportTarget={{ id: "mentor", name: team.mentor_name, role: "mentor" }}
                  onReport={setReportTarget}
                />
              ) : (
                <div className="flex items-center gap-2.5 py-2 text-foreground/30">
                  <div className="w-8 h-8 rounded-full border border-dashed border-border/60 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <p className="text-xs italic">No mentor assigned yet — check back soon.</p>
                </div>
              )}
            </div>

            {/* Teammates */}
            {teammates.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/40">
                <p className="text-xs text-foreground/40 uppercase tracking-wider mb-2">Teammates</p>
                <div className="divide-y divide-border/30">
                  {teammates.map((t) => (
                    <PersonRow
                      key={t.id}
                      name={t.name}
                      subtitle={t.email}
                      discordUsername={t.discord_username}
                      role="teammate"
                      reportTarget={{ id: t.id, name: t.name, role: "teammate" }}
                      onReport={setReportTarget}
                    />
                  ))}
                </div>
              </div>
            )}

            {team?.github_repo_url && (
              <a href={team.github_repo_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors duration-150">
                <SiGithub className="w-3.5 h-3.5" aria-hidden="true" />Team repo<ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {/* ── Right: Checklist panel ── */}
        <div className="bg-muted/60 border border-border rounded-2xl p-5 lg:sticky lg:top-6">
          <h2 className="text-sm font-semibold text-foreground mb-1">Team Progress Checklist</h2>
          <p className="text-xs text-foreground/50 mb-5 leading-relaxed">
            Follow each step to keep your team on track and ready for submission.
          </p>

          {/* Progress bar */}
          <div className="w-full bg-border rounded-full h-1 mb-5 overflow-hidden">
            <div
              className="h-1 rounded-full bg-accent transition-all duration-500"
              style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-label={`${completedCount} of ${STEPS.length} steps complete`}
            />
          </div>

          {/* Checklist items */}
          <ol className="space-y-1" aria-label="Setup checklist">
            {STEPS.map((step, i) => {
              const isComplete = steps[step.key];
              const isActive = activeStep === i;
              return (
                <li key={step.key}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(isActive ? null : i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                      isActive
                        ? "bg-accent/10 border border-accent/20"
                        : "border border-transparent hover:bg-background/60"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all duration-200 ${
                        isComplete
                          ? "bg-accent text-background"
                          : isActive
                            ? "border-2 border-accent text-accent bg-background"
                            : "border-2 border-border/60 text-foreground/40 bg-background"
                      }`}
                      aria-hidden="true"
                    >
                      {isComplete ? <Check className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                    </div>
                    <span
                      className={`text-sm flex-1 leading-snug transition-colors duration-150 ${
                        isComplete
                          ? "text-foreground/50 line-through"
                          : isActive
                            ? "text-foreground font-medium"
                            : "text-foreground/70 group-hover:text-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-foreground/40">
            <span>{completedCount} of {STEPS.length} complete</span>
            {allDone && (
              <span className="text-accent font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />All done!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {reportTarget && participant && (
        <ReportModal
          target={reportTarget}
          reporterId={participant.id}
          hackathonId={participant.hackathon_id}
          teamId={participant.team_id}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
