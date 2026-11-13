# Job Price Calculator

By America Home Financial.

A simple one-page calculator that helps contractors estimate a job and price it, including what to charge when the customer finances.

## What it does

1. **What will the job cost you?** Materials (plus an allowance for waste), labor as hours × rate, subcontractors, and permits/dumpster/other. Shows the total job cost.
2. **What do you need on top?** Overhead % and profit %, with plain-English hints.
3. **Your price.** The cash price, its markup on cost, and a bar showing how it splits into job cost, overhead and profit.
4. **If the customer finances, charge:** a list of financing plans with the price that covers each plan's dealer fee, so you still get your full price. Plans (lender, plan name, dealer fee) are edited under *Edit financing plans*.

Fold-outs explain why simply adding the fee % on top leaves you short, and how the math works.

## The math

| | Formula |
|---|---|
| Job cost | `materials × (1 + waste%) + hours × rate + subs + other` |
| Price | `job cost ÷ (1 − overhead% − profit%)` |
| Financed price | `price ÷ (1 − dealer fee)` |

## Live site

Once GitHub Pages is on, the calculator is at **https://hamstari.github.io/dealer-fee-calculator-/** (single-file version at `/embed.html`). Every push to `main` tests and redeploys it.

To turn Pages on (one time): repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
npm start      # serves on http://localhost:3000
npm test       # unit tests for the pricing math (Node 18+)
```

Inputs are saved in your browser (localStorage), so they're still there next time.

## Put it on a Wix site

`dist/dealer-fee-calculator.html` is the whole app in one file (rebuild it with `npm run build` after changes).

1. Open your site in the Wix Editor and go to the page you want.
2. Click **Add Elements (+)** → **Embed Code** → **Embed HTML**.
3. Click **Enter Code**, pick **Code**, paste in the full contents of `dist/dealer-fee-calculator.html`, and click **Update**.
4. Drag the box to the width you want and make it tall (about 1,500 px). Anything taller scrolls inside the box.
5. Switch to the mobile view and make the box taller there too (about 2,200 px).
6. **Publish**.

Wix runs embedded code in a sandboxed frame, so some browsers may not remember saved lenders between visits. Set your real plans as the defaults (`DEFAULT_PLANS` in `js/app.js`), then rebuild, so every visitor starts with them.

## Files

- `index.html`: page layout
- `css/styles.css`: styles (light/dark, mobile, print)
- `js/calc.js`: pure pricing functions (shared by the app and the tests)
- `js/app.js`: UI wiring
- `tests/calc.test.js`: tests
- `scripts/build-embed.js`: builds the single-file `dist/` version

For estimating only. Check your lender agreement and local rules before you change how you price financed jobs.
