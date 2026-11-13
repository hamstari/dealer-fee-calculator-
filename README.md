# Dealer Fee Calculator

By America Home Financial.

A small web app that helps contractors price jobs when customers pay with consumer financing, so lender dealer fees don't come out of your profit.

## What it does

Three tabs:

- **Price a job.** Type your cash price, or open *Work it out from my costs* (materials, labor, subs, other, overhead %, profit %). Each financing plan gets a card showing what to charge so you still get your full cash price after the dealer fee, plus a rough monthly payment. If you entered costs, it also shows what your profit drops to if you absorb the fee instead. An optional cash down payment applies the fee only to the financed part.
- **One price for all.** Many lender agreements don't let you charge financed customers more. Enter the share of customers who apply for financing and how many fully declined customers still pay cash. It gives one price for everyone that covers expected fees, plus a picture of 100 customers: who pays cash, who each lender funds, and who's lost.
- **My lenders.** Set up once from your rate sheets. Lenders are in waterfall order (primary, then backup); each has an approval rate and plans (dealer fee, APR, months, and *mix*: the share of that lender's approvals that pick each plan).

It also explains why simply adding the fee % on top leaves you short.

## The math

| | Formula |
|---|---|
| Cash price from costs | `cost ÷ (1 − overhead% − margin%)` |
| Financed price | `(cash − fee × down) ÷ (1 − fee)` |
| Blended price | `cash ÷ (1 − Σ share × fee)` across every plan (shares of closed jobs) |
| Waterfall | lender *n* funds `applicants still undeclined × approval rate`; the rest move to lender *n+1* |

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

Wix runs embedded code in a sandboxed frame, so some browsers may not remember saved lenders between visits. Set your real lenders as the defaults (`DEFAULT_LENDERS` in `js/app.js`), then rebuild, so every visitor starts with them.

## Files

- `index.html`: page layout
- `css/styles.css`: styles (light/dark, mobile, print)
- `js/calc.js`: pure pricing functions (shared by the app and the tests)
- `js/app.js`: UI wiring
- `tests/calc.test.js`: tests
- `scripts/build-embed.js`: builds the single-file `dist/` version

For estimating only. Check your lender agreement and local rules before you change how you price financed jobs.
