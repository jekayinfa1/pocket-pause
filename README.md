# PocketPause

PocketPause is a privacy-first, context-aware spending intervention PWA designed to help people interrupt impulse purchases before checkout.

It combines purchase amount, category, mood, location context, savings progress, and a preferred messaging tone to generate a timely nudge. Users can skip a purchase and save the money, pause it for later, or record an intentional purchase without guilt.

## Features

- Context-aware spending interventions
- Gentle, witty, and roast-style nudges
- Savings goals and monthly progress
- Pause-and-revisit purchase decisions
- Mood, location, time, and amount-based reminder rules
- Optional browser geolocation and local temptation zones
- Trigger insights and seven-day savings visualization
- Offline-capable installable PWA
- Local-first storage with JSON export
- Native share-sheet support where available

## Privacy

PocketPause stores app data locally in the browser. The prototype does not require an account or backend. See `PRIVACY.md` and `SECURITY.md`.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then open the local URL shown by the development server.

You can also use:

```bash
python3 -m http.server 8080
```

and open `http://localhost:8080`.

## Validation

```bash
npm test
npm run validate
npm run build
```

## Deployment

The repository includes GitHub Actions workflows for CI and GitHub Pages deployment.

## License

MIT
