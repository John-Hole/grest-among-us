# Deployment Instructions for Agents

This project uses Vercel for hosting, which is connected directly to the GitHub repository's `main` branch. 

**Whenever you make modifications to the codebase that the user needs to test or view, you MUST deploy your changes.**

## How to Deploy

To deploy your changes, simply commit and push them to the `main` branch using the `run_command` tool in PowerShell:

```powershell
git add .
git commit -m "Description of your changes"
git push origin main
```

*(Note: You can combine these into a single command: `git add . ; git commit -m "..." ; git push origin main`)*

## Important Notes:
1. **Wait for Vercel**: After pushing, Vercel will automatically build and deploy the changes. This usually takes a few seconds. 
2. **Tell the User**: Always inform the user that you have pushed the changes and kindly ask them to refresh the page (F5) after a few seconds to see the updates.
3. **No manual builds required**: You do not need to run any `npm run build` or Vercel CLI commands. The simple `git push` is all that is needed.
