# Getting Steady online — step by step

You now have two files that matter:
- `public/index.html` — the app you already tested
- `api/analyze.js` — a small helper that holds your API key privately and talks to Claude on the app's behalf

Follow these steps in order. None of them require coding — just account setup and clicking.

---

## 1. Get two free API keys (primary + backup)

**Primary — Gemini:**
1. Go to https://aistudio.google.com/apikey and sign in with any Google account.
2. Click **Create API Key**. No credit card needed.
3. Copy the key somewhere safe.

**Backup — Groq:**
1. Go to https://console.groq.com and sign up with email, Google, or GitHub.
2. Click **API Keys** in the sidebar, then **Create API Key**. No credit card needed.
3. Copy this key too.

**Why two:** the app tries Gemini first. If Gemini is briefly overloaded (a known free-tier hiccup), it automatically retries, and if it still fails, it silently falls back to Groq's free vision model instead of showing you an error. You get the reliability of two independent providers without paying for either.

**Worth knowing:** both are free tiers with rate limits (plenty for personal use — thousands of requests/day combined) and both providers' terms allow using free-tier inputs to improve their models. If either tightens their free tier in the future, we just swap that one provider's code — nothing else about the app changes.

## 2. Put your code on GitHub

This is what lets you (and me, in future chats) keep editing the app later.

1. Go to https://github.com and make a free account if you don't have one.
2. Click **New repository**, name it `steady-app`, keep it private if you'd like, and create it.
3. On the new repo page, click **uploading an existing file**, and drag in both `public/index.html` and `api/analyze.js` (keep the folder structure — GitHub will preserve it if you drag the whole `steady-deploy` folder contents in).
4. Commit the files (there's a green "Commit changes" button).

## 3. Deploy on Vercel

1. Go to https://vercel.com and sign up **using your GitHub account** (this links them automatically).
2. Click **Add New Project**, and select the `steady-app` repo you just created.
3. Before clicking deploy, open **Environment Variables** and add both:
   - Name: `GEMINI_API_KEY` → Value: (your Gemini key)
   - Name: `GROQ_API_KEY` → Value: (your Groq key)
4. Click **Deploy**. Wait about a minute.
5. You'll get a real URL like `steady-app.vercel.app` — that's your live app.

## 4. Test it for real

Open that URL on your phone, upload a label photo, and confirm it works exactly like it did in the chat preview — except now it's really yours, live on the internet, running on your own key.

## 5. Making changes later

Now that you're set up locally:

- Come back to me with what you want changed
- I'll give you the updated file content (or, once Claude Code is set up, edit it directly)
- Save the change in VS Code, then in Terminal: `git add .`, `git commit -m "what changed"`, `git push`
- Vercel automatically redeploys within about a minute — no extra steps

That's the loop, indefinitely: chat with me → edit locally → commit → push → Vercel auto-updates.
testing this readme
