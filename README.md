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

Requires Node.js 20 or newer.

```bash
git clone https://github.com/jekayinfa1/pocket-pause.git
cd pocket-pause
npm install
npm run dev
```

Open `http://localhost:8080`. Changes to `index.html`, `styles.css`, or `app.js` appear after refreshing the browser.

A dependency-free alternative is:

```bash
python3 -m http.server 8080
```

## Run in GitHub Codespaces

1. Open the repository on GitHub.
2. Select **Code → Codespaces → Create codespace on main**.
3. In the Codespaces terminal, run `npm run dev`.
4. Open forwarded port `8080` from the **Ports** panel.

To share that temporary development preview, change port `8080` visibility to **Public** in the Ports panel and copy its forwarded address. Anyone with the address can view that running preview while the Codespace remains active.

Because the repository is public, another developer can also create their own Codespace or clone the repository and run the same commands. Browser data is local to each person, so their moods, locations, decisions, and savings history do not appear in your browser.

## Public preview

The GitHub Pages workflow publishes `main` at:

`https://jekayinfa1.github.io/pocket-pause/`

## Validation

```bash
npm run check
npm test
npm run build
```

Or run everything together:

```bash
npm run verify
```

## License

MIT
