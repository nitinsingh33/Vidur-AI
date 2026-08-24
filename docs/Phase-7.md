PHASE 7 — Python Service

[✅] FastAPI service
[✅] /health
[✅] /predict-recovery
[✅] Logistic Regression model loaded
[✅] FastAPI → ML inference
[✅] NestJS → FastAPI HTTP communication
[✅] NestJS build
[✅] Full test suite: 17/17


                    RecoverAI
                       │
             ┌─────────┴─────────┐
             │                   │
         NestJS :3000        FastAPI :8001
             │                   │
             │ HTTP              │
             └──────────►────────┘
                         │
                    ML Model
                         │
                         ▼
                recovery_probability