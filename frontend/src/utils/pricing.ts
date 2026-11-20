export const SHORT_STAY_COMMISSION_PERCENT = 5;

export function ownerPlan(unitCount: number) {
  if (unitCount <= 4) return { name: 'Free (1–4 units)', price: 0 };
  if (unitCount <= 10) return { name: 'Starter (5–10 units)', price: 99 };
  if (unitCount <= 25) return { name: 'Growth (11–25 units)', price: 199 };
  if (unitCount <= 50) return { name: 'Scale (26–50 units)', price: 349 };
  return { name: 'Custom Plan (>50 units)', price: null };
}
