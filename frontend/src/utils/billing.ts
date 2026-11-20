import type { RentRecord, UtilityRecord, Unit } from '../types';

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function rentMonthKey(value: string): string | null {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const match = /^(\w+) (\d{4})$/.exec(value);
  const month = match ? months.indexOf(match[1]) : -1;
  return match && month >= 0 ? `${match[2]}-${String(month+1).padStart(2,'0')}` : null;
}
type Bill = { cents: number; paymentStatus: 'Paid' | 'Due' | 'Overdue' };
export function summarizeBills(bills: Bill[]) {
  const total = bills.reduce((sum,b) => sum+b.cents,0);
  const paid = bills.filter(b=>b.paymentStatus==='Paid').reduce((sum,b)=>sum+b.cents,0);
  const status = !bills.length ? 'Not recorded' : bills.every(b=>b.paymentStatus==='Paid') ? 'Paid (manual)'
    : bills.some(b=>b.paymentStatus==='Overdue') ? 'Overdue' : paid > 0 ? 'Partly marked paid' : 'Due';
  return { totalPhp: total/100, markedPaidPhp: paid/100, unpaidPhp: (total-paid)/100, status };
}
export function monthlyBillBoard(units: Unit[], rent: RentRecord[], utilities: UtilityRecord[], month: string) {
  return units.map(unit => {
    const monthlyRent = rent.filter(r=>r.unitId===unit.id && rentMonthKey(r.month)===month).map(r=>({cents:Math.round(r.amountDue*100),paymentStatus:r.paymentStatus}));
    const bills = utilities.filter(b=>b.unitId===unit.id && b.billingMonth===month);
    const type = (name: UtilityRecord['utilityType']) => summarizeBills(bills.filter(b=>b.utilityType===name).map(b=>({cents:Math.round(b.amountPhp*100),paymentStatus:b.paymentStatus})));
    const combined = [...monthlyRent,...bills.map(b=>({cents:Math.round(b.amountPhp*100),paymentStatus:b.paymentStatus}))];
    return { unit, rent:summarizeBills(monthlyRent), electricity:type('Electricity'), water:type('Water'), wifi:type('Wi-Fi'), total:summarizeBills(combined) };
  });
}
