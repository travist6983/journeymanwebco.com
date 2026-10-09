#!/usr/bin/env python3
"""Generate sites/<slug>.json for the top leads of a prospecting run. Facts only: name, phone, address, rating, reviews, placeId, sourced tenure."""
import json, re, sys, os
CLAIM = re.compile(r'ASE|certif|warrant|same[- ]day|estimate|before any|upfront|price explained|licens|insur|24/7|24 hours|loaner|rides|guarantee|free|usually|most repairs|honest|fair|fast|family|locally|owner|background|DOT|real person|minutes|clean|no surprise|dealer|years of|straight|promptly|quick|trained|experienced|expert', re.I)
def scrub(text, fallback):
    parts = [t for t in re.split(r'(?<=[.!?])\s+', text or '') if t and not CLAIM.search(t)]
    return ' '.join(parts) or fallback

run, n = sys.argv[1], int(sys.argv[2])
PRESET = {'auto repair': 'auto-repair', 'towing': 'towing', 'body shop / collision': 'collision', 'HVAC': 'hvac', 'plumbing': 'plumbing',
          'landscaping': 'landscaping', 'machine shop': 'machine-shop', 'metal fabrication': 'machine-shop'}
d = json.load(open(f'{run}/scored.json'))['scored']
have = set(os.listdir('preview')) | {f[:-5] for f in os.listdir('sites')}
SKIP = ('wearmaster', 'al-s-auto-repair', 'als-auto-repair')  # merged listing / possibly closed (see nosite verification notes)
def title(s):
    s = s.replace('&amp;', '&')
    return s.title().replace("'S ", "'s ") if s.isupper() else s
def slug(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('\u2019', ''))).strip('-')
out = []
for x in sorted(d, key=lambda x: -x['opportunity']):
    if x['priority'] not in 'AB' or x['verify_manually'] or x['vertical'] not in PRESET or not x.get('phone'): continue
    m = re.match(r'(.+?),\s*([^,]+),\s*MI\s*(\d{5})', x['address'] or '')
    if not m: continue
    nm = title(x['business_name']); s = slug(nm)
    if any(k in s for k in SKIP): continue
    if s in have: continue
    live = x['site_status'] == 'live'
    b = {'name': nm, 'phone': x['phone'], 'address': {'street': m[1], 'city': m[2], 'state': 'MI', 'zip': m[3]}, 'placeId': x['place_id'],
         'rating': x['rating'], 'reviewCount': x['review_count']}
    if x.get('established_year') and x.get('years_source'): b['established'] = x['established_year']
    pre = json.load(open(f"templates/presets/{PRESET[x['vertical']]}.json"))
    svc = []
    for sv in pre['content']['services']:
        t = sv['title']
        svc.append(dict(sv, blurb=scrub(sv.get('blurb'), 'Call {{phone}} to ask about ' + t.lower() + '.'), detail=scrub(sv.get('detail'), ''),
                        includes=[i for i in sv.get('includes', []) if not CLAIM.search(i)]))
    est = b.get('established')
    hero = {'heading': {'towing': 'Towing in {{city}}.'}.get(PRESET[x['vertical']], '{{name}}'), 'eyebrow': '{{city}} · Since {{established}}' if est else '{{city}}, Michigan',
            'sub': 'Call {{phone}} or stop by {{street}}. Rated {{rating}} stars across {{reviews}} Google reviews.'}
    content = {'hero': hero, 'trustBullets': ['{{rating}} stars on Google', '{{reviews}} Google reviews', 'Call {{phone}}'], 'services': svc,
               'about': {'heading': '{{name}} in {{city}}', 'body': '{{name}} is on {{street}} in {{city}}, Michigan' + (', serving drivers since {{established}}' if est else '') + '. Rated {{rating}} stars across {{reviews}} Google reviews.', 'body2': '', 'checks': []},
               'badges': [{'icon': 'star', 'title': '{{rating}} stars', 'sub': '{{reviews}} Google reviews'}, {'icon': 'phone', 'title': 'Call {{phone}}', 'sub': 'Ask about your job'}, {'icon': 'pin', 'title': '{{street}}', 'sub': '{{city}}, Michigan'}],
               'cta': {'eyebrow': 'Get in touch', 'heading': 'Call or send a request.', 'body': 'Call {{phone}} or send a request through the form.'},
               'form': {'title': 'Send a request', 'hint': 'Tell us what you need and how to reach you.', 'submit': 'Send request'}, 'reviews': []}
    site = {'slug': s, 'preset': PRESET[x['vertical']], 'concept': {'currentSite': x['domain'] if live else None, 'demoIntro': 'Photos are stock images and the wording is generic placeholder copy.', 'demoNote': ['real photos of the shop and team', 'Google review quotes', 'business hours', 'service descriptions written for what the shop actually offers', 'logo and brand colors']}, 'business': b, 'brand': {}, 'content': content, 'disableSections': ['process', 'faq'],
            'labels': {'reviewsEmptyTitle': 'Demo placeholder: your Google reviews', 'reviewsEmptyBody': 'On the final approved version your best recent reviews show here and update on their own.', 'hoursFallback': 'Hours added on the final version', 'servicesIntro': 'Call {{phone}} to ask about any of these.', 'contactIntro': 'Call or send a request. Directions are below.'}}
    json.dump(site, open(f'sites/{s}.json', 'w'), indent=2); out.append(s); have.add(s)
    if len(out) == n: break
print(len(out), *out, sep='\n')
