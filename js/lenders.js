/*
 * LENDER RATE SHEET — the only file to edit when rates change.
 *
 * !!! THESE ARE EXAMPLE NUMBERS, NOT REAL LENDER TERMS !!!
 * Replace them with the real rate sheets, then set EXAMPLE_RATES to false
 * (that removes the "example rates" notice on the page).
 *
 * Lender fields:
 *   name      shown to contractors
 *   minLoan   smallest loan amount the lender will do ($)
 *   maxLoan   largest loan amount ($)
 *   plans     the lender's financing plans
 *
 * Plan fields:
 *   name      shown to contractors, e.g. "12 months same-as-cash"
 *   fee       dealer fee the contractor pays, % of the loan amount
 *   apr       customer's interest rate (0 for no-interest plans)
 *   months    loan term in months
 *   minScore  lowest credit score the plan approves
 *   promo     true if the customer pays no interest for a while
 *   note      optional short note shown under the plan, e.g. what happens after the promo
 */
window.EXAMPLE_RATES = true;

window.LENDERS = [
  {
    name: 'Lender A',
    minLoan: 2500,
    maxLoan: 75000,
    plans: [
      { name: '12 months same-as-cash', fee: 6, apr: 0, months: 12, minScore: 680, promo: true, note: 'Interest applies if not paid off in 12 months.' },
      { name: '18 months no interest', fee: 9, apr: 0, months: 18, minScore: 700, promo: true, note: 'Interest applies if not paid off in 18 months.' },
      { name: '0% APR for 60 months', fee: 14, apr: 0, months: 60, minScore: 720, promo: true },
    ],
  },
  {
    name: 'Lender B',
    minLoan: 1000,
    maxLoan: 100000,
    plans: [
      { name: '9.99% APR, 10 years', fee: 3, apr: 9.99, months: 120, minScore: 640 },
      { name: '6.99% APR, 7 years', fee: 7, apr: 6.99, months: 84, minScore: 700 },
      { name: '17.99% APR, 5 years', fee: 8, apr: 17.99, months: 60, minScore: 580 },
    ],
  },
];
