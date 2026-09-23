# Deploy to SpaceWeb

## Option A: GitHub Actions through FTP

Use this option when SSH is unavailable. GitHub will build the site after every
push to `develop` and upload `dist` to SpaceWeb through FTP.

Create these repository secrets in GitHub:

- `SWEB_FTP_SERVER`: FTP host from SpaceWeb, for example `your-domain.ru` or the
  server IP.
- `SWEB_FTP_USERNAME`: FTP login.
- `SWEB_FTP_PASSWORD`: FTP password.
- `SWEB_FTP_SERVER_DIR`: remote public folder, usually `/public_html/`.

Then push to GitHub:

```bash
git push origin develop
```

You can also run the deployment manually in GitHub:

```text
Actions -> Deploy to SpaceWeb FTP -> Run workflow
```

The workflow is stored in `.github/workflows/deploy-sweb-ftp.yml`.

## Option B: Git over SSH

This project is a static Vite site. Build it locally and push only the `dist`
contents to SpaceWeb. The hosting server then checks those files out into
`public_html`.

### One-time setup on SpaceWeb

Enable SSH in the SpaceWeb control panel, then connect:

```bash
ssh login@your-domain.ru
```

Create a bare repository and install the deploy hook:

```bash
mkdir -p ~/resume.git ~/public_html
cd ~/resume.git
git init --bare
nano hooks/post-receive
chmod +x hooks/post-receive
```

Paste the contents of `deploy/sweb-post-receive` into `hooks/post-receive`.

If your site points to another folder, set it in the hook before checkout:

```bash
export SWEB_PUBLIC_HTML="$HOME/example.ru/public_html"
```

### Deploy from this computer

Run:

```bash
./scripts/deploy-sweb.sh 'login@your-domain.ru:~/resume.git'
```

or:

```bash
SWEB_REMOTE='login@your-domain.ru:~/resume.git' ./scripts/deploy-sweb.sh
```

The script runs `yarn build`, commits `dist` into a temporary Git repository,
and force-pushes it to the SpaceWeb bare repository.

### Notes

- SpaceWeb uses `public_html` as the public directory on virtual hosting.
- Do not upload `node_modules`, `src`, or the project root to `public_html`.
- The source repository remains on GitHub; the SpaceWeb repository is only a
  deployment target for built static files.
