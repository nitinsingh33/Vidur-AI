11.1 Inspect current NestJS modules + dependencies
       ↓
11.2 Check Redis availability/configuration
       ↓
11.3 Add BullMQ/Redis infrastructure
       ↓
11.4 Create Recovery Queue
       ↓
11.5 Create Recovery Worker/Processor
       ↓
11.6 Connect Job → Agent
       ↓
11.7 Verify one recovery job
       ↓
11.8 Verify failure/retry behavior
       ↓
11.9 Verify multiple jobs
       ↓
11.10 Phase 11 complete
       ↓
Phase 12 — React dashboard



                    RECOVERAI
                       │
                       ▼
                 PostgreSQL
                       │
                       ▼
                    NestJS
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
       ML           Policy        Business APIs
        │              │
        ▼              ▼
   FastAPI         Safety Layer
        │
        ▼
    LangGraph
        │
        ▼
      Tools
   ┌────┼─────┐
   ▼    ▼     ▼
Payment Notification Escalation
   │
   ▼
Razorpay Test API

              +
              
             Redis
               │
               ▼
            BullMQ
               │
               ▼
        Recovery Worker
               │
               ▼
           Agent Flow