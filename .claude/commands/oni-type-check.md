---
description: Type-check projects matching a pattern
arguments:
  - name: pattern
    description: Pattern to match project paths (e.g., igestic, b2b)
    required: true
allowed_tools:
  - Bash
---

Execute this exact bash command immediately without explanation:

```bash
failed=0; for tsconfig in $(git ls-files | grep 'tsconfig\..*\.json' | grep "$ARGUMENTS"); do npx tsc --noEmit -p "$tsconfig" || failed=1; done; exit $failed
```

After execution, summarize any type errors found.
