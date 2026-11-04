// Run: npm test (or: node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuctionState, parseCSV, rowsFromCSV, rowsFromJSON, formatAuctionDate, buildICS, detroitDay, dayToISO } from '../src/auction.js';

// Noon in Detroit on Wed Nov 4, 2026 (EST, UTC-5)
const NOW = new Date('2026-11-04T17:00:00Z');
const at = (date, extra = {}) => [{ date, ...extra }];

test('getAuctionState: no rows', () => {
  assert.deepEqual(getAuctionState([], NOW, 30), { state: 'none', auction: null });
  assert.deepEqual(getAuctionState(null, NOW, 30), { state: 'none', auction: null });
});

test('getAuctionState: past date only', () => {
  assert.equal(getAuctionState(at('2026-10-17'), NOW, 30).state, 'none');
});

test('getAuctionState: 31 days out is hidden', () => {
  assert.equal(getAuctionState(at('2026-12-05'), NOW, 30).state, 'none');
});

test('getAuctionState: 30 days out is shown', () => {
  const r = getAuctionState(at('2026-12-04', { time: '10:00 AM', location: 'Yard' }), NOW, 30);
  assert.equal(r.state, 'upcoming');
  assert.deepEqual(r.auction, { date: '2026-12-04', time: '10:00 AM', location: 'Yard', note: '', daysAway: 30 });
});

test('getAuctionState: today', () => {
  const r = getAuctionState(at('2026-11-04'), NOW, 30);
  assert.equal(r.state, 'today');
  assert.equal(r.auction.daysAway, 0);
});

test('getAuctionState: yesterday is hidden', () => {
  assert.equal(getAuctionState(at('2026-11-03'), NOW, 30).state, 'none');
});

test('getAuctionState: two upcoming rows, the soonest wins', () => {
  const rows = [{ date: '2026-11-28', note: 'later' }, { date: '2026-11-14', note: 'sooner' }, { date: '2026-10-01', note: 'past' }];
  const r = getAuctionState(rows, NOW, 30);
  assert.equal(r.state, 'upcoming');
  assert.equal(r.auction.date, '2026-11-14');
  assert.equal(r.auction.note, 'sooner');
});

test('getAuctionState: the soonest upcoming row decides, even when it is outside the window', () => {
  // the next auction is 40 days out: nothing shows yet, and a later row can't jump the queue
  assert.equal(getAuctionState([{ date: '2026-12-14' }, { date: '2027-02-01' }], NOW, 30).state, 'none');
});

test('getAuctionState: DST boundary uses the Detroit calendar date, not UTC', () => {
  // Clocks fall back at 2:00 AM on Sun Nov 1, 2026.
  // 04:30 UTC on Nov 2 is still 11:30 PM on Nov 1 in Detroit (EST), so it's auction day.
  assert.equal(getAuctionState(at('2026-11-01'), new Date('2026-11-02T04:30:00Z'), 30).state, 'today');
  // 05:30 UTC on Nov 2 is 12:30 AM on Nov 2 in Detroit: the day after, hidden.
  assert.equal(getAuctionState(at('2026-11-01'), new Date('2026-11-02T05:30:00Z'), 30).state, 'none');
  // 03:59 UTC on Nov 1 is 11:59 PM on Oct 31 (EDT): one day to go.
  const r = getAuctionState(at('2026-11-01'), new Date('2026-11-01T03:59:00Z'), 30);
  assert.equal(r.state, 'upcoming');
  assert.equal(r.auction.daysAway, 1);
  // A 30 day window that crosses the change: Nov 20 shows from Oct 21 in Detroit.
  assert.equal(getAuctionState(at('2026-11-20'), new Date('2026-10-21T04:30:00Z'), 30).state, 'upcoming'); // Oct 21, 12:30 AM EDT
  assert.equal(getAuctionState(at('2026-11-20'), new Date('2026-10-21T03:30:00Z'), 30).state, 'none'); // Oct 20, 11:30 PM EDT
  // Spring forward, Sun Mar 14, 2027
  assert.equal(getAuctionState(at('2027-03-14'), new Date('2027-03-15T03:30:00Z'), 30).state, 'today'); // Mar 14, 11:30 PM EDT
});

