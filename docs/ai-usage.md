```markdown
# Case Management System: The Build Journey 

I started this project a bit differently than most people—I didn’t begin with UI or APIs. I started with the data. 

I tried to answer 2 simple questions: 
- what actually exists in this system?
- Have I made something similar or can my previous projects help me in one way or the other for this use case ---- And Yes I had.



That led me to define a few core ideas early on—programs (multi-tenancy), users with roles (coordinator, agent, supervisor), cases with dynamic schemas, assignments, and an append-only activity log. I also knew I’d need a reliable way to integrate with external systems, which is where `external_id` came in.

Even at this stage, I could already see the system forming. The APIs, constraints, and even parts of the UI were kind of implied by the data model.

---

## Building the Core

I jumped into implementation pretty quickly to validate my assumptions.

The first phase was messy—setting up the backend, dealing with CORS issues, fixing assignment logic, and figuring out how sync should behave. But that mess was useful because it exposed real problems early.

After that, I stabilized the backend properly using Django + DRF:

- Clean models and relationships
- Migrations and APIs
- Seed data and tests

At that point, I had a system that was logically sound and runnable.

---

## Frontend (Where Most Iteration Happened)

For the frontend, I didn’t try to design everything from scratch.

I used Cursor to generate an initial layout and rough flows. Honestly, the first versions weren’t great—but they gave me a starting point.

From there, it became an iterative loop:

- Generate → Review → Fix → Repeat

I refined things like:

- Case-first workflows instead of form-first
- Assignment flows
- Modals and dropdowns
- Pagination and state handling

This was the most back-and-forth part of the project. The final UI looks clean, but it took multiple iterations to get there.

---

## Sync & Real-World Complexity

One of the more interesting parts was designing for offline-like behavior. Having worked on similar used cases before I was pretty sure on What needs to be done. How I will manage the offline sync, its implementation, server updates etc. 

I implemented:

- Append-only activities
- Client-generated IDs for idempotency
- Push/pull sync with tokens

This worked in isolation, but once everything was integrated, I hit questions like:

- What exactly is “pending sync”?
- What should supervisors vs agents see?

These weren’t just technical issues—they were product decisions. I had to revisit and align the system across roles.

---

## Hardening the Project

Once things were working end-to-end, I focused on making the project complete:

- Dockerized the full stack
- Added Postman collections
- Cleaned up duplicate frontend code
- Wrote documentation (architecture, assumptions, demo flow) as required in the assignment document.

This phase was about turning a working system into something presentable and reproducible.

---

## What Changed Along the Way

A lot of important improvements weren’t planned upfront:

- Simulating Webhook calls
- Added idempotent sync to avoid duplicates
- Cleaned up external event ingestion
- Standardized seed workflows (Demo seed data script)
- Consolidated frontend into TypeScript
- Improved overall structure and documentation

These came from actually building and refining—not from initial design.

---

## How I’d Summarize My Approach

If I had to boil it down:

1. Start with a clear data model
2. Let that drive backend design
3. Use AI tools to speed up scaffolding (especially frontend)
4. Iterate heavily—don’t expect the first version to be right
5. Integrate early to expose real problems
6. Fix not just code, but product gaps
7. Harden everything for delivery

Note - Another thing which is not there in this document but I did for this project and almost everything I build is to ensure that I don't rely on only one LLM for my solutions. Once I have a brief design language for what I'm trying to make I take suggestions from multiple LLMs claude, ChatGPT and sometimes grok. Because there is not always one solution fixing all problems. 

Also, I did not rely on any skills for this project as I didn't feel the need of it. I still have multiple new feature suggestions and optimizations like defining form schemas and their validations. RBAC (Role based access control) and many such things.   

---

## Key Insight

The biggest thing I learned is:

> Good systems aren’t built in one pass—they evolve through iteration, correction, and constant alignment between data, backend, and UI.


```

