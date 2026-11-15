# Model and numerical contract

## Generated observations

There are six unitless signals and exactly 240 complete paired observations. These are not asset returns, prices or fitted market factors. End E and length W select zero-based indices [E-W, E), displayed as observations E-W+1 through E, inclusive. W is 40/80/120. E is a whole number from W through 240. Seed is a whole number 1 through 2^32-1. Scenarios are `steady`, `flip` and `flat`. Invalid or unapplied form edits retain the prior applied calculation, including during resize or pair changes.

A single unsigned 32-bit xorshift state is updated with `s ^= s << 13; s ^= s >>> 17; s ^= s << 5`. Treat each update as modulo 2^32. Map it with `(unsigned(s) / 2^32 * 2 - 1) * sqrt(3)`. Draw six values per observation, in the order f,a,b,c,e,h. They approximate uniform innovations on [-sqrt(3),sqrt(3)); this finite deterministic grid is not truly independent or cryptographic randomness. No normal distribution or true random process is claimed.

- A (Anchor) = f
- B (Follower) = 0.8 f + 0.6 a
- C (Counter) = -0.6 f + 0.8 b
- D (Mix) = 0.7 c + 0.3 a
- E (Curve) = f^2 - 1 + 0.25 e
- F (Solo) = h

The `flip` model, the default, changes B's f coefficient to -0.8 at observation 121. Other equations stay unchanged. The `flat` model uses the steady coefficients and replaces F with exactly zero; it is not a combination of the flip and flat scenarios. All six innovations are still consumed, including for F. Changing a window or pair never regenerates a different dataset for the same seed/scenario.

The generator coefficients are not the finite sample's correlations. Sharing an innovation also links B and D. E depends nonlinearly on A; a small Pearson r does not imply independence. A window spanning the flip combines two generation rules. No hypothesis tests or confidence intervals are offered. Correlation does not establish causation or make future diversification reliable.

## Statistics

For n paired values, let dx_i = x_i - mean(x), dy_i = y_i - mean(y), Sxx = sum(dx_i^2), Syy = sum(dy_i^2), Sxy = sum(dx_i dy_i).

- Pearson r = Sxy / (sqrt(Sxx) sqrt(Syy)). It is clipped to [-1,1] to absorb floating-point rounding only.
- Sample covariance = Sxy/(n-1).
- Sample standard deviations = sqrt(Sxx/(n-1)) and sqrt(Syy/(n-1)).
- Exact repeated values are detected before reduction. If either signal is constant, r is undefined, represented as Java NaN / JavaScript null / JSON null / UI NA. Its covariance is zero. A constant's diagonal is undefined, not one. A varying signal's diagonal rounds to one.

Calculations first subtract the window's first value, then use compensated sums for the shifted means and centered squares/cross-products. This reduces cancellation for these small, bounded synthetic signals. It is not a general arbitrary-precision numerical library; no guarantee is made for arbitrary near-constant, subnormal or extreme external data. The internal pair helper validates finite inputs of magnitude at most 1e6 and at most 240 entries, but the app only supplies the generator's ordinary-scale output. No files or external input vectors are accepted.

Each matrix uses the same complete observation window for every pair, with no pairwise deletion or imputation. The unrounded nonconstant submatrix is positive semidefinite up to floating-point rounding. Rounded cell values are display-only, not a substitute for that matrix.

## Plots and comparisons

The matrix and its scatter use the applied window. The scatter shows all n pairs, including coincident points. The two axis ranges adapt independently to the selected data and include padding; they are not standardized scores or equal aspect scales. The first-window comparison always uses observations 1 through W for the same signals/scenario/seed. Delta r = current r - first-window r, between -2 and +2, in unitless correlation points. If either is undefined, the difference is also undefined. Matrix and headline r use two decimals; numerical details use six. Rounding does not turn an estimate into a proof or exactly zero correlation.

Rolling values recompute Pearson r for each end W through 240, using [end-W,end). They are not recursive estimates using rounded cells. The entire generated history is shown, including windows after the selected end. This is an exploratory view, not an as-of backtest. Consecutive windows overlap and are not independent estimates. The solid marker is the applied end. In the flip scenario, the dashed vertical line at 120.5 indicates the boundary after observation 120, not a fitted break or a trading signal. The rolling vertical axis is fixed [-1,+1]. Undefined curves have no path or fabricated marker.

The heatmap color range is fixed [-1,1], with pale neutral at zero, copper negative and violet positive. NA is separate gray with explicit text. Color is a redundant cue alongside signed numbers and accessible button labels. On narrow displays the full matrix scrolls in a labelled, focusable region. Native buttons and selectors work without hover. Scatter and rolling SVGs adapt to actual pixel width. No cross-browser equivalence beyond tested environments is promised.

## Verification

Java hand fixtures cover affine signs, sample covariance/standard deviation, a zero-correlation nonlinear fixture and exact constants including .667. A representative grid of supported scenarios, window lengths, endpoint boundaries and seeds checks symmetry, boundedness, diagonals, undefined values and equality of rolling selected points with matrix entries. Browser/Java parity compares every generated observation, all six statistics for all 36 current and baseline cells, and all 36 complete rolling curves. It is not just an aggregate comparison.

An independent Python xorshift generator checks all generated observations. NumPy sample covariance/standard deviation/mean and SciPy `pearsonr` check current and baseline statistics. NumPy covariance eigenvalues test positive semidefiniteness. SciPy independently checks every rolling endpoint for three pairs including the nonlinear and constant cases. Fixtures deliberately check constants before invoking references that divide by zero. Test-only dependencies are pinned and not shipped to the browser.

## References

- SciPy Pearson r formula, constant and near-constant behavior, nonlinear dependence caveat: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html
- NumPy correlation/covariance relationship and floating-point cautions: https://numpy.org/doc/stable/reference/generated/numpy.corrcoef.html
- NIST scatter plots and association versus causation: https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm
- NIST sample covariance: https://www.itl.nist.gov/div898/software/dataplot/refman2/ch2/covarian.pdf
- Covariance positive semidefiniteness: https://statproofbook.github.io/P/covmat-psd.html
- UNHCR correlation visualization, signed palettes and numeric annotation: https://dataviz.unhcr.org/chart-types/correlation/
- Seaborn diverging palette guidance: https://seaborn.pydata.org/tutorial/color_palettes.html

Equations above define this demonstration; linked sources do not validate the generator as a market model.
