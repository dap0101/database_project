# MIS 205 Term Project — Part 2: Build Your Own Web App with Agentic Coding

> **Course:** MIS 205 — Data Management and Database (Spring 2026)
> **Total project:** 15 points (Part 1 = 10 pts, Part 2 = 5 pts) **+ up to 2 bonus points on each part**
> **This document covers Part 2 only.**
> **Stack:** Supabase · Your choice of frontend (HTML/CSS/JS, React, Next.js, etc.) · AI coding assistant · Git/GitHub

Part 2 builds on the agentic coding skills from the Vibe Coding phase. You and your group will design and ship **your own** web application using AI assistance throughout the process, then present it to the class.

Two key differences from Part 1:

1. **You choose the topic.** Anything except a paper submission system.
2. **You use Supabase as the backend.** No local PostgreSQL setup, no plain-text passwords — Supabase handles the database, auth, and hosting concerns for you.

---

## Groups

Same groups as Part 1 (**1–3 students**). You may stay solo if you went solo on Part 1.

**Group identifier:** in filenames and submissions, use all group members' student IDs joined with underscores

---

## Learning Objectives

1. **Spec-driven design.** Write a specification before coding.
2. **Agentic development.** Use AI coding tools effectively to build a working product.
3. **Backend-as-a-service.** Configure Supabase auth + database + queries for a real app.
4. **Communication.** Demo and explain your product in a 5-minute group presentation.

---

## Topic

Build any CRUD-style web application (or APP). The only constraint: **it cannot be a paper submission system** (that was Part 1).

A few examples to spark ideas — you do not have to use any of these:

- Campus event sign-up
- Book club / reading tracker
- Study-group scheduler
- Expense splitter
- Course review site
- Used-book marketplace
- Lost-and-found

Pick something you would actually use, or build something for a clearly defined hypothetical user.

---

## Minimum technical requirements

- **≥ 2 tables/entities** with at least one foreign-key relationship
- **Full CRUD** on at least one entity (Create, Read, Update, Delete)
- **User authentication** via Supabase Auth — no plain-text passwords
- **Working frontend** that runs during the live demo

---

## Why Supabase?

Supabase is the default for Part 2 because:

- **Free tier covers your project** — 500 MB database, 50k monthly active users, 1 GB storage
- **Built-in authentication** — no rolling your own, no plain-text passwords
- **Hosted PostgreSQL** — you already know how to query Postgres from Part 1
- **Accessible from China without VPN**

You may use a different backend service (Firebase, your own hosted Postgres, MongoDB Atlas, etc.), but you must include a **1-paragraph justification** in your `spec.md` explaining why you chose a different backend.

---

## Requirements (5 points + 2 bonus)

### Core requirements (5 points)

#### 1. Spec + schema design — 1 point

Write `spec.md` **before** writing code. It must include:

- A one-line description of the app and its target user
- List of entities with their attributes
- Relationships between entities (foreign keys)
- **3+ user flows** (e.g., "user registers → creates an event → invites a friend → friend RSVPs")
- **An ER diagram OR the schema SQL**

#### 2. Working CRUD product — 2 points

- All four CRUD operations work end-to-end on at least one entity
- Auth-protected pages redirect unauthenticated users
- App does not crash during the demo
- Each CRUD operation is shown working during the live demo

#### 3. Supabase integration — 1 point

- Supabase Auth is used for login/registration (not plain-text passwords)
- Your schema lives in Supabase, not a local DB
- App queries Supabase live — no mock data, no hardcoded users

#### 4. Presentation — 1 point

- Demo lands in **5 minutes** (overrunning costs marks)
- Every group member speaks
- Each member can answer a question about the group's AI workflow and what they learned from the process

### Bonus (max 2 points)

#### GitHub workflow & collaboration — 1 point

Show that your team used Git the way real engineering teams do — not just everyone pushing to `main`.

**To earn the point, your repo must show all of these:**

- **Branches.** Feature work happens on branches (e.g., `feat/auth`, `feat/event-list`), not directly on `main`.
- **Pull Requests.** At least **3 PRs**, each with a description explaining *what* the change does and *why*. PRs must be merged into `main` (not just open).
- **Meaningful commit messages.** No `fix`, `update`, `wip`, or `asdf`. A reader should be able to skim the log and understand what happened.
- **Distributed authorship** (groups of 2–3 only). Every member has commits under their own GitHub account — not all commits authored by one person.

