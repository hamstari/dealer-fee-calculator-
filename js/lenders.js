/*
 * LENDER RATE SHEETS — the only file to edit when rates change.
 *
 * Source: America Home Financial "Financing Options" contractor rate sheets
 *   Foundation Finance (07/16/2026) and Regions Bank (2/27/26).
 *
 * Per lender:
 *   name           shown to contractors
 *   minScore       lowest credit score the lender approves
 *   promoMinScore  lowest credit score for same-as-cash / zero-interest plans (defaults to minScore)
 *   minLoan/maxLoan  loan amount limits for every plan (optional)
 *   note           shown with the recommendation
 *   sac            same-as-cash: { months: contractor fee % }
 *   zil            zero-interest loan, equal payments: { months: contractor fee % }
 *   installment    standard loans. `aprs` lists the customer APR for each row of the sheet;
 *                  each term lists the contractor fee for each row (null = not offered).
 *
 * Items marked CHECK are read from the sheet as printed but still need confirming.
 */
window.EXAMPLE_RATES = false;
window.RATES_AS_OF = 'Foundation Finance 07/16/2026 · Regions Bank 02/27/2026';

window.LENDER_SHEETS = [
  {
    name: 'Foundation Finance',
    // Tiers: 1 = 725+, 2 = 680–724, 3 = 650–679, 4 = 600–649, 5 = 550–599
    // (Sheet prints Tier 5 as "550 – 559"; confirmed it means 550–599.)
    minScore: 550,
    // Promo plans use the lender's credit minimum (confirmed).
    note: '',
    sac: { 6: 3, 12: 6, 18: 9, 24: 14 },
    zil: { 12: 8.5, 24: 13.5, 36: 18, 48: 22, 60: 25 },
    installment: {
      // (Sheet prints the 5th rate as "69%"; confirmed it means 6.9%.)
      aprs: [11.9, 9.9, 8.9, 7.9, 6.9, 5.9],
      note: 'Lowest APRs are for well-qualified customers.',
      terms: [
        { years: 5, fees: [0, 4, 7, 9.5, 12, 14] },
        { years: 10, fees: [0, 4, 7, 9.5, 12, 14], minLoan: 7500 },
        { years: 12, fees: [0, 4, 7, 9.5, 12, 14], minLoan: 7500 },
        { years: 15, fees: [0, 4, 7, 9.5, 12, 14], minLoan: 25000, minScore: 680 },
        { years: 20, fees: [0, 5.5, 8.5, 11, 13.5, 15.5], minLoan: 35000, minScore: 680 },
      ],
    },
  },
  {
    name: 'Regions Bank',
    // Tier 1 = 680+. 620–679 may get a counter-offer from the bank.
    minScore: 680,
    note: 'Customers with 620–679 credit may get a counter-offer from Regions.',
    sac: { 6: 4.25, 9: 4.5, 12: 6, 18: 11.95, 24: 15.55 },
    zil: { 12: 10, 24: 12.75, 36: 14.75, 48: 18 },
    installment: {
      // CHECK: sheet prints the 2nd rate as 9.99%, higher than the 0%-fee rate of 8.99%.
      // Kept as printed until confirmed with Regions.
      aprs: [8.99, 9.99, 7.99, 6.99, 4.99, 2.99],
      note: 'Lowest APRs are for well-qualified customers.',
      terms: [
        { years: 5, fees: [0, 3.5, 6.5, 7.5, 12, 20.5], minLoan: 3500 },
        { years: 7, fees: [0, 3.75, 8, 10.5, 14, null], minLoan: 3500 },
        { years: 10, fees: [0, 4.75, 10, 12.5, 17.65, null], minLoan: 7500 },
        { years: 12, fees: [0, 5, 10.75, 13.25, 19.3, null], minLoan: 10000 },
      ],
    },
  },
];
