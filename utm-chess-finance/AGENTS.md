<!-- BEGIN:nextjs-agent-rules -->

# ClubSync Automated Workflow Rules
Whenever I request a feature, UI update, or bug fix:
1. **Direct File Edits:** Locate the relevant files in `utm-chess-finance/src/` and apply targeted, surgical edits directly to the codebase without bloating or reformatting untouched code.
2. **Build Verification:** Run `npm run build` in the terminal to confirm there are zero TypeScript or Next.js build errors before deploying.
3. **Auto-Deploy to Vercel:** Once the build passes, stage, commit, and push the changes to GitHub (`git add . && git commit -m "<clear summary>" && git push origin main`) so Vercel automatically deploys the update. *(Note: Do NOT auto-push if the change requires me to run a Supabase SQL query first—wait for my confirmation in that case.)*
4. **Clear Summary:** Always finish your response with a concise bullet-point summary of:
   - What files were modified and what changed.
   - Any Supabase SQL queries or manual steps I need to run (if applicable).
   - Confirmation that the changes were pushed to GitHub/Vercel.

   Never use PowerShell or terminal commands (Get-ChildItem, Select-String) to search or list files—always use built-in file tools. Wrap any necessary terminal commands in cmd /c.