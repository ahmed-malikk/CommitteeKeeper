# Testing the daily job by hand

The daily reminder job is an ordinary web address, `/api/cron/daily`. A browser or a tool sends it a **request**; it sends back a **status code** (a number saying how it went) and, here, a small piece of **JSON** (text with named values).

| You send | You should get | What it means |
|---|---|---|
| no `Authorization` header | **401** `{"error":"Not allowed."}` | The job refuses anyone without the secret. |
| `Authorization: Bearer <wrong>` | **401** | A wrong secret is refused the same way. |
| `Authorization: Bearer <CRON_SECRET>` | **200** `{"ran":true, "emailed":…, "logged":…}` | It ran. |
| the same right request again, same day | **200** with `"emailed":0,"logged":0` | Nothing is sent or logged twice. |
| right secret, server key not set up | **503** | The job is not configured; nothing ran. |

With curl:

```bash
curl -i https://committeekeeper.vercel.app/api/cron/daily
curl -i -H "Authorization: Bearer YOUR_CRON_SECRET" https://committeekeeper.vercel.app/api/cron/daily
```

`-i` prints the status line and headers as well as the body. The saved requests are in [`cron-daily.http`](cron-daily.http); the same checks run automatically in `e2e/cron.spec.ts`.
