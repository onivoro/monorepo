Analyze the currently staged changes (`git diff --cached`) and create a commit with a concise but descriptive message.

Follow these steps:

1. Run `git diff --cached` to see what is staged.
2. If nothing is staged, inform the user and stop.
3. Run `git log --oneline -10` to see recent commit message style.
4. Analyze the staged diff to understand:
   - What changed (files, functions, logic)
   - Why it likely changed (bug fix, new feature, refactor, chore, etc.)
5. Write a commit message that:
   - Has a short subject line (under 72 characters) summarizing the "why"
   - Matches the commit message conventions observed in recent history
   - Includes a Jira ticket ID prefix if one is apparent from the branch name or recent commits
   - Adds a blank line and brief body only if the change is non-trivial
   - Ends with: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
6. Create the commit using a heredoc for the message.
7. Run `git status` to confirm success and report the result.
