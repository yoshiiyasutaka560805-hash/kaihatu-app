---
name: connector-health-check
description: Verify whether a connected app or MCP connector (Microsoft 365, Gmail, Google Calendar/Drive, Asana, etc.) is actually working end-to-end, not just "connected" in name. Use whenever the user asks something like "つながってますか？", "is X connected?", "why can't I see my email/calendar/tasks", or when a tool call against a connector fails and the user wants to know why. Also use proactively before relying on a connector for a multi-step task if its working status is in doubt. Don't use this for a one-off tool error the user isn't asking to diagnose — only when they want the connection itself checked.
---

# Connector Health Check

"Connected" in a connector list is a necessary condition, not a sufficient
one. A connector can show `connected: true` while a specific capability
(mail, but not calendar; write, but not read) is actually broken for
account-configuration reasons that have nothing to do with the MCP wiring.
Treat "are we connected?" as a question to actually test, not a status
flag to read off.

## Step 1 — Check the connector registry

Call `ListConnectors` (filtered by keyword if the user named a specific
app). Read three fields per connector:
- `connected` — org-level auth status (may be `null` = unknown, not
  necessarily disconnected)
- `enabledInChat` — whether its tools are loaded in *this* chat. A
  connector can be `connected: true` but `enabledInChat: false` — that's
  not a broken connector, it's one the user needs to toggle on for this
  conversation.

If `enabledInChat` is false, tell the user to enable it in the chat's
connector settings — don't proceed to diagnose a deeper problem that isn't
there.

## Step 2 — Actually call something, don't stop at the flag

A `connected: true` flag means auth succeeded at some point; it doesn't
mean the service works right now. Make one cheap, safe read call — the
kind of thing that can't have side effects — and see what comes back:

- Identity/profile call (`get_me`-style) — confirms auth token and basic
  API reachability
- If the user's complaint is about a specific capability (mail, calendar,
  tasks), test *that specific capability* too, not just identity. Identity
  succeeding while the actual capability the user asked about fails is
  the most informative signal you'll get — it tells you the break is
  scoped, not systemic.

## Step 3 — Isolate scope: whole connector, or one capability?

If the identity call works but a specific capability fails, test one more
adjacent capability from the same service (e.g. if mail search fails,
try calendar search) before concluding anything. This tells you whether:

- **Everything in that service is broken** → likely an auth/token/consent
  problem — retriable, or needs re-authentication.
- **Only one capability is broken while a sibling capability works** →
  this points at account-level provisioning specific to that capability
  (a missing license, a disabled feature, a mailbox not yet provisioned),
  not a connector wiring problem. Don't suggest re-authenticating or
  reinstalling the connector for this case — it won't help, and it wastes
  the user's time chasing the wrong fix.

## Step 4 — Read the actual error, don't guess

Tool errors from these connectors usually carry a specific code
(`graphErrorCode`, an HTTP status, a named exception) — use it, don't
pattern-match on the message text alone. For example
`MailboxNotEnabledForRESTAPI` specifically means the mailbox has no
Exchange Online service behind it (commonly: no license, or a license that
covers the desktop apps but not the cloud mailbox) — that's a licensing
fact, not a permissions bug in the integration. Quote the real error code
back to the user when explaining the cause; it's what lets them (or their
admin) verify your diagnosis independently instead of taking your word for
it.

## Step 5 — Be honest about what you can and can't fix

Some root causes are fixable by retrying or re-authenticating; some are
account/tenant configuration that only an admin can change (license
assignment, mailbox provisioning, org policy). When it's the latter:

- Say plainly that this isn't something the available tools can fix
  directly — don't imply you're "resolving" it if the real fix is a
  human clicking through an admin console.
- Give concrete, numbered steps for what the admin needs to do (where to
  click, which specific license/setting to look for), not just "contact
  your administrator."
- If the user comes back with new information (a screenshot of their
  license page, a different error), re-diagnose from that new evidence
  rather than repeating the original guess — the first hypothesis is a
  hypothesis, not a conclusion, until confirmed by what's actually
  assigned/enabled.

## Step 6 — Report scoped, not vague

Close with a specific verdict, not "let me know if it still doesn't
work":
- What's confirmed working (name the capability and how you confirmed it)
- What's confirmed broken, with the real error code
- Root cause, stated as fact if confirmed or as the leading hypothesis if
  not yet confirmed — say which it is
- The next concrete action, and whose hands it's in (the user's, an
  admin's, or something you can retry yourself)
