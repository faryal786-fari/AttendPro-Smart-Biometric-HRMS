# Landing Page GitHub Commands — Roman Urdu

Ubuntu terminal mein project folder open karein. Pehle apne existing project ka backup bana lein.

```bash
git status
git switch -c feature/pts-farooqabad-landing-page
```

Fixed ZIP extract karne ke baad uske project files ko apne cloned repository mein copy karein. Agar repository root mein files hain aur ZIP project root bhi same hai to copy command ka source path apne Downloads folder ke mutabiq adjust karein. `.env`, `.git`, local `data/`, `.mdb`, `.sqlite3` aur `.venv` ko overwrite ya commit na karein.

```bash
git diff --stat
git diff -- static/index.html | less
python -m pytest -q
git add static/index.html LANDING_PAGE_UPDATE_ROMAN_URDU.md LANDING_PAGE_GITHUB_COMMANDS_ROMAN_URDU.md
git commit -m "Add PTS Farooqabad public landing page"
git push -u origin feature/pts-farooqabad-landing-page
```

GitHub par Pull Request bana kar branch ko `main` mein merge karein. Vercel mein Root Directory `static` hi rehni chahiye. Deployment ke baad website root par landing page, aur `/#portal=reports` par existing portal ka Reports screen open hona chahiye.
