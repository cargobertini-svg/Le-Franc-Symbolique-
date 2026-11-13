export const FS_PER_SECOND = 1;
export const FCFA_PER_FS = 0.01;
export const REFERRAL_FS = 5000;
export const GIFTS = [{ name: 'Micro', cost: 100 }, { name: 'Flamme', cost: 500 }, { name: 'Couronne', cost: 1000 }];
export const SLEEP_MINUTES = [15, 30, 60];
export const canWithdraw = (amount: number, balance: number) => Number.isInteger(amount) && amount >= 500 && amount <= balance;
export const earnFs = (seconds: number) => Math.floor(Math.max(0, seconds)) * FS_PER_SECOND;
export function parseLrc(text: string) {
  return text.split('\n').flatMap(line => { const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/); return m ? [{ time: Number(m[1]) * 60 + Number(m[2]), text: m[3]?.trim() || '♪' }] : []; }).sort((a,b) => a.time-b.time);
}