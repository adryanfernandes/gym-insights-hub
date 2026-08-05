# webhook-ingest

Edge Function genérica para receber webhooks por `POST` e gravar o payload bruto em `public.webhook_events`.

## Variáveis necessárias

- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave service role para inserir no banco.
- `WEBHOOK_SECRET`: segredo opcional. Quando configurado, a função exige `x-webhook-secret` ou `Authorization: Bearer <segredo>`.

## Deploy

```bash
supabase functions deploy webhook-ingest --no-verify-jwt
supabase secrets set WEBHOOK_SECRET="troque-por-um-segredo-forte"
```

## Exemplo de chamada

```bash
curl -X POST "https://roehuoyzkwfxwlzifslk.functions.supabase.co/webhook-ingest?source=evo" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: troque-por-um-segredo-forte" \
  -H "x-event-type: member.updated" \
  -d '{"id":"evt_123","message":"teste"}'
```

Headers sensíveis como `authorization`, `x-webhook-secret`, `apikey` e cookies não são salvos na tabela.
