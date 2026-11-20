import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_POLICY, paymentReadiness, quoteProposedPayment, createPayMongoSandboxAdapter } from '../src/payments.mjs';
import { ValidationError, createSilidSmartService } from '../src/service.mjs';
import { createAppServer } from '../src/server.mjs';
import { monthlyBillBoard, rentMonthKey } from '../../frontend/src/utils/billing.ts';

describe('Commission-only pilot preparation',()=>{
  it('quotes 3% monthly and 5% short accommodation rent without charging money; cash and utilities remain zero',()=>{
    const quote=(kind,rentPhp=4500,channel='Planned online checkout',nights=3)=>quoteProposedPayment({kind,rentPhp,channel,nights},ValidationError);
    assert.equal(quote('Monthly rent').proposedCommissionPhp,135);
    assert.equal(quote('Short stay',4000).proposedCommissionPhp,200);
    assert.equal(quote('Monthly rent',.17).proposedCommissionPhp,.01);
    assert.equal(quote('Utilities').proposedCommissionPhp,0);
    assert.equal(quote('Short stay',4000,'Cash or external transfer').proposedCommissionPhp,0);
    for(const kind of ['Monthly rent','Short stay','Utilities']) { assert.equal(quote(kind).chargedPhp,0);assert.equal(quote(kind).hypothetical,true); }
    for(const bad of [-1,0,'4500',NaN,Infinity,10_000_001,.001]) assert.throws(()=>quote('Monthly rent',bad),ValidationError);
    for(const nights of [0,30,31,1.5,'3']) assert.throws(()=>quote('Short stay',4000,'Planned online checkout',nights),ValidationError);
  });
  it('reports configuration safely and never enables unsupported owner splits, even if a test key exists',()=>{
    assert.equal(PAYMENT_POLICY.monthlyFeePhp,0);
    const result=paymentReadiness({PAYMONGO_SECRET_KEY:'sk_test_dummyfixture'});
    assert.equal(result.testCredentialsConfigured,true); assert.equal(result.checkoutEnabled,false);
    assert.equal(JSON.stringify(result).includes('dummyfixture'),false);
    assert.equal(paymentReadiness({PAYMONGO_SECRET_KEY:'sk_live_dummyfixture'}).testCredentialsConfigured,false);
  });
  it('prepares a test-only v2 adapter, keeps keys server-side and rejects live or malformed provider replies',async()=>{
    const details={reference:'TEST-ONLY',lineItems:[{name:'Sandbox fixture',amount:450000}],successUrl:'http://127.0.0.1:5173/',cancelUrl:'http://127.0.0.1:5173/'};
    let calls=0;
    const adapter=createPayMongoSandboxAdapter({secretKey:'sk_test_dummyfixture',fetchImpl:async(url,options)=>{
      calls++;assert.equal(url,'https://api.paymongo.com/v2/checkout_sessions');
      const body=JSON.parse(options.body);assert.deepEqual(body.data.attributes.payment_method_types,['qrph']);
      assert.equal(body.data.attributes.line_items[0].currency,'PHP');
      return {ok:true,json:async()=>({data:{id:'cs_fixture',attributes:{livemode:false,checkout_url:'https://checkout.paymongo.com/fixture'}}})};
    }});
    assert.equal((await adapter.createTestSession(details)).paid,false);assert.equal(calls,1);
    await assert.rejects(adapter.createTestSession({...details,lineItems:[{name:'Bad',amount:1.2}]}));assert.equal(calls,1);
    assert.throws(()=>createPayMongoSandboxAdapter({secretKey:'sk_live_dummyfixture'}));
    const wrong=createPayMongoSandboxAdapter({secretKey:'sk_test_dummyfixture',fetchImpl:async()=>({ok:true,json:async()=>({data:{id:'cs_live',attributes:{livemode:true,checkout_url:'https://checkout.paymongo.com/live'}}})})});
    await assert.rejects(wrong.createTestSession(details),/test-mode/);
  });
  it('builds the owner board from actual month records, preserves missing bills, and reconciles centavos without inventing online payments',()=>{
    assert.equal(rentMonthKey('November 2026'),'2026-11'); assert.equal(rentMonthKey('Unknown 2026'),null);
    const units=[{id:'a'},{id:'b'}];
    const rent=[{unitId:'a',month:'November 2026',amountDue:7000,paymentStatus:'Due'},{unitId:'a',month:'October 2026',amountDue:999,paymentStatus:'Paid'}];
    const utility=[{unitId:'a',billingMonth:'2026-11',utilityType:'Water',amountPhp:300.25,paymentStatus:'Paid'},{unitId:'a',billingMonth:'2026-11',utilityType:'Wi-Fi',amountPhp:499.75,paymentStatus:'Overdue'},{unitId:'foreign',billingMonth:'2026-11',utilityType:'Water',amountPhp:9000,paymentStatus:'Paid'}];
    const rows=monthlyBillBoard(units,rent,utility,'2026-11');
    assert.equal(rows[0].total.totalPhp,7800);assert.equal(rows[0].total.markedPaidPhp,300.25);assert.equal(rows[0].total.unpaidPhp,7499.75);
    assert.equal(rows[0].electricity.status,'Not recorded');assert.equal(rows[0].wifi.status,'Overdue');assert.equal(rows[0].water.status,'Paid (manual)');
    assert.equal(rows[1].rent.status,'Not recorded'); assert.equal(rows[1].total.totalPhp,0);
  });
  it('protects readiness/quotes by role, persists Wi-Fi privately, and leaves every ledger unchanged when quoting',async()=>{
    const service=createSilidSmartService(':memory:');const server=createAppServer(service);
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
    const request=(path,options={})=>fetch(base+path,options);
    try {
      assert.equal((await request('/api/owner/payment-readiness')).status,401);
      const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'maria.santos@silidsmart.ph',password:'password123'})});
      const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.equal(login.status,200);
      const before=service.getOwnerWorkspace('owner-1');
      const r=await request('/api/owner/payment-quotes',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'Monthly rent',rentPhp:4500,channel:'Planned online checkout'})});
      assert.equal(r.status,200);assert.equal((await r.json()).chargedPhp,0);assert.deepEqual(service.getOwnerWorkspace('owner-1'),before);
      const ready=await request('/api/owner/payment-readiness',{headers:{Cookie:cookie}});assert.equal((await ready.json()).checkoutEnabled,false);
      const archived=await request('/api/owner/commission-statements',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({billingMonth:'2020-10'})});
      assert.equal(archived.status,409);assert.equal((await archived.json()).error.code,'LEGACY_COMMISSION_READ_ONLY');
      const bill=await request('/api/owner/utility-records',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({unitId:'unit-2',utilityType:'Wi-Fi',billingMonth:'2026-11',amountPhp:499.75,dueDate:'2026-11-30',paymentStatus:'Due',paymentDate:null,reference:''})});
      assert.equal(bill.status,201);
      assert.ok(service.getOwnerWorkspace('owner-1').utilityRecords.some(b=>b.utilityType==='Wi-Fi'));
      assert.equal(JSON.stringify(service.getPublicWorkspace()).includes('utilityType'),false);
    } finally {await new Promise(r=>server.close(r));}
  });
});
