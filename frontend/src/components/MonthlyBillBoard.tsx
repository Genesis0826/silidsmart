import { useState } from 'react';
import type { Property, Unit, RentRecord, UtilityRecord } from '../types';
import { monthlyBillBoard } from '../utils/billing';
import './PrivateLedger.css';

type Props = { units: Unit[]; properties: Property[]; rent: RentRecord[]; utilities: UtilityRecord[]; onRent: ()=>void; onUtilities: ()=>void };
const pesos=(n:number)=>n.toLocaleString('en-PH',{style:'currency',currency:'PHP'});
const currentMonth=()=>{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  return `${parts.find(p=>p.type==='year')?.value}-${parts.find(p=>p.type==='month')?.value}`;
};

export function MonthlyBillBoard({units,properties,rent,utilities,onRent,onUtilities}:Props) {
  const [month,setMonth]=useState(currentMonth);
  const rows=monthlyBillBoard(units,rent,utilities,month);
  const totals=rows.reduce((sum,row)=>({billed:sum.billed+Math.round(row.total.totalPhp*100),paid:sum.paid+Math.round(row.total.markedPaidPhp*100)}),{billed:0,paid:0});
  const cell=(bill:ReturnType<typeof monthlyBillBoard>[number]['rent'])=><><strong className="mono-num">{bill.status==='Not recorded'?'—':pesos(bill.totalPhp)}</strong><br/><span>{bill.status}</span></>;
  return <section className="card billing-workspace" aria-labelledby="bill-board-title">
    <h2 id="bill-board-title">Monthly Bill Board</h2>
    <p>See your recorded rent, electricity, water and Wi-Fi bills by unit. Paid means marked paid by the owner; it is not a bank or gateway confirmation. A missing bill is shown as Not recorded.</p>
    <div className="commission-toolbar">
      <label htmlFor="bill-board-month">Billing month<input className="input" id="bill-board-month" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
      <button className="btn btn-secondary" onClick={onRent}>Manage rent records</button><button className="btn btn-secondary" onClick={onUtilities}>Manage utility bills</button>
    </div>
    <p className="mono-num" style={{margin:'16px 0'}}>Recorded charges: <strong>{pesos(totals.billed/100)}</strong> · Marked paid: <strong>{pesos(totals.paid/100)}</strong> · Unpaid: <strong>{pesos((totals.billed-totals.paid)/100)}</strong></p>
    <div className="private-ledger-scroll"><table className="private-ledger-table"><thead><tr><th>Property / unit</th><th>Rent</th><th>Electricity</th><th>Water</th><th>Wi-Fi</th><th>Total recorded</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.unit.id}><td><strong>{row.unit.unitLabel}</strong><br/>{properties.find(p=>p.id===row.unit.propertyId)?.name}</td><td>{cell(row.rent)}</td><td>{cell(row.electricity)}</td><td>{cell(row.water)}</td><td>{cell(row.wifi)}</td><td>{cell(row.total)}</td></tr>)}{!rows.length&&<tr><td colSpan={6}>Add a unit to start your monthly bill board.</td></tr>}</tbody></table></div>
    <p style={{marginTop:'16px'}}>Scroll the table horizontally on smaller screens to see every bill type. This is a private owner overview. Tenant bills, automatic reminders, online payment and receipts are planned pilot features.</p>
  </section>;
}