test('getAuctionState: showFromDaysBefore defaults to 30 and accepts other values', () => {
  assert.equal(getAuctionState(at('2026-12-04'), NOW, undefined).state, 'upcoming');
  assert.equal(getAuctionState(at('2026-12-04'), NOW, null).state, 'upcoming');
  assert.equal(getAuctionState(at('2026-11-14'), NOW, 7).state, 'none');
  assert.equal(getAuctionState(at('2026-11-11'), NOW, 7).state, 'upcoming');
});

test('detroitDay', () => {
  assert.equal(dayToISO(detroitDay(new Date('2026-11-05T04:59:00Z'))), '2026-11-04');
  assert.equal(dayToISO(detroitDay(new Date('2026-11-05T05:00:00Z'))), '2026-11-05');
});

test('parseCSV: quotes, commas inside quotes, escaped quotes, CRLF', () => {
  const csv = 'date,time,location,note\r\n2026-12-12,10:00 AM,"21360 Telegraph Rd, Southfield, MI","Say ""hi"",\nthen bid"\r\n';
  assert.deepEqual(parseCSV(csv), [
    ['date', 'time', 'location', 'note'],
    ['2026-12-12', '10:00 AM', '21360 Telegraph Rd, Southfield, MI', 'Say "hi",\nthen bid'],
  ]);
});

test('rowsFromCSV: blank rows ignored, bad dates warned and skipped, US dates accepted', () => {
  const warnings = [];
  const csv = '﻿Date, Time ,Location,Note\n,,,\n2026-12-12,10 AM,,\nsoon,,,\n12/1/2026,,"Lot B, east side",\n2026-02-30,,,\n';
  const rows = rowsFromCSV(csv, (m) => warnings.push(m));
  assert.deepEqual(rows, [
    { date: '2026-12-12', time: '10 AM', location: '', note: '' },
    { date: '2026-12-01', time: '', location: 'Lot B, east side', note: '' },
  ]);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /soon/);
  assert.deepEqual(rowsFromCSV('time,note\n10 AM,x', () => {}), []);
  assert.deepEqual(rowsFromCSV('', () => {}), []);
});

test('rowsFromJSON', () => {
  assert.deepEqual(rowsFromJSON({ date: null, showFromDaysBefore: 30 }), []);
  assert.deepEqual(rowsFromJSON({ date: '2026-12-12', time: null, location: '21360 Telegraph Rd', note: null }),
    [{ date: '2026-12-12', time: '', location: '21360 Telegraph Rd', note: '' }]);
});

test('formatAuctionDate', () => {
  assert.equal(formatAuctionDate('2026-12-12'), 'Saturday, December 12');
});

test('buildICS: timed event in Detroit time, all day without a time', () => {
  const now = new Date('2026-11-04T17:00:00Z');
  const winter = buildICS({ date: '2026-12-12', time: '10:00 AM', location: '21360 Telegraph Rd, Southfield, MI 48033', note: '' }, { now });
  assert.match(winter, /\r\nDTSTART:20261212T150000Z\r\n/); // 10 AM EST
  assert.match(winter, /\r\nDTEND:20261212T160000Z\r\n/);
  assert.match(winter, /\r\nLOCATION:21360 Telegraph Rd\\, Southfield\\, MI 48033\r\n/);
  const summer = buildICS({ date: '2027-07-10', time: '9:30 am', location: '', note: '' }, { now, fallbackLocation: 'Yard' });
  assert.match(summer, /\r\nDTSTART:20270710T133000Z\r\n/); // 9:30 AM EDT
  assert.match(summer, /\r\nLOCATION:Yard\r\n/);
  const allDay = buildICS({ date: '2026-12-31', time: '', location: 'Yard', note: '' }, { now });
  assert.match(allDay, /\r\nDTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n/);
});
