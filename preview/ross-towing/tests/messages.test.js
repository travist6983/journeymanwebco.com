// Run: npm test (or: node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFreightQuote, freightSummary, formatTowRequest } from '../src/messages.js';

const full = {
  company: 'Acme Excavating',
  contact: 'Pat Lee',
  phone: '(313) 555-0100',
  email: 'pat@acme.example',
  pickup: 'Southfield, MI',
  delivery: 'Fort Wayne, IN',
  ready_date: '2026-12-07',
  deliver_by: '2026-12-09',
  load: 'excavator',
  pieces: '2',
  length: '24', length_unit: 'ft',
  width: '8.5', width_unit: 'ft',
  height: '10', height_unit: 'ft',
  weight: '42000', weight_unit: 'lbs', weight_estimate: 'yes',
  equipment: ['Chains', 'Binders', 'Edge protectors'],
  equipment_other: '',
  trailer: 'Lowboy',
  notes: 'Gate code at pickup.\nCall on arrival.',
};

test('formatFreightQuote: every field', () => {
  assert.equal(formatFreightQuote(full), [
    'Company: Acme Excavating',
    'Contact: Pat Lee',
    'Phone: (313) 555-0100',
    'Email: pat@acme.example',
    'Pickup: Southfield, MI',
    'Delivery: Fort Wayne, IN',
    'Ready date: Mon, Dec 7, 2026',
    'Delivery needed by: Wed, Dec 9, 2026',
    'Load: 2 pieces, excavator',
    'Dimensions: 24 ft L x 8.5 ft W x 10 ft H',
    'Weight: 42,000 lbs (estimate)',
    'Equipment: Chains, Binders, Edge protectors',
    'Trailer preference: Lowboy',
    'Notes: Gate code at pickup.\nCall on arrival.',
  ].join('\n'));
});

test('formatFreightQuote: only the required fields', () => {
  const out = formatFreightQuote({
    contact: 'Pat Lee', phone: '3135550100', email: 'pat@acme.example',
    pickup: 'Southfield, MI', delivery: 'Toledo, OH', load: 'Steel coils',
    length: '', width: '', height: '', weight: '', pieces: '', trailer: '', equipment: [],
  });
  assert.equal(out, [
    'Contact: Pat Lee',
    'Phone: 3135550100',
    'Email: pat@acme.example',
    'Pickup: Southfield, MI',
    'Delivery: Toledo, OH',
    'Load: Steel coils',
    'Dimensions: Not given',
    'Weight: Not given',
    'Equipment: None selected',
    'Trailer preference: No preference',
  ].join('\n'));
  assert.doesNotMatch(out, /Company|Ready date|Delivery needed by|Notes/);
});

test('formatFreightQuote: mixed units and partial dimensions', () => {
  const d = { ...full, length: '24', length_unit: 'ft', width: '102', width_unit: 'in', height: '', height_unit: 'ft', weight: '21', weight_unit: 'tons', weight_estimate: false };
  const out = formatFreightQuote(d);
  assert.match(out, /^Dimensions: 24 ft L x 102 in W \(height not given\)$/m);
  assert.match(out, /^Weight: 21 tons$/m);
  const one = formatFreightQuote({ ...full, length: '1', length_unit: 'in', width: '1,200', width_unit: 'in', height: '0.75', height_unit: 'ft', weight: '1', weight_unit: 'tons', pieces: '1' });
  assert.match(one, /^Dimensions: 1 in L x 1,200 in W x 0\.75 ft H$/m);
  assert.match(one, /^Weight: 1 ton \(estimate\)$/m);
  assert.match(one, /^Load: 1 piece, excavator$/m);
});

test('formatFreightQuote: "Other" equipment uses the typed text', () => {
  const out = formatFreightQuote({ ...full, equipment: ['Chains', 'Other'], equipment_other: '  corner   straps ' });
  assert.match(out, /^Equipment: Chains, Other: corner straps$/m);
  // Other checked with nothing typed still shows up
  assert.match(formatFreightQuote({ ...full, equipment: ['Other'], equipment_other: '' }), /^Equipment: Other$/m);
  // text typed, then Other unchecked: ignored
  assert.match(formatFreightQuote({ ...full, equipment: ['Tarps'], equipment_other: 'straps' }), /^Equipment: Tarps$/m);
});

test('freightSummary: the five details the shipper checks', () => {
  assert.deepEqual(freightSummary(full), [
    ['Pickup', 'Southfield, MI'],
    ['Delivery', 'Fort Wayne, IN'],
    ['Dimensions', '24 ft L x 8.5 ft W x 10 ft H'],
    ['Weight', '42,000 lbs (estimate)'],
    ['Equipment', 'Chains, Binders, Edge protectors'],
  ]);
});

test('formatTowRequest', () => {
  assert.equal(formatTowRequest({ name: 'Sam', phone: '2485550100', location: 'I-696 at Telegraph', vehicle: '2018 Ford Escape', issue: 'Flat tire' }),
    'Name: Sam\nPhone: 2485550100\nVehicle location: I-696 at Telegraph\nVehicle: 2018 Ford Escape\nWhat happened: Flat tire');
});
