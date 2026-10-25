# Local development

How to run everything on one machine: a craft server, HTTPS in front of it, a git source, and the app deployed to your own Confluence site's development environment. It is also the quickest way to try the macro before setting up a shared server.

You need a Confluence Cloud site where you are an admin. A free site from [atlassian.com](https://www.atlassian.com/software/confluence/free) works.

## 1. Run a craft server

With Docker:

```sh
docker run -d --name craft -p 8080:8080 tiagocarcao/craft:v2.28.0
```

Or from source, if you work on the server too (needs Go, Java and [PlantUML](https://plantuml.com/download) on your `PATH` as `plantuml`):

```sh
git clone https://github.com/tcarcao/craft.git
cd craft
go run ./cmd/server
```

The server listens on `http://localhost:8080`.

## 2. Add HTTPS

Forge only approves `https://` domains. [mkcert](https://github.com/FiloSottile/mkcert) makes a certificate your browser trusts, and `craft.localtest.me` is a public name that resolves to `127.0.0.1`, so no hosts file changes are needed:

```sh
mkcert -install
mkcert craft.localtest.me
node dev/tls-proxy.mjs craft.localtest.me.pem craft.localtest.me-key.pem
```

The proxy prints `https://craft.localtest.me:8443 -> http://localhost:8080`. Check it with `curl https://craft.localtest.me:8443/sources`.

## 3. Add a git source (optional)

Any local repo works as a source; the URL can be a plain path. Split a model over a few files to see cross-file resolution:

```sh
mkdir -p ~/craft-demo/identity/craft && cd ~/craft-demo/identity
git init -b main
cat > craft/contexts.craft <<'CRAFT'
actor user Business_User

domain Identity {
    Authentication
    Profile
}

services {
    UserService {
        contexts: Authentication, Profile
        data-stores: user_db
    }
}
CRAFT
cat > craft/login.craft <<'CRAFT'
use_case "User Login" {
    when Business_User signs in
        Authentication asks user_db to verify credentials
        Authentication asks Profile to load user profile
}
CRAFT
git add . && git commit -m "Identity model"
```

To try merge requests without GitLab, create the ref GitLab would create:

```sh
git checkout -b password-reset
# ...add a use case, commit...
git update-ref refs/merge-requests/3/head password-reset
git checkout main
```

Then point the server at it. With a server run from source:

```sh
cat > ~/craft-demo/sources.json <<'JSON'
{"sources": [{"name": "identity", "repos": [
  {"name": "identity", "url": "/Users/you/craft-demo/identity", "branch": "main", "root": "craft"}
]}]}
JSON
CRAFT_SOURCES=~/craft-demo/sources.json CRAFT_CACHE=~/craft-demo/cache go run ./cmd/server
```

With Docker, mount the demo folder and use the container's paths in `url`. Git refuses a repo owned by another user ("detected dubious ownership"), and a mounted folder is owned by you, not by the container's user, so give git a config file that trusts it:

```sh
cat > ~/craft-demo/sources.json <<'JSON'
{"sources": [{"name": "identity", "repos": [
  {"name": "identity", "url": "/demo/identity", "branch": "main", "root": "craft"}
]}]}
JSON
printf '[safe]\n\tdirectory = *\n' > ~/craft-demo/gitconfig

docker run -d --name craft -p 8080:8080 \
  -e CRAFT_SOURCES=/demo/sources.json \
  -e CRAFT_CACHE=/tmp/craft-cache \
  -e GIT_CONFIG_GLOBAL=/demo/gitconfig \
  -v ~/craft-demo:/demo:ro \
  tiagocarcao/craft:v2.28.0
```

Check it with `curl -X POST https://craft.localtest.me:8443/sources/identity/catalog -d '{}'`. With Podman on macOS, keep the folder under your home folder, which is what the Podman machine shares by default.

## 4. Deploy the app to your site

```sh
npm install
npm run build
forge register
forge deploy -e development
forge install -e development --site your-site.atlassian.net --product confluence
```

Insert the macro on a page, approve `https://craft.localtest.me:8443` from the editor, accept the admin dialog and reload the page ([details](install.md#4-approve-the-craft-server)). Chrome then asks once about local network access; allow it.

## 5. Change and redeploy

```sh
npm run deploy
```

That builds and deploys to development in about 20 seconds. Reload the Confluence page to get the new version.

## Project layout

```
manifest.yml          Forge app: one macro with a custom editor, scopes, egress
src/view.js           What readers see: loads the stored attachment, adds the caption
src/config.js         The editor: modes, sources, preview, save, drift notice
src/craft-lang.js     Craft syntax highlighting for CodeMirror
src/*.css             Styles, bundled into static/*/main.css
static/view/          Reader page (index.html; main.js and main.css are built)
static/config/        Editor page (index.html; main.js and main.css are built)
dev/tls-proxy.mjs     HTTPS proxy for local development
examples/             Example server configuration
```

`npm run build` bundles `src/` with esbuild into `static/*/main.js` and `main.css`. Those files are build output and are not committed.

## Things Forge's sandbox requires

- **No inline styles.** The page's content security policy blocks `<style>` tags, so all CSS ships as a file. CodeMirror injects its styles at runtime, and it can only do that with constructable stylesheets inside a shadow root, which is why the editor is mounted in one.
- **Reload after approving a domain.** The allowed domains are fixed when the page loads.
- **At least one scope.** Without any, Confluence cannot show the per-user consent prompt and the app fails to load.
- **Images as data URLs.** Attachments are downloaded through the Forge bridge and shown as `data:` URLs, which the policy allows.
