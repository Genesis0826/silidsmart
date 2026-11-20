export const SHORT_STAY_COMMISSION_PERCENT = 5;
export const MONTHLY_RENT_COMMISSION_PERCENT = 3;

export function ownerPlan(unitCount: number) {
  return { name: 'Free owner management', price: 0, managedUnits: unitCount };
}
