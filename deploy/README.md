# Deployment

This project builds a Vite static bundle into `dist/`.

## GitHub Pages

The default CI/CD workflow deploys the production bundle to GitHub Pages on every push to `main` after all gates pass:

1. `npm ci`
2. optional lint script when configured
3. `npm run test`
4. `npm run build`
5. `npm run smoke:browser`
6. Docker image build and container health check
7. GitHub Pages deployment

The expected Pages URL is:

`https://geniusjunmin.github.io/uk-driving-trainer/`

If Pages is not already configured, set the repository Pages source to **GitHub Actions** in the repository settings.

## Local Docker

Build the image from the repository root:

```bash
docker build -t uk-driver-trainer -f deploy/Dockerfile .
```

Run it locally:

```bash
docker run --rm -p 8080:80 uk-driver-trainer
```

Open `http://127.0.0.1:8080/`.

The GitHub Actions workflow also builds the Docker image and starts it on port `8080` for a health check, so container validation does not depend on Docker being installed on this local workstation.

## Static Hosting

For static platforms such as GitHub Pages, Netlify, Cloudflare Pages, or Vercel:

```bash
npm ci
npm run verify:deploy
```

Publish the generated `dist/` directory. The app is an SPA, so configure the host to serve `index.html` for unknown routes. The included `nginx.conf` already applies that fallback for container deployments.

`verify:deploy` runs the unit/integration suite, builds `dist/`, starts a temporary static server, and opens the production bundle in headless Chrome. The browser smoke checks both the first rendered cockpit/HUD screen and the results overlay path used by release validation.

If the browser smoke cannot find Chrome automatically, set `CHROME_BIN` to a Chrome or Edge executable before running:

```bash
CHROME_BIN=/path/to/chrome npm run smoke:browser
```
