# Rollout guide

Rolling out the app involves four groups: Atlassian administrators, the team that runs internal services, the owners of the model repositories, and IT (for managed browsers). This page lists what each group needs to do.

## Responsibilities

| Step | Owner | Permission needed |
| --- | --- | --- |
| Register and deploy the app | App owner | An Atlassian account, the Forge CLI and an API token. |
| Install the app on the Confluence site | Confluence site admin | Site administrator. |
| Allow the app in spaces with data security policies | Organisation admin | Only if data security policies block apps. |
| Approve the craft server address | Confluence site admin | Site administrator. One click in the macro editor. |
| Run the craft server over HTTPS on the internal network | Platform or infrastructure team | A container runtime, an internal DNS name, and a certificate trusted by company devices. |
| Grant the server read access to the model repositories | Maintainer of each repository or group | GitLab Maintainer, to create a deploy token or project access token with `read_repository`. |
| Pre-approve the browser's local network prompt (optional) | IT | Chrome policy management. Without it, each editor accepts a one-time prompt. |

## Installing without site admin rights

The app owner can complete every step up to installation, then hand an installation link to a site admin:

1. Register the app and deploy it **to production** ([install.md](install.md), steps 1 to 3, skipping `forge install`): `forge deploy -e production`. Installation links are only available for production.
2. In the [developer console](https://developer.atlassian.com/console/myapps/), open the app, go to **Distribution**, click **Edit**, set the status to **Sharing** and complete the required details (owner, support contact). Under **Installation link**, choose Confluence and copy the link.
3. Send the link to a site admin, who opens it, selects the site and accepts the permissions.
4. Ask the same admin to approve the server: insert the macro on any page and click **Approve server** with the server's address ([install.md, step 4](install.md#4-approve-the-craft-server)).

## App ownership

Register the app in a developer space owned by the team, not under an individual account, so it stays maintainable when people change roles. Alternatively, add team members as contributors (developer console → the app → **Contributors**).

## Security review

Answers to the questions security and platform reviewers usually ask:

- **Confluence access:** the page the macro is on (to locate it) and that page's attachments (to store and display the diagram). Scopes: `read:page:confluence`, `read:content-details:confluence`, `read:attachment:confluence`, `write:attachment:confluence`.
- **Data leaving Confluence:** when an editor previews or saves a diagram, their browser sends the diagram's model (the craft source, or a source name and a selection) to the craft server approved by the site admin. Nothing is sent elsewhere. Readers send nothing.
- **Where the code runs:** in the browser only, as Forge Custom UI hosted by Atlassian. The app has no backend functions and stores nothing outside the page.
- **The craft server:** a container on the internal network. It needs no inbound internet access and no Atlassian credentials. If git sources are configured, it needs outbound access to GitLab with a read-only token.
- **Server access:** anyone on the network the server runs on can reach it. Keep it on the internal network or behind the VPN, and configure only repositories whose models everyone on that network may see.
- **Egress:** the app uses customer-managed egress. The site admin sets the server address and can change it; nothing is hardcoded. Atlassian does not allow this setting to be removed once the app is in production.

## Request template

> We would like to install a Confluence app that generates architecture diagrams from our Craft models. The app is open source (github.com/tcarcao/craft-confluence) and we deploy our own copy. Could you:
>
> 1. install it on our Confluence site using this link: `<installation link>`;
> 2. insert the **arch-craft** macro on any page and approve `https://<craft server address>` when prompted.
>
> The app reads and writes attachments on the pages where it is used. It communicates only with our internal craft server, from the editor's browser. No data is sent to third parties.
