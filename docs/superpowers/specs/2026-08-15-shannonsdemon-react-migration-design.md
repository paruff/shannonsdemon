# Shannon's Demon — React + Vite Migration Design

**Date:** 2026-08-15
**Status:** Approved
**Author:** Build Agent (via brainstorming skill)

---

## 1. Repository Structure After Migration

```
shannonsdemon/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deploy workflow
├── .gitignore                  # Existing + node_modules, dist
├── index.html                  # Vite entry HTML (NEW)
├── package.json                # npm config (NEW)
├── vite.config.js              # Existing, minor updates
├── src/
│   ├── main.jsx                # Vite entry point (NEW)
│   ├── App.jsx                 # Migrated from index.jsx (MIGRATED)
│   └── App.css                 # Optional (inline styles retained)
├── README.md                   # Rewritten for React/Vite (UPDATED)
├── LICENSE                     # Keep
├── Known Limitations.md        # Keep (roadmap)
└── .serena/project.yml         # Keep
```

### Legacy Files to Delete
- `app.py` — Streamlit app
- `requirements.txt` — Python dependencies
- `index.jsx` — Root-level React file (moved to `src/App.jsx`)

---

## 2. Key Technical Details

### Entry Points
- **`index.html`**: Minimal HTML5 shell loading `<script type="module" src="/src/main.jsx"></script>`
- **`src/main.jsx`**: Vite/React bootstrap
  ```jsx
  import React from 'react'
  import ReactDOM from 'react-dom/client'
  import App from './App'
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
  ```
- **`src/App.jsx`**: Full 880-line component from current `index.jsx`, exported as `default function App()`

### GitHub Pages Deployment
- Existing `vite.config.js` has `base: '/shannonsdemon/'` ✓
- GitHub Actions workflow (`.github/workflows/deploy.yml`):
  1. `npm ci`
  2. `npm run build`
  3. Deploy `dist/` to `gh-pages` branch via `peaceiris/actions-gh-pages@v3`

### Dependencies (`package.json`)
```json
{
  "name": "shannonsdemon",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

---

## 3. Unimplemented Roadmap (Phases 2/3)

These items remain from `Known Limitations.md` and are **not** part of this migration:

| Phase | Item | Description |
|---|---|---|
| 2 | **Yahoo Finance API adapter** | `fetchQuote()` is isolated; add adapter interface for Alpha Vantage / Polygon.io |
| 2 | **Trade account override UI** | Allow manual sell-account selection to avoid realizing gains in taxable accounts |
| 2 | **Volatility lookback guidance** | Add tooltips/notes on 3mo vs 2y sensitivity for assets like GLD/TLT |
| 3 | **RMD logic** | Traditional IRA/401k withdrawal sequencing for users subject to Required Minimum Distributions |
| 3 | **Tax-loss harvesting** | Opportunistic loss realization in taxable accounts |

---

## 4. Spec Self-Review

- [x] **No placeholders** — All file paths, commands, and configs are concrete.
- [x] **Internal consistency** — `vite.config.js` base path matches GitHub Pages workflow expectation; `package.json` scripts match Vite CLI.
- [x] **Scope contained** — Migration only; roadmap items explicitly excluded and tracked separately.
- [x] **No ambiguity** — Entry point structure, file locations, and deployment target are unambiguous.

---

## 5. Approval Record

**User Approval:** Given in chat on 2026-08-15 for all three design sections.

---

## 6. Next Step

Invoke `writing-plans` skill to generate the detailed implementation plan.