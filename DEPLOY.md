# Deploy Yggdrasil

## Build (already passing)

```bash
bun run build
```

## Deploy to Vercel (recommended)

1. **Install Vercel CLI (one-off):**
   ```bash
   bunx vercel
   ```
   Log in or sign up when prompted.

2. **From the project root:**
   ```bash
   bunx vercel
   ```
   Follow prompts (link to existing project or create new one).

3. **Set environment variable for Ratatoskr chat:**
   - Vercel dashboard → your project → **Settings** → **Environment Variables**
   - Add: `OPENAI_API_KEY` = your OpenAI API key
   - Redeploy so the API route can use it.

4. **Production URL:** Vercel will give you a URL (e.g. `your-project.vercel.app`). Custom domain can be added in **Settings** → **Domains**.

## Deploy to Netlify

1. Connect your Git repo in Netlify.
2. Build command: `bun run build`
3. Publish directory: `.next` (Netlify’s Next.js runtime will run `next start`; check their Next.js docs for the exact setup).
4. Add `OPENAI_API_KEY` in **Site settings** → **Environment variables**.

## After deploy

- Chat (Ratatoskr) only works if `OPENAI_API_KEY` is set in the host’s environment.
- Test the site and the **R** chat panel on the deployed URL.
