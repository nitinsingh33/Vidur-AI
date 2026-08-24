Absolutely. **Vidur AI is the product name from this point onward.** We won't call the UI RecoverAI.

And yes — we'll build the frontend **cleanly, incrementally, and with a Razorpay-inspired fintech aesthetic**, not a generic dashboard template.

### Phase 12 goal

```text
                    VIDUR AI
          Agentic Revenue Recovery
                    │
                    ▼
             ┌─────────────┐
             │   React UI  │
             └──────┬──────┘
                    │
              REST / JSON
                    │
                    ▼
             ┌─────────────┐
             │   NestJS    │
             └──────┬──────┘
                    │
                    ▼
               PostgreSQL
```

### Initial dashboard

We'll eventually have:

```text
┌──────────────────────────────────────────────────────────────┐
│ VIDUR AI                              ● Agent Operational     │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                 │
│ Overview   │  Revenue At Risk     Revenue Recovered          │
│            │  ₹12.4L              ₹8.7L                      │
│ Recovery   │                                                 │
│ Cases      │  Recovery Rate       Active Cases               │
│            │  70.2%               24                          │
│ Agent      │                                                 │
│ Activity   │  ─────────────────────────────────────────────  │
│            │                                                 │
│ Analytics  │  Recovery Cases                                  │
│            │                                                 │
│ Settings   │  Customer   Risk   Failure      Status           │
│            │  ─────────────────────────────────────────────  │
│            │  ...                                             │
└────────────┴─────────────────────────────────────────────────┘
```

But **we won't build all of this at once.**

We'll first understand exactly what is already inside `frontend/`.

## Phase 12.1 — Frontend inspection

Run these commands from the project root:

```powershell
Get-ChildItem frontend -Force | Select-Object Name,Mode
```

Then:

```powershell
Get-Content frontend/package.json
```

And:

```powershell
Get-ChildItem frontend/src -Recurse -File |
    Select-Object FullName
```

**Don't install anything and don't modify the frontend yet.**

Once I see the existing React setup, we'll do **12.1 foundation only** and then start building the Vidur AI interface piece-by-piece.

And yes: **animations where they add value, not animation everywhere.** The target is polished fintech/product UI, not a flashy demo.
