# Running the craft server

The macro renders diagrams through a craft server that you run. Only people editing diagrams talk to it, from their browser, so it can live on an internal network (behind a VPN, for example). Readers never call it.

## 1. Start the server

The server is published as a Docker image:

```sh
docker run -d --name craft -p 8080:8080 tiagocarcao/craft:<version>
```

Use a version newer than v2.27.0. Earlier servers answer browser preflight requests with a bare 405, so the macro cannot reach them, and they have no git sources.

That is enough for diagrams written in the macro. For diagrams read from git, add a sources file (section 3).

## 2. Put HTTPS in front of it

Forge only lets a site admin approve `https://` domains, so the server needs a certificate your users' browsers trust. Any reverse proxy works. With nginx:

```nginx
server {
    listen 443 ssl;
    server_name craft.example.internal;
    ssl_certificate     /etc/ssl/craft.crt;
    ssl_certificate_key /etc/ssl/craft.key;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_read_timeout 60s;
    }
}
```

The proxy must pass `OPTIONS` requests and the server's CORS headers through unchanged. The server answers every origin (`Access-Control-Allow-Origin: *`) and Chrome's private network preflight (`Access-Control-Allow-Private-Network: true`).

Check it from a machine on the same network:

```sh
curl -i -X OPTIONS https://craft.example.internal/preview/c4 \
  -H 'Origin: https://example.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Private-Network: true'
```

You should get `200 OK` with both headers above.

## 3. Configure git sources (optional)

A **source** is a model kept in git. It is one or more repo folders merged into a single model, so a use case in one file can use contexts declared in another file, or another repo. Configure as many sources as you need. Unrelated models (for example, separate business units) go in separate sources.

Write a JSON file ([example](../examples/sources.example.json)):

```json
{
  "sources": [
    {
      "name": "payments",
      "repos": [
        {
          "name": "payments-model",
          "url": "https://oauth2:${GITLAB_TOKEN}@gitlab.example.com/architecture/payments-model.git",
          "branch": "main",
          "root": "craft"
        }
      ]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `name` (source) | What editors pick in the macro. Must be unique. |
| `repos[].name` | Label for the repo, shown in the macro when a source has several repos. Unique within the source. |
| `repos[].url` | Clone URL. `${VAR}` is replaced from the server's environment, so tokens stay out of the file. |
| `repos[].branch` | Branch used when the editor does not pick one. |
| `repos[].root` | Folder holding the `.craft` files. Leave it out to use the whole repo. |

Start the server with the file and a cache folder:

```sh
docker run -d --name craft -p 8080:8080 \
  -e CRAFT_SOURCES=/config/sources.json \
  -e CRAFT_CACHE=/cache \
  -e GITLAB_TOKEN=glpat-xxxxxxxx \
  -v "$PWD/sources.json:/config/sources.json:ro" \
  -v craft-cache:/cache \
  tiagocarcao/craft:<version>
```

| Variable | Meaning |
| --- | --- |
| `CRAFT_SOURCES` | Path to the sources file. Without it, the server has no git sources and the macro only offers "Written here". |
| `CRAFT_CACHE` | Where the server keeps its clones. Defaults to a temporary folder; mount a volume so restarts do not clone again. |
| anything in `${...}` | Tokens referenced from the URLs. A read-only token (a GitLab deploy token or a project access token with `read_repository`) is enough. |

How the server uses git:

- Each repo is mirrored on first use and fetched again when the copy is more than 30 seconds old.
- The mirror includes GitLab's merge request refs, so editors can render `!12` before it is merged.
- Editors only ever send a source name and a branch or merge request. They cannot make the server clone an arbitrary URL.
- The server reports a "content id" built from the git tree of each `root` folder. It changes only when the model changes, which is how the macro tells editors that a saved diagram is out of date.

Check it:

```sh
curl https://craft.example.internal/sources
curl -X POST https://craft.example.internal/sources/payments/catalog -d '{}'
```

## Access control

Anyone who can reach the server can render any configured source. Keep it on a network only your staff can reach (VPN or internal network), and configure only repos whose models are fine to show to everyone there.

## Browser prompt

Chrome asks each user once whether Confluence may access devices on the local network, the first time the editor calls an internal server. The request waits until they answer. If they block it, the editor cannot reach the server until they allow it again in the site settings. Organisations that manage Chrome can pre-allow it with Chrome's Local Network Access enterprise policies.
