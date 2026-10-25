# Rolling it out in your organisation

Setting this up touches four groups that are often different people: Atlassian admins, whoever runs internal services, the owners of the git repos, and IT for browsers. This page lists what each one has to do, so you can ask for exactly that.

## Who does what

| Step | Who | Permission needed |
| --- | --- | --- |
| Register the app and deploy it | You | Any Atlassian account. Needs the Forge CLI and an API token. |
| Install it on the company's Confluence site | Confluence site admin | Admin of that site. |
| Allow the app in spaces with data policies | Organisation admin | Only if the org uses data security policies that block apps. |
| Approve the craft server's address | Confluence site admin | Admin of that site. One click in the macro editor. |
| Run the craft server with HTTPS on the internal network | Platform or infrastructure team | Somewhere to run a container, an internal DNS name, a certificate company laptops trust. |
| Give the server read access to the model repos | Maintainer of each repo or group | GitLab Maintainer, to create a deploy token or project access token with `read_repository`. |
| Pre-allow the browser's local network prompt (optional) | IT, for managed browsers | Chrome policy management. Without it, each editor answers a one-time prompt. |

## If you are not a site admin

You can do everything up to the install yourself, then hand over a link:

1. Register the app and deploy it **to production** ([install.md](install.md), steps 1 to 3, without `forge install`): `forge deploy -e production`. Installation links only exist for production.
2. In the [developer console](https://developer.atlassian.com/console/myapps/), open the app, go to **Distribution**, click **Edit**, set the status to **Sharing** and fill in the details it asks for (owner, support contact). Under **Installation link**, choose Confluence and copy the link.
3. Send the link to a site admin. They open it, pick the site and accept the permissions.
4. Ask the same admin to approve the server: insert the macro on any page and click **Approve server** with the server's address ([install.md, step 4](install.md#4-approve-the-craft-server)).

Before that, think about who owns the app. An app registered under your personal account stops being maintainable by anyone else if you leave. Register it in a developer space your team shares, or add colleagues as contributors (developer console → the app → **Contributors**).

## What to tell a reviewer

Security or platform reviewers usually ask the same questions. The short answers:

- **What it reads and writes in Confluence:** the page the macro is on (to find it) and that page's attachments (to store and show the diagram). Scopes: `read:page:confluence`, `read:content-details:confluence`, `read:attachment:confluence`, `write:attachment:confluence`.
- **What leaves Confluence:** when an editor previews or saves, their browser sends the diagram's model (the craft source, or a source name and a selection) to the craft server the admin approved. Nothing is sent anywhere else. Readers send nothing.
- **Where the code runs:** in the browser only, as Forge Custom UI hosted by Atlassian. The app has no backend functions and stores nothing outside the page.
- **The craft server:** your own container, on your network. It needs no inbound access from the internet and no Atlassian credentials. If git sources are configured, it needs outbound access to GitLab with a read-only token.
- **Who can reach the server:** anyone on the network it runs on. Keep it on the internal network or behind the VPN, and configure only repos whose models everyone there may see.
- **Egress setting:** the app uses customer-managed egress, so the site admin chooses the server address and can change it, and nothing is hardcoded. Atlassian does not let that setting be removed once the app is in production.

## A request you can send

> We'd like to install a Confluence app that draws architecture diagrams from our Craft models. It is open source (github.com/tcarcao/craft-confluence) and we deploy our own copy. Could you:
>
> 1. install it on our Confluence site from this link: `<installation link>`;
> 2. insert the **arch-craft** macro on any page and approve `https://<craft server address>` when it asks.
>
> It reads and writes attachments of the pages it's on. It only talks to our internal craft server, from the editor's browser. No data goes to third parties.
