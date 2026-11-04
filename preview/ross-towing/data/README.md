# Next auction date

The full how-to is in `../README.md`, under "Auction date". Short version:

`auction.json` is the fallback source (and the only source while `AUCTION_SHEET_CSV_URL` in `src/config.js` is empty):

```json
{ "date": null, "time": null, "location": "21360 Telegraph Rd, Southfield, MI 48033", "showFromDaysBefore": 30, "note": null }
```

- `date`: the next auction as `"YYYY-MM-DD"`, or `null` when nothing is scheduled.
- `time`: optional, for example `"10:00 AM"`.
- `location`: shown under the date. Also used when a Google Sheet row leaves location blank.
- `showFromDaysBefore`: how many days ahead the date starts showing. Default 30. Also applies to the Sheet.
- `note`: optional one line under the date.

From 30 days out through the auction day the auctions block shows a red banner with the date and an "Add to calendar" button. Otherwise it says "Public auctions about every two months. Call 248-356-6011 for the next date." Dates follow Detroit time.

To preview a date without editing anything, add `?auction=2026-12-12` to the page URL.

This README isn't published. `_config.yml` excludes README files from the site.
