# NEXT DEVELOPMENT PHASE – CLOSE PRODUCTION GAPS

You have completed the previous development phase and provided a verification report.

Now I want you to work on the remaining technical gaps identified in that report.

IMPORTANT: Do not rebuild existing modules. Improve the existing implementation and preserve all working functionality.

## Phase 1: Real Lead Generation

Current limitation:
Lead research currently uses synthetic or LLM-generated information.

Required improvements:

1. Design a real lead discovery architecture.
2. Integrate authorized external search and business data APIs.
3. Support multiple lead discovery sources.
4. Allow company-wise lead source configuration.
5. Support industry, location, country, company size, and business category filters.
6. Store the original source URL for every discovered lead.
7. Store discovery date and source information.
8. Distinguish verified information from AI-generated information.
9. Prevent duplicate lead creation.
10. Add email and phone verification where supported by legitimate services.
11. Display lead generation progress.
12. Provide source-wise lead generation reports.

Do not invent contact information or claim unverified leads are genuine.

First identify suitable providers, their API requirements, pricing considerations, and licensing restrictions.

## Phase 2: Production Email Integration

Current limitation:
Email delivery can be simulated when SMTP or Resend is not configured.

Required improvements:

1. Implement reliable provider-based email delivery.
2. Support company-specific SMTP.
3. Support Resend integration.
4. Maintain approval-before-send functionality.
5. Track queued, sent, delivered, bounced, and failed statuses where provider events support them.
6. Implement webhook signature verification.
7. Support email replies and conversation threading where available.
8. Maintain unsubscribe and suppression lists.
9. Prevent duplicate email sending.
10. Display actual delivery status in the UI.

Never mark simulated emails as delivered.

## Phase 3: Production RAG Improvements

Current limitation:
Retrieval is primarily keyword-based and does not use a complete vector search pipeline.

Required improvements:

1. Implement document chunking.
2. Implement embedding generation.
3. Add vector database support.
4. Implement semantic search.
5. Implement hybrid keyword and vector retrieval.
6. Add metadata filtering.
7. Add source citations.
8. Support document updates and deletion.
9. Preserve company-level document isolation.
10. Keep public and private knowledge bases separate.
11. Add prompt injection protection.
12. Add retrieval evaluation and quality monitoring.

Use configurable embedding models and avoid locking the system to one AI provider.

## Phase 4: Background Job Reliability

Current limitation:
The current job execution system requires stronger production reliability.

Required improvements:

1. Implement atomic job claiming.
2. Prevent duplicate execution.
3. Add retry policies.
4. Add exponential backoff.
5. Implement failed-job management.
6. Implement dead-letter queue.
7. Add job timeout handling.
8. Add worker recovery.
9. Add execution logs.
10. Support scheduled jobs.
11. Add job-level tenant isolation.
12. Ensure jobs can recover safely after server restart.

Evaluate Redis and BullMQ or another suitable production job processing solution.

## Phase 5: Production Security and Rate Limiting

Current limitation:
Rate limiting and API caps are currently in memory.

Required improvements:

1. Implement Redis-based shared rate limiting.
2. Add tenant-level API limits.
3. Add user-level API limits.
4. Add AI usage limits.
5. Add email sending limits.
6. Add brute-force protection.
7. Verify all API permissions.
8. Perform cross-tenant access tests.
9. Secure webhook endpoints.
10. Review credential encryption and rotation.
11. Review sensitive data logging.
12. Test unauthorized access to all protected resources.

## Phase 6: Automated Testing

1. Configure ESLint properly.
2. Add unit tests.
3. Add API integration tests.
4. Add authentication tests.
5. Add tenant isolation tests.
6. Add AI provider tests using mocks where appropriate.
7. Add email approval tests.
8. Add workflow execution tests.
9. Configure Playwright E2E tests.
10. Add CI checks.

## DEVELOPMENT RULES

Before implementing:

- Inspect existing services and database tables.
- Identify reusable existing code.
- Identify required database changes.
- Identify external service requirements.
- Identify environment variables.
- Provide an implementation plan.
- Do not introduce duplicate services or tables unnecessarily.

After implementation:

- Run Prisma validation.
- Run database migration checks.
- Run TypeScript checks.
- Run ESLint.
- Run unit and integration tests.
- Run relevant E2E tests.
- Verify existing functionality.
- Verify tenant isolation.
- Update ARCHITECTURE.md and README.md.

## FINAL REPORT

For each phase provide:

1. Features completed.
2. Files modified.
3. Database changes.
4. New environment variables.
5. External API requirements.
6. Tests executed.
7. Test results.
8. Remaining limitations.
9. Deployment instructions.

Do not claim production readiness until the actual integrations and relevant tests have passed.

Start by auditing these remaining gaps and proposing the implementation plan. Wait for my approval before making changes.