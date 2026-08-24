# Hypnotic Conception

Private root-owner assistant for KHE BOOTH maintenance and security.

## Runtime configuration

- `OPENAI_API_KEY`: server-only OpenAI project key. Never expose it through `NEXT_PUBLIC_*`.
- `OPENAI_HYPNOTIC_MODEL`: explicit Responses API model selected by the owner.
- `KHE_PLATFORM_VERSION`: release number displayed by the assistant. Vercel's short Git SHA is appended automatically.

## Security contract

- API access requires an authenticated `OWNER` belonging to the `KHE_ROOT` tenant.
- Conversation history is isolated by organization and owner user ID.
- OpenAI response storage is disabled; the KHE database remains the conversation system of record.
- Health context is sanitized. Credentials, raw logs and personal data are never sent to the model.
- The initial release exposes read-only diagnosis and change proposals only.
- Writes, production changes, deployments, credential operations, paid services and destructive actions require a separate auditable approval flow.

## Deployment checklist

1. Apply Prisma migrations.
2. Configure the three server variables above in the API project only.
3. Redeploy the API, then the Web project.
4. Verify that OWNER + KHE_ROOT receives 200 and ADMIN/OPERATOR/enterprise owners receive 403.
5. Send a health question and confirm both messages and `HYPNOTIC_CONCEPTION_CHAT` audit entry are persisted.
