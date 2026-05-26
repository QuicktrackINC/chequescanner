# Doppler Secrets Management Integration Guide

This guide explains how to install, configure, and use **Doppler** to manage environment variables for the CPS application.

---

## ⚙️ 1. Install Doppler CLI

To use Doppler locally, you need the Doppler CLI installed on your system.

### Option A: Via Winget (Recommended for Windows)
Open PowerShell and run:
```powershell
winget install DopplerCLI.Doppler
```
*Note: Restart your terminal/VS Code after installation so the `doppler` command is added to your PATH.*

### Option B: Via Scoop
If you use Scoop:
```powershell
scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git
scoop install doppler
```

---

## 🔑 2. Authenticate Doppler CLI

Once the CLI is installed, authorize it to access your Doppler account:

```powershell
doppler login
```
This will open a browser window. Authenticate with your Doppler credentials and paste the authorization code back into the terminal.

---

## 🚀 3. Initial Project Setup & Secret Import

If the project configuration (`doppler.yaml`) is already in the repository, you just need to link it and upload your local environment variables to Doppler.

### Link Workspace
At the root of the project (where `doppler.yaml` is located), run:
```powershell
doppler setup
```
This will automatically detect the project configured in `doppler.yaml` (which is `acct-check-scanner`) and ask you to select a config (e.g. `dev`).

### Upload Existing Secrets
To upload your existing local secrets from `.env.local` to the Doppler cloud project:
```powershell
doppler secrets upload .env.local
```
*Note: Do this once per environment to populate the Doppler dashboard. Once uploaded, you no longer need the local `.env.local` file for development.*

---

## 💻 4. Running the Application with Doppler

Instead of loading from static `.env.local` files, Doppler injects configuration variables directly into the process environment at runtime.

### Running Frontend (Next.js)
Start the Next.js development server with Doppler injected environment variables:
```powershell
npm run dev:doppler
```

### Running Backend (FastAPI)
Run the Doppler backend batch script:
```powershell
scripts\start_backend_doppler.bat
```
This script runs the FastAPI server using the virtual environment interpreter wrapped with `doppler run`.

---

## 🛡️ Best Practices & Production Deployment

1. **Never commit `.env` or `.env.local` files to Git**.
2. Keep the `doppler.yaml` file tracked under Git so other developers don't have to manually link the project.
3. For deployment platforms like Railway, Vercel, or Render, install the Doppler integration so that production secrets are automatically synced during builds/deployments.
