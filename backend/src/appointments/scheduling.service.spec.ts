import { SchedulingService } from './scheduling.service';

describe('SchedulingService.offered', () => {
  const svc = new SchedulingService(null as any);
  const doctor = { slotTimes: JSON.stringify(['09:00', '16:30']), workDays: '1,2,3,4,5' };

  it('skips days the doctor does not work', () => {
    const saturday = new Date(2026, 8, 26, 6, 0); // Sat 26 Sep 2026
    const slots = svc.offered(doctor, 2, saturday); // Sat + Sun
    expect(slots).toEqual([]);
  });

  it('only returns slots at least 15 minutes ahead, in order', () => {
    const monday = new Date(2026, 8, 28, 16, 20); // Mon 16:20 -> 16:30 is too close
    const slots = svc.offered(doctor, 2, monday);
    expect(slots.map((d) => `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`)).toEqual(['29 9:00', '29 16:30']);
  });

  it('isOffered accepts exact slot times only', () => {
    const t = svc.offered(doctor, 7)[0];
    expect(svc.isOffered(doctor, t)).toBe(true);
    expect(svc.isOffered(doctor, new Date(t.getTime() + 60_000))).toBe(false);
  });
});
