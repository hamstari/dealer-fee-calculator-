# Job Price Calculator

By America Home Financial.

A simple one-page calculator that helps contractors estimate a job and price it, including what to charge when the customer finances. Each step has a one-line instruction, every field has a **?** with a short explanation of what to include, and the recommended plan says exactly what to quote. On desktop the inputs sit on the left and the cash price and lender pick on the right; on phones it stacks.

## What it does

1. **Job costs.** Materials (plus an allowance for waste), labor hours and cost per hour, subcontractors, and permits/dumpster/other. Each has a slider and a box for typing an exact amount. Shows the total job cost.
2. **Markup.** Overhead % and profit %, also as sliders.
3. **Cash price**, with a bar showing how it splits into job cost, overhead and profit.
4. **Financing.** Pick the customer's credit score range and priority (lowest price, 0% promo, or lowest payment). The highlighted card is the recommended lender and plan, with what to charge so the dealer fee is covered; below it are other plans the customer qualifies for, and a fold-out lists the ones that don't fit and why.

## Updating lender rates

All lender terms live in **`js/lenders.js`**: for each lender, the same-as-cash and zero-interest fees by term, and the installment-loan table (contractor fee for each term and customer APR), plus loan minimums and credit requirements. Contractors can't change them on the page.

It currently holds the Foundation Finance (07/16/2026) and Regions Bank (02/27/2026) rate sheets. When a new sheet comes out, update the numbers and `RATES_AS_OF`, run `npm run build`, and push to `main`; the live site updates automatically. Lines marked `CHECK` still need confirming with the lender.

## The math

| | Formula |
|---|---|
| Job cost | `materials × (1 + waste%) + hours × rate + subs + other` |
| Price | `job cost ÷ (1 − overhead% − profit%)` |
| Financed price | `price ÷ (1 − dealer fee)` |
| Recommendation | plans the customer qualifies for (credit score, loan limits on the financed price), sorted by dealer fee, or by monthly payment |

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

Wix runs embedded code in a sandboxed frame, so some browsers may not remember a visitor's last inputs. Lender rates come from `js/lenders.js`, so every visitor sees the same rates.

## Files

- `index.html`: page layout
- `css/styles.css`: styles (light/dark, mobile, print)
- `js/calc.js`: pure pricing functions (shared by the app and the tests)
- `js/lenders.js`: lender rate sheet (edit this when rates change)
- `js/app.js`: UI wiring
- `tests/calc.test.js`: tests
- `scripts/build-embed.js`: builds the single-file `dist/` version

For estimating only. Check your lender agreement and local rules before you change how you price financed jobs.
