# Using the macro

Insert it from the page editor with `/craft` → **Craft diagram**. The editor opens straight away; reopen it later by selecting the diagram and clicking the edit (pencil) button.

## Choosing where the model comes from

The **Model** picker at the top has three options.

### Written here

The craft source lives in the macro. Write it in the editor on the left and click **Preview**. Problems the server finds are underlined on the right line: red for errors, which block saving, yellow for warnings. Hover an underline to read the message.

Use it for one-off diagrams that do not belong in a shared model.

### From git

Pick a **Source** (the server's list of git models), optionally a branch or merge request, then tick the use cases to show. The list says which file each use case lives in, and the filter box narrows it. With nothing ticked, the diagram shows the whole model.

The diagram is drawn from the whole source, so a use case resolves the contexts, services and stores declared in other files and repos of that source.

Nothing is copied into the page except the selection and the rendered image, so the model has one home: git.

### Written here, on top of git

Write only the new part, usually one use case, and it is rendered against the source's model in git. The diagram shows only what you wrote, but the contexts and services it uses come from git, so names, owners and stores match what already exists.

Use it in design docs that propose something not built yet.

When the proposal is merged, open the macro again: if every use case you wrote now exists in git, the editor says so and offers **Read from git instead**. That switches the macro to "From git" with those use cases ticked, so the page follows git from then on.

## Branches and merge requests

The **Branch or MR** field takes:

- nothing: the source's default branch;
- a branch, tag or commit: `release-2026-10`;
- a GitLab merge request: `!12`.

Typing in the field reloads the use case list for that ref. A source made of several repos shows one field per repo, so a merge request in one repo can be combined with the default branch of the others.

## When git changes

A saved diagram does not change by itself. When you open a macro whose model changed in git since it was saved, the editor shows:

> The model in git changed since this diagram was saved. Preview, then Save to update it.

The stored diagram is shown until you do. Commits that do not touch the source's folders do not count as changes.

If a ticked use case no longer exists at that ref (it was renamed or removed), the editor names it, so you can untick it or pick another branch.

## Diagram types

| Type | Shows |
| --- | --- |
| C4 containers | Services, data stores and exposures, grouped in boundaries. Always the whole model. |
| C4 containers (no boundaries) | The same without the grouping boxes. |
| Domain architecture | Bounded contexts by service. A compact overview. |
| Domain flow | How contexts interact across the selected use cases. |
| Sequence | Each selected use case as a sequence of interactions. Usually the most readable in a document. |

## Size and caption

- **Size:** Small, Medium, Large or Full width, as a share of the text column. Diagrams are SVG, so they stay sharp at any size.
- **Title:** shown as a caption under the diagram. It fills itself from the model ("User Login: sequence") and keeps following it until you type your own.

Size and title never call the server; saving after changing only those keeps the stored diagram. Diagrams read from git also show where they came from under the caption, for example "From payments @ 8dbb458".

## Who needs what

| Person | Needs |
| --- | --- |
| Reader | Nothing beyond access to the page. Diagrams load from the page's attachments. |
| Editor of a diagram | Network access to the craft server (VPN, for example), and to allow the browser's local network prompt once. |
| Site admin | Approves the craft server once ([docs/install.md](install.md#4-approve-the-craft-server)). |
