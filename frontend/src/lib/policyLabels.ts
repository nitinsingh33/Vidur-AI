import type { Policy } from "../api/policies";
import { formatAmount } from "./status";

export type PolicyDecision = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export const POLICY_DECISION_LABEL: Record<PolicyDecision, string> = {
  ALLOW: "Automatic",
  REQUIRE_APPROVAL: "Requires approval",
  BLOCK: "Blocked",
};

export const POLICY_DECISIONS: PolicyDecision[] = [
  "ALLOW",
  "REQUIRE_APPROVAL",
  "BLOCK",
];

export const POLICY_DECISION_HELP: Record<PolicyDecision, string> = {
  ALLOW: "Vidur can execute this action itself, within the limits below.",
  REQUIRE_APPROVAL:
    "Vidur prepares this action, but a merchant must approve it first.",
  BLOCK: "Vidur will never perform this action.",
};

/**
 * A disabled policy behaves exactly like BLOCK to the recovery engine
 * (PolicyService.check only ever looks at rows with enabled: true — an
 * existing-but-disabled row is invisible to it, same as no row at all). The
 * overview should show one primary state, so a disabled policy is folded
 * into "Blocked" there; the real `enabled` flag stays a separate control
 * inside the Configure drawer since it's a genuinely distinct field a
 * merchant may want to toggle without losing their configured decision.
 */
export function getEffectiveDecision(policy: Policy): PolicyDecision {
  if (!policy.enabled) return "BLOCK";
  return policy.decision as PolicyDecision;
}

export function getEffectiveDecisionLabel(policy: Policy): string {
  return POLICY_DECISION_LABEL[getEffectiveDecision(policy)];
}

export type PolicyGroupId = "payments" | "outreach" | "control";

export const POLICY_GROUPS: { id: PolicyGroupId; label: string }[] = [
  { id: "payments", label: "Payment recovery" },
  { id: "outreach", label: "Customer outreach" },
  { id: "control", label: "Escalation & control" },
];

interface PolicyActionMeta {
  title: string;
  subtitle: string;
  group: PolicyGroupId;
  /** Which field this action type's "how many times" cap actually lives in. */
  countField: "maxRetries" | "maxContacts" | null;
  countNoun: string;
  countNounSingular: string;
}

const POLICY_ACTION_META: Record<string, PolicyActionMeta> = {
  RETRY_PAYMENT: {
    title: "Retry failed payments",
    subtitle:
      "Automatically retry a failed payment when recovery is appropriate.",
    group: "payments",
    countField: "maxRetries",
    countNoun: "attempts",
    countNounSingular: "attempt",
  },
  SEND_PAYMENT_LINK: {
    title: "Send payment links",
    subtitle: "Send a payment link when an automatic retry isn’t appropriate.",
    group: "payments",
    countField: "maxContacts",
    countNoun: "links",
    countNounSingular: "link",
  },
  UPDATE_PAYMENT_METHOD: {
    title: "Request updated payment details",
    subtitle: "Ask the customer to update their payment method.",
    group: "payments",
    countField: "maxContacts",
    countNoun: "requests",
    countNounSingular: "request",
  },
  SEND_EMAIL: {
    title: "Send recovery emails",
    subtitle: "Contact customers by email when a payment needs attention.",
    group: "outreach",
    countField: "maxContacts",
    countNoun: "emails",
    countNounSingular: "email",
  },
  SEND_WHATSAPP: {
    title: "Send WhatsApp reminders",
    subtitle: "Contact customers on WhatsApp when a payment needs attention.",
    group: "outreach",
    countField: "maxContacts",
    countNoun: "messages",
    countNounSingular: "message",
  },
  SEND_VOICE_MESSAGE: {
    title: "Send a voice message",
    subtitle:
      "Send one AI-generated voice message as a channel escalation, before handing the case to a human.",
    group: "outreach",
    countField: "maxRetries",
    countNoun: "messages",
    countNounSingular: "message",
  },
  FOLLOW_UP_RECEIVABLE: {
    title: "Follow up on overdue invoices",
    subtitle: "Send reminders on an overdue B2B invoice.",
    group: "outreach",
    countField: "maxContacts",
    countNoun: "follow-ups",
    countNounSingular: "follow-up",
  },
  ESCALATE_HUMAN: {
    title: "Escalate to a human",
    subtitle:
      "Hand the case to a merchant when Vidur can’t proceed on its own.",
    group: "control",
    countField: null,
    countNoun: "escalations",
    countNounSingular: "escalation",
  },
  STOP_RECOVERY: {
    title: "Stop recovery",
    subtitle: "Close out a case Vidur has determined isn’t recoverable.",
    group: "control",
    countField: null,
    countNoun: "stops",
    countNounSingular: "stop",
  },
};

const FALLBACK_META: PolicyActionMeta = {
  title: "",
  subtitle: "",
  group: "control",
  countField: "maxContacts",
  countNoun: "times",
  countNounSingular: "time",
};

export function getPolicyActionMeta(actionType: string): PolicyActionMeta {
  return POLICY_ACTION_META[actionType] ?? FALLBACK_META;
}

export function getPolicyTitle(policy: Policy): string {
  const meta = getPolicyActionMeta(policy.actionType);
  return meta.title || policy.name;
}

export function getPolicySubtitle(policy: Policy): string {
  const meta = getPolicyActionMeta(policy.actionType);
  return meta.subtitle || policy.description || "";
}

export function getPolicyGroup(policy: Policy): PolicyGroupId {
  return getPolicyActionMeta(policy.actionType).group;
}

export function formatMinutesDuration(minutes: number): string {
  if (minutes <= 0) return "0 minutes";
  // Prefer hours up to a full day (1440 → "24 hours", not "1 day") — only
  // switch to days once the span is long enough that hours would read
  // awkwardly large.
  if (minutes % 1440 === 0 && minutes >= 2880) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * The one-line overview summary — e.g. "Up to 3 attempts · 24 hours apart".
 * Deliberately only surfaces limits that are actually set; a policy with
 * nothing configured reads as "No limit configured" rather than a wall of
 * blank fields.
 */
export function summarizePolicyLimits(policy: Policy): string {
  const meta = getPolicyActionMeta(policy.actionType);
  const clauses: string[] = [];

  const countValue =
    meta.countField === "maxRetries"
      ? policy.maxRetries
      : meta.countField === "maxContacts"
        ? policy.maxContacts
        : null;

  if (countValue !== null && countValue !== undefined) {
    const noun = countValue === 1 ? meta.countNounSingular : meta.countNoun;
    clauses.push(`Up to ${countValue} ${noun}`);
  }

  if (policy.retryIntervalMinutes !== null) {
    clauses.push(`${formatMinutesDuration(policy.retryIntervalMinutes)} apart`);
  }

  if (policy.maxAmount !== null) {
    clauses.push(`Up to ${formatAmount(policy.maxAmount)} per action`);
  }

  if (clauses.length === 0) return "No limit configured";

  return clauses.join(" · ");
}
