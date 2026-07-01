---
name: user-profile
description: Who the rejs owner is and how they like mobile UX work delivered
metadata:
  type: user
---

Owner: Jeppe Lillevang Salling (jeppe@lillevang-consult.com). Maintains rejs, a
backend-free DSL-driven journey planner, solo. Values the app staying small and
simple — IDEAS.md is explicitly ordered by "value per unit of added complexity"
and repeatedly says "add the least surface area."

How to collaborate:

- Refine vague/over-ambitious outline items into lower-risk, evolvable steps
  before building (e.g. they were fine with shipping M1 as tabs instead of the
  more ambitious bottom sheet they'd written down).
- Keep the DSL as the single source of truth; never add a separate model/server.
- Follow the repo's done-gate (./.agent/scripts/check.sh) and reviewer
  (./.agent/scripts/review.sh) workflow without being asked; address review
  findings rather than waving them off.
- Conventional commits, one logical change per commit. No new dependencies
  without asking.
