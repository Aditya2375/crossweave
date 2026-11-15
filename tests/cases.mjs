export const cases = [];
for (const scenario of ["steady", "flip", "flat"])
  for (const window of [40, 80, 120])
    for (const seed of [1, 2026, 4294967295])
      for (const end of [...new Set([window, 120, 160, 240])])
        cases.push({ scenario, window, end, seed });
