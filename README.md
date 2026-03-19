<div align="center">
  <img width="1200" alt="Training Dashboard" src="./trainer_shot.png" />
</div>

<br />

# Training Dashboard

An internal operations dashboard for **Three Points Hospitality Group** — built with React, TypeScript, and AI. Connects directly to Trainual to manage staff, assign curriculum, and automatically grade exams using Claude and Gemini.

🔗 **[Live App](https://Three-Points-Hospitality-Group.github.io/training-dashboard/)**

---

## What it does

### � Manage Staff
Browse all employees pulled live from Trainual. Filter by role (Host, Server, Bartender) and open any employee's profile to view their completion stats, assigned subjects, and progress by category.

### � Test Assigner
Assign and unassign Trainual curriculum subjects to individual employees directly from the dashboard — no need to open Trainual.

### 🎓 Grade Exam
Paste a student's Trainual score report and get AI-powered grading in seconds. Supports all exam types across OAK and Cantina. Handles real-world input — typos, abbreviations, casual phrasing — with "I know what you meant" grading logic.

Grading is routed to the best AI model for each exam type:
- **Claude** — scenario, conceptual, and hospitality knowledge questions
- **Gemini** — factual, ingredient-based, and recipe questions

### 🔐 Admin Panel
Passcode-protected settings panel. Update API keys and config directly in the browser — changes take effect immediately without a rebuild.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn-style primitives |
| AI — Grading | Anthropic Claude, Google Gemini |
| Data | Trainual API (via Render.com CORS proxy) |
| Hosting | GitHub Pages (auto-deploy via Actions) |
| Icons | Lucide React |

---

## Local Development

**Prerequisites:** Node.js v18+

```bash
git clone https://github.com/Three-Points-Hospitality-Group/training-dashboard.git
cd training-dashboard
npm install
```

Create a `.env.local` file:
```
GEMINI_API_KEY=your_key
CLAUDE_API_KEY=your_key
TRAINUAL_PASSWORD=your_password
TRAINUAL_PROXY=https://trainual-proxy.onrender.com
ADMIN_PASSWORD=your_passcode
```

```bash
npm run dev
# → http://localhost:3000
```

---

## Deployment

Pushes to `main` auto-deploy via GitHub Actions → GitHub Pages. API keys are injected at build time from GitHub repository secrets.

To update a secret: **GitHub → Settings → Secrets → Actions** → update value → re-run the Deploy workflow.

---

*Built for Three Points Hospitality Group · Internal use only*

