---
name: asana-priority-check
description: Pull every incomplete task assigned to the user from Asana, bucket it by due date, and produce a verified priority dashboard. Use this whenever the user asks to check Asana, review their workload, see what's overdue, or figure out what to work on next — phrases like "Asanaを見に行き仕事の優先順位を確認して", "check my Asana tasks", "what's on my plate", "何が期限切れになってる？". Also use it proactively when the user seems to be deciding what to work on and their tasks live in Asana. Don't use it for single-task lookups ("what's task X about") — that's a plain get_task/get_task_stories call, not this workflow.
---

# Asana Priority Check

This skill turns "check Asana" into an actual triage, not a task dump. The
point isn't to list tasks — it's to tell the user what's on fire, what's due
soon, and what's probably just clutter, and to get the numbers right the
first time.

It exists because a first attempt at this got it wrong in two specific,
avoidable ways: it stopped after the first page of 100 tasks (silently
under-reporting the total), and it miscounted a duplicate-task cluster by
conflating tasks that belonged to a project with same-named tasks that had
no project at all. Both mistakes were only caught because a second,
independent pass re-fetched everything from scratch. Bake that
independent-recheck step in — don't skip it because "the numbers looked
right."

## Step 1 — Fetch everything, not just the first page

Call `mcp__Asana__get_my_tasks` with:
- `completed_since: "now"` (incomplete tasks only)
- `opt_fields: "name,due_on,due_at,completed,projects.name,assignee_status,notes,tags.name"`
- `limit: 100`

The response includes `next_page.offset` whenever more results exist. Keep
calling with that `offset` until `next_page` comes back `null`. A workspace
with 108 open tasks returns two pages — stopping at the first silently
drops the tail and produces a wrong total. There's no shortcut here: always
drain pagination fully before you do any counting.

## Step 2 — Bucket by due date

Using today's actual date (don't guess it — read it from context), sort
every task into:

- **Overdue** — `due_on` is before today
- **This week** — `due_on` is today through 6 days out
- **Rest of this month** — after this week through the end of the current
  calendar month
- **Later / no date** — everything else, including `due_on: null`

Report the count in each bucket. These four numbers should sum to the total
task count — if they don't, you've mis-bucketed something.

## Step 3 — Read `notes`, don't just count titles

A due date alone doesn't tell you if a task matters. Read the `notes`
field of overdue and this-week tasks for concrete signal: named owners
("担当：津田氏"), staffing/headcount numbers, explicit deadlines mentioned
in the body, or language describing risk or a blocked decision. A task
titled "面談" with empty notes is routine; a task whose notes describe a
staffing gap with named people and a date is not — surface the latter
first regardless of which bucket it's in. Skim titles for the rest; don't
inflate every overdue task into a crisis.

## Step 4 — Flag duplicate/stale clusters, don't assert they're dead

Two patterns are worth calling out as "probably safe to clean up, but
verify before touching":

1. **Exact duplicates** — multiple tasks with the identical name and
   `due_on`, whether or not they share a project. Check the `projects`
   field carefully per task: a batch of same-named tasks split across "has
   project X" and "no project" is two clusters, not one — don't merge
   their counts.
2. **Superseded cycle tasks** — a batch of same-named tasks tied to an
   older project (e.g. last year's bonus/review cycle) when a newer
   equivalent project already exists among the projects you saw in this
   fetch. This suggests the batch is done in reality and just never got
   marked complete in Asana — say exactly that, and recommend the user
   confirm and mark them complete. Don't claim they're stale outright; you
   only have due dates and project names, not proof of completion.

## Step 5 — Independent verification pass (do not skip this)

Before presenting final numbers, spawn a verification subagent with the
`Agent` tool (`subagent_type: general-purpose`). Give it the current date,
tell it to independently call `mcp__Asana__get_my_tasks` itself from
scratch (own pagination, own bucketing), and hand it the specific claims
you're about to present — total count, each bucket's count, and any
duplicate/cluster counts — asking it to mark each CORRECT or INCORRECT
against its own fetch. This is the step that catches the pagination and
duplicate-counting mistakes described above; a single pass checking its own
work rarely does. If it reports discrepancies, fix them and use its
numbers — it's not a formality, it's an independent recheck for exactly the
kind of error this workflow already made once.

## Step 6 — Publish a dashboard, not a wall of text

This is operational, scan-and-act content, not a document to read
top-to-bottom — treat it like a UI. Before writing the HTML, load the
`artifact-design` skill and follow its utilitarian treatment: real
typographic hierarchy and a deliberate palette, but no big hero, no
decorative flourish. Structure:

- A stat-row summary: one tile per bucket with its verified count
- A "most consequential overdue" section — the items step 3 surfaced,
  each with its due date, project tag, and a one-line excerpt of the
  signal from its notes
- Grouped lists for this-week and rest-of-month
- A distinct "cleanup recommended" callout for what step 4 found
- A collapsed-to-counts section for "later / no date" grouped by project
  — don't enumerate all of it line by line if it's large; counts per
  project are enough

Publish it with the `Artifact` tool, a title naming the dashboard itself
(not a generic label), and a favicon.

## Step 7 — Lead the chat reply with prose, not the dashboard link alone

Before pointing at the artifact, write 3-5 sentences: the handful of most
consequential overdue items (from step 3), what's due this week, and a
one-line pointer to the cleanup section if anything got flagged there.
The artifact is the reference; the chat reply is what the user actually
reads first.