**Solo students:** branches, PRs, and meaningful commits still required. Distributed-authorship rule doesn't apply.

**This bonus requires Option (a) — public GitHub link submission** so the grader can browse your branches and PR history.

#### Best group award — 1 point

The **top 2 groups per class section** receive this bonus, decided by **class vote** after all presentations.

Each student submits the name of **one group other than their own** that they think gave the best presentation. The two groups with the most votes each receive +1 point. Ties for 2nd place are broken by the instructor based on demo quality. Base your pick on what you saw during the presentations — how interesting the project was, how well the demo worked, and how clearly the group explained their work.

---

## Steps

### Step 1. Form your group and pick a topic

Same group as Part 1. Brainstorm topics — settle on one before writing the spec.

### Step 2. Write `spec.md` (before any code)

Use the structure listed in Requirement 1. Target length: 1–2 pages.

### Step 3. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free, no credit card).
2. Create a new project. Pick **Singapore** as the region (closest to China).
3. Save your project URL and anon key — you'll need them in your frontend code.
4. In the **SQL Editor**, run the schema you designed in Step 2 to create your tables.
5. In **Authentication → Providers**, enable Email auth (and optionally Google / GitHub).

### Step 4. Build with AI assistance

Use Pi (the AI assistant from class). Follow the agentic coding workflow from the Agentic Coding phase: feed your `spec.md` as starting context, build one feature at a time, test in the browser before moving on, and correct the AI explicitly when it makes a wrong assumption instead of just regenerating.

You can use any frontend framework or no framework at all — plain HTML + CSS + JS is fine.

### Step 5. (Optional bonus) Use a real GitHub workflow

If you want to attempt the GitHub workflow bonus, set this up before you start coding in Step 4 — not after. Workflow:

- Create a GitHub repo for your project. If any group member doesn't have a GitHub account yet, sign up at [github.com](https://github.com) (free, no credit card).
- For each new feature, create a branch, commit as you work, open a PR with a short description, and merge it into `main` once it's done.
- Aim for at least 3 PRs across the project.
- In a group, divide features so each member owns at least one branch + PR under their own GitHub account.

This is the workflow real engineering teams use — and it's also what earns the GitHub workflow & collaboration bonus.

### Step 6. Prepare your 5-minute presentation

Suggested structure:

- **1 min** — problem & target user
- **2 min** — live demo (CRUD + auth)
- **1 min** — what worked well, what was hard
- **1 min** — reflection on using AI tools

Q&A round: graders will ask how the group worked with AI throughout the project and what they learned from the process. Be ready to talk about your workflow, where AI helped, and where you had to push back or correct it.

---

## Submission

Pick **one** of these two delivery methods:

**(a) Public GitHub link + PDF report**

Submit a link to your **public** GitHub repo. If you want to keep your code private, use option (b) instead. The repo must contain your code, `spec.md`, and presentation slides. **Also submit a short PDF report (~1 page) separately**, containing:

- Group member names + student IDs + class section
- **The GitHub link itself**
- Screenshots of: registration, login, each CRUD operation
- Final ER diagram

**(b) Zip bundle (use this if your repo is private)**

Submit a single zip containing your code, `spec.md`, presentation slides, **and the same short PDF report inside the zip, named `report.pdf`** (member info, screenshots, ER diagram — no GitHub link needed since everything is bundled). Note: the GitHub workflow bonus requires Option (a); choosing Option (b) means giving up that bonus.

**Naming** (use the group identifier defined in the Groups section — all member student IDs joined with underscores):

- Option (a): `MIS205_Project_Part2_<student-ids>.pdf` for the report
- Option (b): `MIS205_Project_Part2_<student-ids>.zip` for the bundle

Example for a 2-person group with IDs `12345` and `67890`: `MIS205_Project_Part2_12345_67890.zip`.

---

## Notes

- **Same group as Part 1** (or a re-formed group with the same members).
- **Supabase is the default.** If you use a different backend, justify it in `spec.md`.

Good luck — and have fun picking a topic you actually care about.
