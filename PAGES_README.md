# GitHub Pages – הגדרת דיפלוי תקין

1) בריפו: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
2) **Settings → Actions → General → Workflow permissions = Read and write permissions**.
3) ודא שאין Environment בשם `github-pages` שדורש אישור ידני; אם יש – אשר את הדיפלוי הראשון.
4) שים את הקבצים הסטטיים (index.html, style.css, script.js, firebase.js וכן הלאה) בנתיב שבחרת:
   - שורש הריפו → השאר `path: .` בקובץ ה־workflow
   - תיקיית `docs/` → שנה ל־`path: docs`
5) בצע commit לקובץ הזה: `.github/workflows/deploy-pages.yml` ו־push ל־`main`.
6) עקוב אחרי הטאב **Actions**; ה־Job אמור להסתיים ב־`✅ deployed to github-pages`.

> אם אתה מעדיף בלי Actions: Settings → Pages → Source = Deploy from a branch → `gh-pages` / (root).
