import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createSilidSmartService } from '../src/service.mjs';
import { createAppServer } from '../src/server.mjs';
import { PITCH_OWNER_ID, PITCH_PROPERTY_ID, PITCH_EMAIL } from '../src/pitch-seed.mjs';

describe('Opt-in five-unit pitch fixtures', () => {
  it('creates five whole units, free management, private bills and a PHP 500 pending commission without changing other owners', () => {
    const service = createSilidSmartService(':memory:');
    const before = service.getOwnerWorkspace('owner-1');
    const prepared = service.preparePitchDemo(); const w = prepared.workspace;
    assert.equal(prepared.mode, 'created'); assert.equal(w.units.length, 5); assert.equal(w.subscription.monthlyFeePhp, 0);
    assert.equal(w.units.filter(u => u.status === 'Vacant').length, 3);
    assert.ok(w.units.find(u => u.id === 'pitch-demo-unit-2').expectedAvailableFrom);
    assert.equal(w.rentRecords.find(r => r.unitId === 'pitch-demo-unit-3').amountDue, 7000);
    assert.deepEqual(w.utilityRecords.map(r => [r.utilityType, r.amountPhp, r.paymentStatus]).sort(), [['Electricity',1200,'Due'],['Water',300,'Paid']]);
    assert.equal(w.shortStays.length, 4);
    assert.equal(w.shortStays.reduce((sum,s) => sum + s.commissionPhp,0), 500);
    const s = w.commissionStatements[0];
    assert.equal(s.rentTotalPhp, 10000); assert.equal(s.commissionPhp, 500); assert.equal(s.outstandingPhp, 500);
    assert.equal(s.paymentStatus, 'Under review'); assert.equal(s.remittances[0].status, 'Submitted');
    assert.match(s.remittances[0].reference, /^DEMO-NO-FUNDS-/);
    assert.deepEqual(service.getOwnerWorkspace('owner-1'),before);
    assert.equal(service.auth.login(PITCH_EMAIL,'password123').ownerId, PITCH_OWNER_ID);
  });

  it('keeps rehearsal progress by default and restores only the dedicated pitch fixtures when explicitly requested', () => {
    const service = createSilidSmartService(':memory:');
    service.toggleUnitOccupancy({unitId:'unit-2',newStatus:'Occupied'});
    const unrelated = service.getOwnerWorkspace('owner-1');
    service.preparePitchDemo();
    service.toggleUnitOccupancy({unitId:'pitch-demo-unit-1',newStatus:'Occupied'});
    service.updateUtilityRecord('pitch-demo-utility-electricity', {paymentStatus:'Paid',paymentDate:new Date().toISOString().slice(0,10),reference:'DEMO-REHEARSAL-PAID'});
    const before = service.getOwnerWorkspace(PITCH_OWNER_ID);
    const kept = service.preparePitchDemo();
    assert.equal(kept.mode,'kept'); assert.deepEqual(kept.workspace,before);
    const restored = service.preparePitchDemo({restore:true});
    assert.equal(restored.mode,'restored'); assert.equal(restored.workspace.units.length,5);
    assert.equal(restored.workspace.units.find(u=>u.id==='pitch-demo-unit-1').status,'Vacant');
    assert.equal(restored.workspace.utilityRecords.find(r=>r.id==='pitch-demo-utility-electricity').paymentStatus,'Due');
    assert.equal(restored.workspace.commissionStatements[0].outstandingPhp,500);
    assert.deepEqual(service.getOwnerWorkspace('owner-1'),unrelated);
    service.addUnit({propertyId:PITCH_PROPERTY_ID,unitLabel:'Additional rehearsal unit',monthlyRent:6000,deposit:6000});
    assert.throws(()=>service.preparePitchDemo({restore:true}), /additional units/);
    assert.equal(service.getOwnerWorkspace(PITCH_OWNER_ID).units.length,6,'Unexpected inventory blocks scoped restore before deletion');
    service.resetDatabase();
    const rebuilt = service.preparePitchDemo();
    assert.equal(rebuilt.workspace.units.length,5,'The opt-in profile can be rebuilt after global example reset');
    assert.equal(service.auth.login(PITCH_EMAIL,'password123').ownerId,PITCH_OWNER_ID,'The preserved demo account is safely reattached');
  });

  it('supports owner login over HTTP and excludes private fixture data from public and other-owner workspaces', async () => {
    const service = createSilidSmartService(':memory:'); service.preparePitchDemo();
    const server = createAppServer(service);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      const login = await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:PITCH_EMAIL,password:'password123'})});
      assert.equal(login.status,200); const cookie = login.headers.get('set-cookie').split(';')[0];
      const owner = await fetch(`${base}/api/owner/${PITCH_OWNER_ID}/workspace`,{headers:{Cookie:cookie}});
      assert.equal(owner.status,200); assert.equal((await owner.json()).units.length,5);
      assert.equal((await fetch(`${base}/api/owner/owner-1/workspace`,{headers:{Cookie:cookie}})).status,403);
      for(const scope of ['available','all']) {
        const response = await fetch(`${base}/api/public/workspace?availability=${scope}`);
        assert.equal(response.status,200); const data = await response.json();
        const pitchUnits = data.units.filter(u=>u.propertyId===PITCH_PROPERTY_ID);
        assert.equal(pitchUnits.length,scope==='all'?5:3);
        const text = JSON.stringify(data);
        for(const secret of ['DEMO TENANT B','DEMO TENANT C','DEMO-NO-FUNDS','commissionStatements','utilityRecords']) assert.equal(text.includes(secret),false);
      }
    } finally { await new Promise(resolve=>server.close(resolve)); }
  });

  it('CLI makes a consistent backup, is retry-safe, and can prepare an isolated database without touching the live demo file', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(),'silidsmart-pitch-'));
    const dbPath = path.join(folder,'fixture.sqlite');
    const script = fileURLToPath(new URL('../scripts/seed-pitch.mjs',import.meta.url));
    try {
      const run = extra => {
        const result = spawnSync(process.execPath,['--no-warnings',script,'--db',dbPath,...extra],{encoding:'utf8'});
        assert.equal(result.status,0,result.stderr); return JSON.parse(fs.readFileSync(path.join(folder,'pitch-demo-manifest.json')));
      };
      const created = run([]); assert.equal(created.mode,'created'); assert.equal(created.backup,null); assert.equal(created.units.length,5);
      const kept = run([]); assert.equal(kept.mode,'kept'); assert.ok(fs.existsSync(kept.backup)); assert.equal(kept.statementId,created.statementId);
      const backup = new DatabaseSync(kept.backup,{readOnly:true});
      try { assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM units WHERE property_id = ?').get(PITCH_PROPERTY_ID).n,5); }
      finally { backup.close(); }
      const restored = run(['--restore']); assert.equal(restored.mode,'restored'); assert.equal(restored.paymentStatus,'Under review');
      assert.equal(restored.commissionPhp,500); assert.notEqual(restored.statementId,created.statementId);
    } finally {
      // Exact newly-created fixture files only; no recursive deletion.
      for(const name of fs.readdirSync(folder)) fs.unlinkSync(path.join(folder,name));
      fs.rmdirSync(folder);
    }
  });
});
