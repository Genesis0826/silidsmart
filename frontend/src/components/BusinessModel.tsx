import { useEffect, useState } from 'react';
import './PrivateLedger.css';

type Quote={hypothetical:boolean;chargedPhp:number;percent:number;proposedCommissionPhp:number;message:string};
type Readiness={mode:string;checkoutEnabled:boolean;testCredentialsConfigured:boolean;message:string};
const pesos=(n:number)=>n.toLocaleString('en-PH',{style:'currency',currency:'PHP'});
export function BusinessModel({unitCount}:{unitCount:number}) {
  const [kind,setKind]=useState('Monthly rent'); const [channel,setChannel]=useState('Planned online checkout');
  const [amount,setAmount]=useState('4500'); const [nights,setNights]=useState('3'); const [quote,setQuote]=useState<Quote|null>(null);
  const [readiness,setReadiness]=useState<Readiness|null>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  useEffect(()=>{const controller=new AbortController(); void fetch('/api/owner/payment-readiness',{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Payment readiness is unavailable.');setReadiness(await r.json());}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}); return()=>controller.abort();},[]);
  const reset=()=>setQuote(null);
  return <section className="card billing-workspace" aria-labelledby="business-model-title">
    <h2 id="business-model-title">Free management and proposed commissions</h2>
    <p>You manage <strong>{unitCount} units</strong>. Listing and core management are free for all portfolio sizes. There is no monthly subscription.</p>
    <div className="private-ledger-scroll"><table className="private-ledger-table payment-policy-table"><thead><tr><th>Payment</th><th>Proposed owner-paid fee</th></tr></thead><tbody>
      <tr><td>Monthly accommodation rent through planned checkout</td><td>3%</td></tr><tr><td>SilidSmart short stays of 1–29 nights through planned checkout</td><td>5%</td></tr><tr><td>Utilities, deposits, taxes and other charges</td><td>0% platform commission</td></tr><tr><td>Cash or external transfers recorded manually</td><td>0% under this proposed model</td></tr>
    </tbody></table></div>
    <p style={{margin:'16px 0'}}>These rates are pilot proposals. Online checkout and automatic deductions are not available. Gateway processing, VAT, split-payment costs and deposit/refund costs must be confirmed before launch. Renters browse and inquire free.</p>
    <h3>Illustrate a proposed fee</h3>
    <form onSubmit={async e=>{e.preventDefault(); if(busy)return;setBusy(true);setError('');setQuote(null);try{const r=await fetch('/api/owner/payment-quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,channel,rentPhp:Number(amount),nights:Number(nights)})});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||'Quote unavailable.');setQuote(data);}catch(e){setError(e instanceof Error?e.message:'Quote unavailable.');}finally{setBusy(false);}}}>
      <fieldset disabled={busy}><div className="commission-toolbar">
        <label htmlFor="quote-kind">Payment type<select className="select" id="quote-kind" value={kind} onChange={e=>{setKind(e.target.value);reset();}}><option>Monthly rent</option><option>Short stay</option><option>Utilities</option></select></label>
        <label htmlFor="quote-channel">Payment channel<select className="select" id="quote-channel" value={channel} onChange={e=>{setChannel(e.target.value);reset();}}><option>Planned online checkout</option><option>Cash or external transfer</option></select></label>
        <label htmlFor="quote-amount">{kind==='Utilities'?'Utility amount (₱)':'Accommodation rent only (₱)'}<input className="input" id="quote-amount" type="number" min="0.01" max="10000000" step="0.01" required value={amount} onChange={e=>{setAmount(e.target.value);reset();}}/></label>
        {kind==='Short stay'&&<label htmlFor="quote-nights">Nights<input className="input" id="quote-nights" type="number" min="1" max="29" step="1" required value={nights} onChange={e=>{setNights(e.target.value);reset();}}/></label>}
        <button className="btn btn-primary" disabled={busy}>{busy?'Calculating…':'Preview proposed fee'}</button>
      </div></fieldset>
    </form>
    {error&&<p role="alert">{error}</p>}{quote&&<div role="status" style={{margin:'16px 0'}}><strong className="mono-num">Proposed fee: {pesos(quote.proposedCommissionPhp)} ({quote.percent}%)</strong><p>{quote.message}</p><p>Amount actually charged: {pesos(quote.chargedPhp)}</p></div>}
    <h3>Payment integration status</h3>
    <p>{readiness?readiness.message:'Checking gateway readiness…'}</p>
    {readiness&&<p>Sandbox credentials: {readiness.testCredentialsConfigured?'Detected; owner routing still requires setup':'Not configured'}. No live payments, fund holds or refund guarantees.</p>}
    <button className="btn btn-secondary" disabled>Online checkout not available</button>
    <p style={{marginTop:'16px'}}>Earlier manual short-stay commission examples are retained separately as legacy records. They do not demonstrate online payment, payouts or revenue under this proposal.</p>
  </section>;
}
