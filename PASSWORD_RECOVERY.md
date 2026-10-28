# Password recovery integration

The recovery screens in `index.html` call a same-origin authentication backend. This repository currently has no authentication provider, backend, email sender, or configured recovery credentials, so the screens deliberately do not claim that an email was sent unless the backend accepts the request. The login and Google buttons remain the existing visual-only entry behavior.

## Required endpoints

### `POST /api/auth/password/forgot`

Request JSON:

```json
{"email":"person@example.com"}
```

For both known and unknown addresses, return the same status, response shape, and user-visible timing. On an accepted request, return HTTP `202` (or `200`) with JSON:

```json
{"accepted":true}
```

The server must rate-limit requests, create a cryptographically random, short-lived, single-use token (or invoke the existing provider's equivalent), store only a token hash when implementing custom tokens, and send the reset email. The email link should point to the public site using a URL fragment, for example `https://example.com/#reset_token=<opaque-token>`, so the token is not sent in the initial HTTP request or referrer header.

### `POST /api/auth/password/reset`

Request JSON:

```json
{"token":"<opaque-token>","newPassword":"<new-password>"}
```

After verifying the token, atomically consume it and update the password through the configured authentication provider. Return HTTP `200` with `{"success":true}` only after the provider confirms the update. Invalid, expired, and previously used tokens should return a generic `400` or `410` response. Apply server-side password validation and rate limits. Never log request bodies, passwords, or tokens; do not echo tokens in responses. Serve the site and these endpoints over HTTPS.

## Deployment status

Neither endpoint nor any provider credentials/configuration exists in this project. Until they are supplied by the deployment backend, the UI shows a generic failure for reset-email requests and cannot update passwords. Do not replace these endpoints with client-side password writes or a mock success response.
