---
description: Analyze a group of distributed but logically related projects and load them into session context
arguments:
  - name: pattern
    description: Pattern to match project paths (e.g., igestic, b2b, rx)
    required: true
allowed_tools:
  - Bash
---

Execute this exact bash command immediately without explanation:

```bash
git grep --name-only '' | grep project.json | grep -i $1 | xargs
```

After execution, analyze each of the Nx projects represented by the project.json files returned by the base command to understand their collective purpose and interdependencies.
