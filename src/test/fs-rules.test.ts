import { describe,it,expect } from 'vitest';
import { earnFs, FCFA_PER_FS, REFERRAL_FS, GIFTS, canWithdraw, SLEEP_MINUTES, parseLrc } from '@/lib/fs-rules';
describe('FS rules',()=>{
 it('credits one FS per complete listening second',()=>expect(earnFs(45.9)).toBe(45));
 it('converts 100 FS into one FCFA',()=>expect(100*FCFA_PER_FS).toBe(1));
 it('uses a 5000 FS referral value',()=>expect(REFERRAL_FS).toBe(5000));
 it('uses the latest gift prices',()=>expect(GIFTS.map(g=>g.cost)).toEqual([100,500,1000]));
 it('enforces the 500 FS withdrawal minimum',()=>{expect(canWithdraw(499,1000)).toBe(false);expect(canWithdraw(500,1000)).toBe(true);});
 it('rejects insufficient withdrawal balances',()=>expect(canWithdraw(1000,999)).toBe(false));
 it('offers the requested sleep durations',()=>expect(SLEEP_MINUTES).toEqual([15,30,60]));
 it('reads exact karaoke timestamps',()=>expect(parseLrc('[00:45.50]Refrain')[0]).toEqual({time:45.5,text:'Refrain'}));
});