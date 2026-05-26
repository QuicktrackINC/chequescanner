---
title: CPS Backend
emoji: 🏦
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# 🏦 CPS — Quick Track Check System

A full-stack AI-powered web application that automatically extracts structured financial data from business banking checks (PDFs and Images). 

**Live Demo**: [cps.vercel.app](https://cps-mu.vercel.app/)

---

## 📚 Documentation

Detailed documentation has been separated into their designated domains:

- 📖 **[User Guide](./docs/user_guide.md)** — Step-by-step instructions on how to use the CPS system (Uploads, Reviewing, Exporting).
- 🏗️ **[Architecture Overview](./docs/architecture.md)** — High-level details on the Next.js Frontend, FastAPI Backend, and the AI Pipeline.
- 🔑 **[Doppler Setup Guide](./docs/doppler.md)** — Guide on integrating Doppler secrets manager for local development.

---

## 🛠️ Tech Stack Quick Reference

### Frontend
- Next.js (App Router), React 19, TypeScript
- Tailwind CSS v4, Framer Motion

### Backend
- Python 3.9+, FastAPI
- SQLAlchemy (PostgreSQL)
- Google Gemini 1.5 API (Vision), PyMuPDF (fitz)
- AWS S3

---

## 📁 Project Structure

```
CPS/
├── src/                       # ⚛️ Next.js Frontend App Router
├── server/                    # 🐍 FastAPI Backend Application
├── scripts/                   # System automation (.bat) and diagnostics
├── test_data/                 # Sample PDFs and Images
├── docs/                      # Application documentation
├── package.json               # Node.js Dependencies
└── requirements.txt           # Python Dependencies
```

---

## 🚀 Quick Start

### 1. Frontend Setup
```bash
npm install
npm run dev
```

### 2. Backend Setup
Create your `.env.local` file at the root:
```env
DATABASE_URL=postgresql://user:password@localhost/dbname
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
JWT_SECRET=your-secure-jwt-secret
```

Install dependencies and start the Virtual Environment Backend:
```bash
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
scripts\start_backend.bat
```

---

## 📄 License

MIT © 2026 Jimmy Sherpa (Itskainos) & Quick Track Inc.
