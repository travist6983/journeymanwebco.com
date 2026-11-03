# Next auction date

The auction block on the Ross Towing page reads one file: `auction.json`.

```json
{ "date": null, "showFromDaysBefore": 30 }
```

- `date`: the next auction as `"YYYY-MM-DD"`, or `null` when nothing is scheduled.
- `showFromDaysBefore`: how many days ahead the date starts showing. Default 30.

When `date` is `null`, more than 30 days away, or already past, the block says "Call for the next auction date". From 30 days out through the auction day, it shows the date (for example "Saturday, December 6, 2026") with a red border.

To preview a date without editing the file, add `?auction=2026-12-06` to the page URL.

## How Jennifer would update it

Today it's a one-line edit to this file, then a push, and the page updates in about a minute. The plan is to offer this as a small CMS feature: a password protected form where Jennifer picks the date and saves, which rewrites this file for her. Nothing else on the page needs to change.

This README isn't published. `_config.yml` excludes README files from the site.
