FLYMILY fixed package

Key fixes:
- Preserve shared app state instead of overwriting it in main.js
- Expose state on window/globalThis for debugging
- Fix broken active tab CSS rule
- Use [data-tab] selectors consistently
- navigation.js now focuses overview for expense/journal items
