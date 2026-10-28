# Installing the app

The app is not on the Atlassian Marketplace. Each company registers its own copy under its own Atlassian developer account and installs it on its own site. That keeps the app, its logs and its installations under your control.

## 1. Prerequisites

- Node.js 22 or later.
- Forge CLI 14 or later. Older versions reject the customer-managed egress setting in `manifest.yml`.

  ```sh
  npm install -g @forge/cli@latest
  forge --version
  ```

- An Atlassian account with access to the developer console, and an API token for it ([create one](https://id.atlassian.com/manage-profile/security/api-tokens)). Then:

  ```sh
  forge login
  ```

- Admin rights on the Confluence Cloud site you install to.
- A craft server reachable over HTTPS ([docs/server.md](server.md)).

## 2. Build and register

```sh
git clone https://github.com/tcarcao/craft-confluence.git
cd craft-confluence
npm install
npm run build
forge register
```

`forge register` asks for an app name and writes your new app id into `manifest.yml`. If you keep a fork, commit that change; it identifies your registration, not a secret.

## 3. Deploy and install

Start with the development environment:

```sh
forge deploy -e development
forge install -e development --site your-site.atlassian.net --product confluence
```

In development the macro shows up as "arch-craft (Development)". When it works for you, deploy to production:

```sh
forge deploy -e production
forge install -e production --site your-site.atlassian.net --product confluence
```

> **Note:** the app uses customer-managed egress (`permissions.external.configurable` in `manifest.yml`), which lets each site choose its own craft server. Atlassian does not allow removing that setting once an app has been deployed to production.

The first time each person uses the macro, Confluence asks them to allow the app access (it reads the page and reads and writes its attachments). This is a one-time prompt per person.

## 4. Approve the craft server

No server address is built into the app. A site admin approves one, once for the whole site, from the macro editor. Editors never enter it: every diagram uses the approved server.

1. Edit any page, type `/arch-craft` and insert **arch-craft**. The editor opens.
2. The editor says no craft server is approved yet. Enter the server's address, for example `https://craft.example.internal`, and click **Approve server**.
3. Confluence shows a dialog asking the admin to allow the app to connect to that domain. Accept it.
4. **Reload the page.** The browser only picks up a newly approved domain after a reload. Then insert the macro again: cancelling a macro that was never saved removes it from the page.

The footer of the editor shows which server it uses ("via craft.example.internal"). The page used for the approval does not need to be published. To change servers later, a site admin updates the same setting.

## Updating

```sh
git pull
npm install
npm run build
forge deploy -e production
```

When a new version asks for more permissions, Forge says so during deploy; run `forge install --upgrade -e production --site your-site.atlassian.net --product confluence` afterwards and accept the new scopes.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Approving the server fails with "Dry run failed". | The address is not `https://`. Forge only approves HTTPS domains. |
| The server is approved but every request fails. | The page was not reloaded after approving. Reload and try again. |
| Preview stays on "Still waiting for the craft server". | Chrome is asking whether the page may access devices on the local network. Answer the prompt (look near the address bar). |
| "Could not reach https://...: Failed to fetch". | The browser cannot reach the server: VPN off, certificate not trusted, or the server is older than v2.28.0 and rejects the browser's preflight request. Open the server address in a new tab to check the first two. |
| "From git" options are greyed out. | The server has no `CRAFT_SOURCES`, or it is too old to have `/sources`. |
| "ref ... not found". | The branch or merge request does not exist in that repo, or the server has not fetched it yet (it fetches when its copy is more than 30 seconds old). |
| The diagram shows red underlines and does not save. | The model has errors. Hover the underline for the message. Warnings (yellow) do not block saving. |
