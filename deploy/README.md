# Deployment

This project builds a Vite static bundle into `dist/`.

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

## Static Hosting

For static platforms such as GitHub Pages, Netlify, Cloudflare Pages, or Vercel:

```bash
npm ci
npm run test
npm run build
```

Publish the generated `dist/` directory. The app is an SPA, so configure the host to serve `index.html` for unknown routes. The included `nginx.conf` already applies that fallback for container deployments.
