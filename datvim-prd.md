# Product Requirements Document (PRD)

## 1. Document Control

| Version | Date       | Author  |
| ------- | ---------- | ------- |
| 0.2     | 2025-06-24 | ChatGPT |

---

## 2. Purpose

Define the scope, requirements, and success metrics for **DatVIM**, a native macOS application that replicates and extends the functionality of Postico 2 while adding first‑class support for **MySQL** databases.

## 3. Goals & Objectives

* Native, intuitive GUI for **PostgreSQL (≥ 8.0) and MySQL (≥ 5.7)** as well as Amazon RDS/Aurora equivalents.
* Streamline everyday developer tasks—schema design, ad‑hoc queries, data editing, CSV import/export—without requiring the command line.
* Leverage native macOS conventions (toolbar, sidebar, dark mode) for friction‑free UX.
* Achieve < 0.1 % crash rate (rolling 30‑day) and median query‑execution latency ≤ 100 ms for simple selects.

## 4. Non‑Goals

* No SQLite support in v1.
* Application is distributed as a local desktop binary; no cloud‑hosted SaaS.

## 5. Target Audience & Persona

| Persona            | Needs                                                                  | Pain Points                                                            |
| ------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Developer Dana** | Rapid schema tweaks, multiple DB connections, keyboard‑driven workflow | `psql` / `mysql` CLI lack discoverability; existing GUIs feel sluggish |

## 6. User Journey (Happy Path)

1. **Connect** → *New Connection* → paste URI or enter host/port → *Save* → *Connect*.
2. **Explore** → sidebar lists databases → select *app.users* → table grid appears.
3. **Query** → ⌘⇧T opens SQL view → write query → ⌘↩ executes → results grid.
4. **Edit** → double‑click cell → modify → ⌘S commits.
5. **Import** → toolbar *Import CSV* → map columns → progress bar.

## 7. Functional Requirements

### 7.1 Connection Management

* PostgreSQL and MySQL connection via host/port or URI.
* SSL/TLS certificates and SSH tunnel support.
* Connection favorites with folders and tags.
* Recent connection history.

### 7.2 Schema Browser

* Hierarchical sidebar: Servers › Databases › Schemas › Tables/Views/Functions/Procedures.
* Lazy loading for large schemas (> 10 k relations).

### 7.3 Table Grid / Data Editor

* Infinite‑scroll result grid.
* In‑place edit, delete (mark row for deletion → “undelete” before commit).
* Row filtering: text search, “is in list”, range filters.
* JSON/JSONB and ARRAY prettified renderers where applicable.

### 7.4 SQL Query View

```sql
-- Example
SELECT id, email
FROM users
WHERE created_at >= NOW() - INTERVAL '7 days';
```

* Syntax highlighting & autocompletion (keywords, tables, columns) for both PostgreSQL and MySQL dialects.
* Execution shortcut ⌘↩, multiple result sets.
* EXPLAIN / EXPLAIN ANALYZE viewer with cost visualization.

### 7.5 Table Designer

* Column add/remove/rename, type change.
* Constraint & index management (PK, FK, UNIQUE, CHECK).
* Preview generated DDL before applying.

### 7.6 CSV Import / Export

* Drag‑and‑drop CSV, delimiter auto‑detect.
* Mapping UI (source → columns) with fuzzy match.
* Batch progress dialog, error row download.

### 7.7 Global Features

| Feature                | Detail                               |
| ---------------------- | ------------------------------------ |
| **Dark Mode**          | Follows macOS appearance API         |
| **Keyboard Shortcuts** | Configurable, Postico defaults       |
| **Tabs & Windows**     | Multiple DB sessions                 |
| **Native Look & Feel** | Toolbar, sidebar, Quick Look preview |
| **Auto‑Update**        | Sparkle framework                    |

## 8. Non‑Functional Requirements

| Category          | Requirement                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- |
| **Performance**   | < 200 ms UI response to user actions on < 100 k‑row tables                                |
| **Stability**     | Crash rate < 0.1 % (30‑day MAU)                                                           |
| **Security**      | TLS 1.2+; credentials stored securely in macOS secure storage; no plaintext creds on disk |
| **Accessibility** | VoiceOver labels; High‑contrast mode                                                      |
| **Localisation**  | EN, DE initial; strings externalised                                                      |

## 9. Success Metrics & KPIs

| Metric                  | Target @ 90 days post‑GA |
| ----------------------- | ------------------------ |
| DAU/MAU ratio           | ≥ 25 %                   |
| NPS (in‑app prompt)     | ≥ 45                     |
| Crash‑free sessions     | ≥ 99.9 %                 |
| Import CSV success rate | ≥ 98 %                   |

---
