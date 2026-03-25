# FLYMILY — GitHub Ready

גרסה מסודרת יותר של הפרויקט, מוכנה להעלאה ל-GitHub.

## מה תוקן
- תוקן באג בטעינת journal שבו נעשה שימוש במשתנה `id` שלא הוגדר.
- נמנעה הרשמה כפולה של event listeners בכפתורי המפה.
- תוקנה מחיקה בטוחה של localStorage בזמן logout.
- נוקו `id` כפולים של כפתורי logout במודאלים.
- נוקו שברי HTML אחרי `</html>`.
- תוקנו שגיאות תחביר ברורות ב-CSS.

## קבצים עיקריים
- `index.html`
- `firebase.js`
- `script.js`
- `style.css`

## פריסה
זהו פרויקט סטטי פשוט. אפשר להעלות כמו שהוא ל-GitHub ולהריץ דרך GitHub Pages או כל static host.

## לפני פרודקשן
כדאי מאוד לבדוק גם:
- Firestore Security Rules
- Firebase Auth allowed domains
- בדיקות מובייל ידניות
- בדיקות import/export ו-share mode
