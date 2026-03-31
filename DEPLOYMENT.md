# Vercel Deployment Guide

## Overview
This application has two parts:
- **Frontend**: React + Vite (deploying to Vercel)
- **Backend**: Node.js server with WebSocket (deploys separately - NOT on Vercel)

Vercel can only host **serverless f  unctions** (10-second timeout limit) and cannot maintain persistent WebSocket connections. Therefore, the backend must be deployed to a platform that supports persistent connections.

---

## Part 1: Deploy Frontend to Vercel ✅

### Prerequisites
- GitHub account (with this repo pushed)
- Vercel account (sign up at vercel.com)

### Steps

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Connect Vercel to your GitHub**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Select this GitHub repository
   - Click "Import"

3. **Configure Environment**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add: `GEMINI_API_KEY` = your actual Gemini API key
   - Add: `VITE_API_URL` = your backend URL (from Part 2 below)

4. **Deploy**
   - Vercel automatically builds and deploys
   - Frontend will be live at: `https://your-project.vercel.app`

---

## Part 2: Deploy Backend to Railway (or similar) ⚙️

Vercel cannot host the WebSocket backend. Use Railway, Render, Heroku, or similar platforms.

### Option A: Deploy to Railway (Recommended - Simple & Free tier available)

1. **Create Railway account** at [railway.app](https://railway.app)

2. **Push backend to GitHub in a separate branch or repo**
   ```bash
   # Option 1: Same repo, different path (recommended)
   git add server/
   git commit -m "Backend configuration for Railway"
   git push origin main
   ```

3. **In Railway Dashboard**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose this repository
   - Select the root directory (since backend is in `/server`)

4. **Configure Environment Variables**
   - Go to Variables tab
   - Add: `GEMINI_API_KEY` = your Gemini API key
   - Railway auto-generates: `PORT` (default 8080 or 3000)

5. **Set The Start Command**
   - Click "Settings" tab
   - Under "Start Command": `node server/plugin.ts` 
   - Or if using ts-node: `npx ts-node server/plugin.ts`

6. **Get Public Backend URL**
   - Railway gives you a URL like: `https://voice-backend-production-xxxx.railway.app`
   - Copy this URL

7. **Update Frontend Environment Variable**
   - Go back to Vercel dashboard
   - Settings → Environment Variables
   - Update `VITE_API_URL` = `https://voice-backend-production-xxxx.railway.app`
   - Redeploy frontend

---

### Option B: Deploy to Render

1. **Create Render account** at [render.com](https://render.com)

2. **In Render Dashboard**
   - Click "New +"
   - Select "Web Service"
   - Connect GitHub repo

3. **Configure Service**
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node server/plugin.ts`
   - Add Environment Variable: `GEMINI_API_KEY`

4. **Copy Public URL** from Render (something like `https://voice-backend.onrender.com`)

5. **Update Vercel with Backend URL** (as shown above)

---

## Part 3: Update Frontend for Production

Once you have the backend URL, update your frontend:

**In `.env.production`** (create this file):
```
VITE_API_URL=https://your-backend-url-from-railway.app
```

Or directly in Vercel Environment Variables (as mentioned in Part 1).

The frontend's WebSocket hook will automatically use:
```typescript
const wsUrl = `${protocol}//${window.location.host}/api/ws`;
// On production: wss://your-project.vercel.app/api/ws
```

Wait, this won't work because the backend is on a different domain!

**Fix: Update `useVoiceWebSocket.ts` to use the environment variable:**

```typescript
const wsUrl = `${protocol}//${process.env.VITE_API_URL || window.location.host}/api/ws`;
```

---

## Part 4: Testing End-to-End

After deploying both frontend and backend:

1. **Test Frontend** - Open `https://your-project.vercel.app`
2. **Test Connection** - Open browser console, should see:
   ```
   [VoiceWS] Connecting to wss://voice-backend-xxx.railway.app/api/ws
   [VoiceWS] ✅ Connected to backend
   🟢 RECEIVED GREEN LIGHT - Gemini is ready!
   ```
3. **Test Voice** - Click "Start Talking" and converse with Gemini

---

## Troubleshooting

### "Connection refused" or "Cannot reach backend"
- Check backend URL is correct in Vercel environment variables
- Ensure backend is running on Railway/Render (check their dashboard)
- Verify `GEMINI_API_KEY` is set on the backend platform

### "WebSocket connection failed"
- Backend must use `wss://` (secure WebSocket) for production
- Railway/Render automatically provide SSL certificates
- Frontend must connect to `wss://` URLs, not `ws://`

### Backend keeps restarting
- Check `GEMINI_API_KEY` is set
- Check server logs in Railway/Render dashboard
- Verify `package.json` has all dependencies

### Frontend working locally but not on Vercel
- Check `VITE_API_URL` is set in Vercel environment variables
- Rebuild and redeploy after changing environment variables
- Clear browser cache and hard refresh (Cmd/Ctrl + Shift + R)

---

## Summary

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend (Vite React) | Vercel | `https://your-project.vercel.app` |
| Backend (Node.js WS) | Railway/Render | `https://voice-backend-xxx.railway.app` |

Both communicate via WebSocket at `/api/ws` path.

Good luck! 🚀
