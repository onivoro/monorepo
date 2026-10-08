# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open [a private security advisory](https://github.com/onivoro/monorepo/security/advisories/new) on this repository. Don't open a public issue.

Include the affected `@onivoro/*` package and version, and how to reproduce the problem.

## Supported versions

All `@onivoro/*` packages are released together at one version. Fixes go into the latest version only.

## Verifying packages

Every `@onivoro/*` package is published from this repository's `.github/workflows/publish.yml` with an npm provenance attestation. To verify the packages you've installed:

```bash
npm audit signatures
```
