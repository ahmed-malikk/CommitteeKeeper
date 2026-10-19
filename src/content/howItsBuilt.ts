// The words on the "How it's built" page, kept apart from the layout so they are easy to read and to change.
// Everything here is a fact about the project that can be checked in the repository. The personal wording is Ahmed's to rewrite.

export const REPO = "https://github.com/ahmed-malikk/CommitteeKeeper";

/** Real numbers from the last full run. Update them from the test output, never by guessing. */
export const TESTS = {
  unit: 189,
  system: 348,
  browsers: "counted once in each of desktop Edge, desktop Chrome and a 375 px phone view",
  asOf: "19 October 2026",
};

export const BUILT_BY = {
  heading: "Who built it",
  paragraphs: [
    "I’m Ahmed Malik, a computer science graduate from UET Lahore. I built CommitteeKeeper as the fourth of ten portfolio projects, aiming for work as a developer, business analyst or project manager.",
    "I wrote the requirements, the business rules, the database design and the test cases first, then built the product against them one issue at a time, each with its own tests.",
  ],
};

export const STORY = {
  heading: "The story",
  paragraphs: [
    "A kameti (also called a BC) is a savings committee. Everyone puts in the same amount every month and one member takes the whole pot, until every member has had a turn. It runs on trust, a notebook and a WhatsApp group.",
    "Before writing any code I talked to an organiser who runs three or four committees at once and is a member in all of them. Her hassles became the requirements: chasing late payers, recalculating when two members swap turns, and working out what someone is owed when they leave and are replaced.",
  ],
};

export const PROBLEM = {
  heading: "The problem",
  paragraphs: [
    "One person keeps the whole record by hand: who has paid, who is late, whose turn it is and what was agreed. When two people remember it differently, there is nothing to settle it with, and the organiser carries the blame.",
    "CommitteeKeeper gives the organiser one place for all of it, and a history that nobody can quietly change. It only keeps the record: it never holds or moves money.",
  ],
  features: [
    "Set up a committee with a written agreement, members and slots, and decide turns by hand or by a draw.",
    "Record payments with up to two receipt images each; see who is late; hand over each pot, with the split worked out when a slot changed hands.",
    "A permanent history: corrections are new entries, and a chain check shows if anything was altered.",
    "A daily summary and ready-to-send WhatsApp messages for whoever is due or late.",
    "A private link for each member, and an optional view-only account, so members can answer their own questions.",
  ],
};

export const STACK = {
  heading: "The stack",
  rows: [
    ["Interface", "Next.js 16 (App Router, Server Components and Server Actions), React 19, TypeScript"],
    ["Database and sign-in", "Supabase: Postgres with row-level security on every table, Auth, private file storage"],
    ["Hosting", "Vercel, in the Mumbai region, close to the database"],
    ["Tests", "Vitest for the rules, Playwright for the screens"],
    ["Fonts", "Red Hat Display and Red Hat Mono"],
  ] as const,
};

export const ARCHITECTURE = {
  heading: "How it fits together",
  paragraphs: [
    "The rules live in small pure TypeScript files with no screens and no database in them (who is late, how a pot is split, what a history entry says), so they can be tested and explained on their own.",
    "Every change to money or turns goes through a database function that checks the rules again and writes the history entry in the same step, so the app cannot forget to log something. Members never read tables: they can only call functions that return their own information and nothing else.",
    "Receipts sit in a private bucket and are opened through links that stop working after a minute. A hash chain links every history entry to the one before it, and the History page re-checks it each time it opens.",
  ],
};

export const TESTING = {
  heading: "How it is tested",
  paragraphs: [
    "Unit tests cover the rules. System tests drive the real screens in desktop Edge, desktop Chrome and a 375 px phone view, and are run again against the live site after each deploy. A security script acts as each role (signed out, another organiser, a member) and checks what each can and cannot read or change.",
    "Defects found by testing were fixed in their own commits. The history of what was found and fixed is in the repository.",
  ],
};

export const LINKS = {
  heading: "Links",
  items: [
    ["Source code on GitHub", REPO],
    ["README", `${REPO}#readme`],
    ["Licence (MIT)", `${REPO}/blob/main/LICENSE`],
  ] as const,
};

export const CREDITS = {
  heading: "Credits",
  paragraphs: [
    "Built with Next.js, React, Supabase, Vitest and Playwright, and qrcode.react (ISC licence) for the QR codes. Fonts: Red Hat Display and Red Hat Mono, licensed under the SIL Open Font License. This project is released under the MIT licence.",
  ],
};
