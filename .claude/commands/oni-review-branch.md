Perform a thorough code review of all changes between the current branch and the `main` branch.

## Step 1: Gather the diff

Run `git diff main...HEAD` to get the full changeset. Also run `git log main..HEAD --oneline` to see the commit history for this branch.

## Step 2: Changeset Summary

Provide a concise summary of what this branch does:
- What features, fixes, or refactors are introduced
- Which projects, libraries, or domains are affected
- The overall scope and intent of the changes

## Step 3: Potential Problems & Bugs

Identify issues such as:
- Logic errors, off-by-one mistakes, or unhandled edge cases
- TypeScript type safety gaps (implicit `any`, unsafe casts, missing null checks)
- Missing error handling or swallowed exceptions
- Race conditions or async pitfalls
- Breaking changes to public APIs or shared interfaces

## Step 4: Security Review

Flag any security concerns:
- Injection vulnerabilities (SQL, command, XSS)
- Hardcoded secrets, credentials, or API keys
- Improper input validation or sanitization
- Authentication or authorization gaps
- Sensitive data exposure in logs or responses
- Insecure dependencies or configurations

## Step 5: Performance & Optimization

Call out opportunities to improve performance:
- Unnecessary computations, redundant loops, or N+1 query patterns
- Missing indexes or inefficient database queries
- Large payloads or unbounded result sets
- Opportunities for caching, lazy loading, or batching

## Step 6: DRY Opportunities

Highlight where the code could be made DRYer:
- Duplicated logic that could be extracted into a shared function or utility
- Patterns that already exist elsewhere in the codebase that could be reused (search the repo for similar implementations)
- Opportunities to leverage existing `@onivoro/*` libraries instead of reimplementing
- Repeated type definitions, constants, or configurations that could be consolidated

## Output Format

Present the review as a structured report with the sections above. For each finding:
- Reference the specific file and line number
- Explain the issue clearly
- Suggest a concrete fix or improvement when possible
- Rate severity as **Critical**, **Warning**, or **Suggestion**

If a section has no findings, say so briefly and move on.
