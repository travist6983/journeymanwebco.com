#!/usr/bin/env python3
"""Generate sites/<slug>.json for a hand-picked list of leads from a prospecting run.

  python3 scripts/sites-from-list.py <run folder> <list.json>

list.json: [{"name": "<business_name exactly as in scored.json>", "preset": "auto-repair"}, ...]

Same facts-only rules and slug rule as sites-from-run.py, but stricter copy: service lists are labeled
placeholders (unless the lead's notes list services), no preset detail/includes text, and the redesign
strip never comments on the current site. Prints one JSON line per lead for the manifest step.
"""
import json, os, re, sys

run, lst = sys.argv[1], json.load(open(sys.argv[2]))
d = json.load(open(f'{run}/scored.json'))['scored']
by_name = {x['business_name']: (i, x) for i, x in enumerate(d)}
BASE = json.load(open('templates/presets/base.json'))
# Base page list for every lead (same five pages as the auto previews), with neutral page subtitles.
SUBS = {'services': 'Call to ask about any service.', 'about': 'Where to find us.', 'reviews': 'Google rating and reviews.', 'contact': 'Call or send a request. Directions are below.'}
PAGES = [dict(pg, hero=dict(pg.get('hero', {}), sub=SUBS[pg['slug']])) if pg['slug'] in SUBS else pg for pg in BASE['pages']]
have = set(os.listdir('preview')) | {f[:-5] for f in os.listdir('sites')}

def title(s):
    s = s.replace('&amp;', '&')
    return s.title().replace("'S ", "'s ") if s.isupper() else s
def slug(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', ''))).strip('-')

NOTE_SERVICES = re.compile(r'flyer lists ([a-z ,]+?)(?:\.|$)', re.I)   # e.g. "Shop flyer lists alignments, brakes and suspension."

for item in lst:
    idx, x = by_name[item['name']]
    m = re.match(r'(.+?),\s*([^,]+),\s*MI\s*(\d{5})', x['address'] or '')
    nm = title(x['business_name']); s = slug(nm)
    if s in have: raise SystemExit(f'{s} already exists; refusing to overwrite')
    preset = item['preset']
    pre = json.load(open(f'templates/presets/{preset}.json'))
    b = {'name': nm, 'phone': x['phone'], 'address': {'street': m[1], 'city': m[2], 'state': 'MI', 'zip': m[3]}, 'placeId': x['place_id'],
         'rating': x['rating'], 'reviewCount': x['review_count']}
    est = x.get('established_year')
    if est: b['established'] = est
    noted = NOTE_SERVICES.search(x.get('notes') or '')
    if noted:
        names = [t.strip() for t in re.split(r',\s*|\s+and\s+', noted[1]) if t.strip()]
        svc = [{'key': slug(t), 'icon': 'wrench', 'title': t[:1].upper() + t[1:], 'blurb': 'Call {{phone}} to ask about ' + t + '.'} for t in names]
        svc_labels = {'servicesEyebrow': 'Services', 'servicesHeading': 'What the shop lists', 'servicesIntro': 'Call {{phone}} to ask about any of these.'}
    else:
        svc = [{'key': sv['key'], 'icon': sv['icon'], 'title': sv['title'], 'blurb': 'Call {{phone}} to ask about ' + sv['title'].lower() + '.'}
               for sv in pre.get('content', {}).get('services', [])] or \
              [{'key': 'services', 'icon': 'wrench', 'title': 'Services', 'blurb': 'Placeholder: the final version lists what {{name}} offers. Call {{phone}} to ask.'}]
        svc_labels = {'servicesEyebrow': 'Example services (placeholder)', 'servicesHeading': 'Services',
                      'servicesIntro': 'Placeholder list for the demo. The final version lists what {{name}} actually offers.'}
    content = {
        'hero': {'heading': '{{name}}', 'eyebrow': '{{city}} · Since {{established}}' if est else '{{city}}, Michigan',
                 'sub': 'Call {{phone}} or stop by {{street}}. Rated {{rating}} stars across {{reviews}} Google reviews.', 'bullets': []},
        'trustBullets': ['{{rating}} stars on Google', '{{reviews}} Google reviews', 'Call {{phone}}'],
        'services': svc,
        'about': {'eyebrow': 'About', 'heading': '{{name}} in {{city}}',
                  'body': '{{name}} is on {{street}} in {{city}}, Michigan' + (', in business since {{established}}' if est else '') + '. Rated {{rating}} stars across {{reviews}} Google reviews.',
                  'body2': '', 'checks': [], 'stats': []},
        'badges': [{'icon': 'star', 'title': '{{rating}} stars', 'sub': '{{reviews}} Google reviews'},
                   {'icon': 'phone', 'title': 'Call {{phone}}', 'sub': 'Ask about your job'},
                   {'icon': 'pin', 'title': '{{street}}', 'sub': '{{city}}, Michigan'}],
        'cta': {'eyebrow': 'Get in touch', 'heading': 'Call or send a request.', 'body': 'Call {{phone}} or send a request through the form.'},
        'form': {'title': 'Send a request', 'hint': 'Tell us what you need and how to reach you.', 'submit': 'Send request', 'fields': BASE['content']['form']['fields']},
        'reviews': [],
    }
    live = bool(x.get('domain'))
    concept = {'currentSite': x['domain'] if live else None,
               'demoIntro': 'Photos are stock images and the wording is generic placeholder copy.',
               'demoNote': ['real photos of the business and team', 'Google review quotes', 'business hours',
                            'the list of services ' + nm + ' actually offers, with descriptions', 'logo and brand colors']}
    if live:
        concept['noteHtml'] = 'A concept for a new site at ' + x['domain'] + '. Your current site stays up until you approve a new one.'
    site = {'slug': s, 'preset': preset, 'concept': concept, 'business': b, 'brand': {}, 'content': content,
            'pages': PAGES, 'disableSections': ['process', 'faq', 'gallery', 'beforeAfter', 'team', 'serviceArea'],
            'labels': {**svc_labels, 'book': 'Send a request', 'bookShort': 'Request',
                       'reviewsEmptyTitle': 'Demo placeholder: your Google reviews',
                       'reviewsEmptyBody': 'On the final approved version your best recent reviews show here and update on their own.',
                       'hoursFallback': 'Hours added on the final version', 'contactHeading': 'Get in touch',
                       'contactIntro': 'Call or send a request. Directions are below.', 'formFine': '',
                       'badgesEyebrow': 'At a glance', 'badgesHeading': 'The basics', 'heroCardFallbackSub': '',
                       'faqIntro': '', 'processIntro': '', 'galleryHeading': '', 'areaHeading': 'Location'}}
    json.dump(site, open(f'sites/{s}.json', 'w'), indent=2); have.add(s)
    print(json.dumps({'name': x['business_name'], 'lead_id': idx, 'slug': s, 'preset': preset, 'services_from_notes': bool(noted)}))
