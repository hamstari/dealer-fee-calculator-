# Dealer Fee Calculator

A small web app that helps contractors price jobs when customers pay with consumer financing, so lender dealer fees don't come out of your profit.

## What it does

1. **Cash price.** Build it from job costs (materials, labor, subs, other), plus overhead and profit as a % of price. Or type in a price you already have.
2. **Lenders & plans.** Add each lender you work with, and under each one enter its plans' dealer fees, customer APR and term from that lender's rate sheet.
3. **Financed price per plan**, grouped by lender. The price that still nets you your full cash price after the fee, with the fee in dollars, an estimated monthly payment, and what your profit drops to if you absorb the fee instead.
4. **One price for everyone.** Many lender agreements don't let you charge financed customers more. Enter roughly what % of customers lands on each plan (across all lenders) and it gives a single price that covers the expected fees, plus your lowest net on any one job.

It also shows why simply adding the fee % on top leaves you short.

## The math

| | Formula |
|---|---|
| Cash price from costs | `cost ÷ (1 − overhead% − margin%)` |
| Financed price | `(cash − fee × down) ÷ (1 − fee)` |
| Blended price | `cash ÷ (1 − Σ share × fee)` across every plan |

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
npm start      # serves on http://localhost:3000
npm test       # unit tests for the pricing math (Node 18+)
```

Inputs are saved in your browser (localStorage), so they're still there next time.

## Files

- `index.html`: page layout
- `css/styles.css`: styles (light/dark, mobile, print)
- `js/calc.js`: pure pricing functions (shared by the app and the tests)
- `js/app.js`: UI wiring
- `tests/calc.test.js`: tests

For estimating only. Check your lender agreement and local rules before you change how you price financed jobs.
