# Security Policy

## Reporting a vulnerability

Please do not open a public Issue for a vulnerability, exposed credential, signed media URL, or privacy leak. Use GitHub's **Security → Report a vulnerability** private reporting flow for this repository. Include the affected URL or file, the impact, and a minimal reproduction. Do not include real credentials in the report.

We will acknowledge a valid report, investigate it privately, and publish a fix before discussing exploit details. Content attribution, Prompt provenance, broken media, and takedown requests are not security vulnerabilities; use the focused Issue forms instead.

## Supported version

The hosted site and the latest commit on `main` are supported. Older releases and forks may not receive security fixes.

## Deployment boundary

Production credentials are server-side only. Pull requests from forks must never run with storage, analytics, browser-session, or publishing credentials. Example configuration must contain placeholders, not live identifiers.
