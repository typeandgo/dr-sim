# DR-SIM — Guide

**English** · [Türkçe](./guide.tr.md)

What DR-SIM is, how it is used, and the anatomy of a profile file. Written for first-time users; no technical background required.

## Contents

- [What is DR-SIM?](#what-is-dr-sim)
- [What is it good for?](#what-is-it-good-for)
- [A few words first](#a-few-words-first)
- [First run: four steps](#first-run-four-steps)
- [Everyday use: a four-step loop](#everyday-use-a-four-step-loop)
- [Reading the inventory](#reading-the-inventory)
- [The most common mistake: two different addresses](#the-most-common-mistake-two-different-addresses)
- [Profiles: share your setup](#profiles-share-your-setup)
- [Reports](#reports)
- [If something is not working](#if-something-is-not-working)
- [Where does your data go?](#where-does-your-data-go)
- [Sample profile](#sample-profile)
- [Profile fields](#profile-fields)

## What is DR-SIM?

Without you noticing, a web application constantly asks questions to services running behind it: who is this user, what is in the cart, what are the details of this record. So what happens when one of those services stops working? Does the screen go blank, does a helpful warning appear, or does the page lock up completely?

DR-SIM lets you answer that question without breaking anything for real. It interrupts the service calls you choose, only in your own browser and only while you have it switched on. It never touches the server, never changes the database, and no other user feels a thing.

> In short: it lets you rehearse “what if that service went down?” without affecting anyone.

## What is it good for?

In disaster recovery drills the real question is this: when one part of the system falls over, can the rest stay on its feet? Waiting for a genuine outage to find out is an expensive way to learn.

- You prepare before a real outage happens.
- You see in black and white which screen depends on which service.
- You test whether the error messages shown to users are actually understandable.
- You download what you found as a report and share it with the team.

## A few words first

A handful of terms come up in the panel. All of them are simpler than they look:

- **Endpoint (EP for short)** — A single address the application asks for something from. It appears in the panel as something like “GET /users/current”. Every separate question the page asks is one EP.
- **Domain** — The server those questions go to, for example api.company.com. DR-SIM only manages requests going to the domains you enter; it leaves everything else alone.
- **Rule** — The decision you make for an EP: Allowed (let it work normally) or Blocked (return a fault).
- **Default behaviour** — What happens to EPs you have written no rule for. Choose “Block” and everything outside your list returns a fault; choose “Pass” and only the ones you blocked individually return a fault.
- **Fault** — How a blocked request fails: a server error (503), a network error, or no answer at all until it times out.

## First run: four steps

1. Open the application you want to test in a tab, then click the extension icon. The panel opens at the side.
2. In the Domain box at the top of the panel, type the address the application pulls data from (for example api.company.com) and press Add. Chrome will ask for permission; grant it.
3. Reload the page. The “Page EP inventory” starts filling up — you see live which services the application calls.
4. When you are ready, flip the switch at the top right to ON. Requests now start being blocked according to your rules.

> The inventory fills up even while the switch is OFF. So you can just watch first, get to know the application, and decide later.

## Everyday use: a four-step loop

This loop is what DR-SIM is really for. You repeat it for each page:

1. Set the default behaviour to “Block”. Everything you have not allowed now returns a fault — meaning you are testing the harshest scenario.
2. Reload the page and look at what stops working. The page probably will not open at all; that is normal.
3. Allow the EPs the page genuinely needs to come back up. The quickest way is the Allow button in the “Recent failures” list.
4. Reload again. When the loop settles you have a list of exactly what this page needs to stay standing.

Before moving to the next page you press Reset; the rule list is cleared and you start the new page from scratch.

## Reading the inventory

Every row in the inventory is one EP. The coloured bar on the left of a row tells you two separate things: its colour is the EP’s current state, and its shape is where that state came from.

- **Red or green** — Red: this EP is currently blocked and will return a fault when called. Green: it is allowed and works normally. The button on the right of the row says the same thing; clicking it flips the state.
- **Solid line** — You made the decision for this EP yourself, meaning it has a written rule. This row stays exactly as it is even if you change the default behaviour.
- **Dashed line** — There is no rule for this EP; the row is following the default behaviour. Switch the default from “Block” to “Pass” and the colour of these rows turns with it.
- **The ✕ button** — Deletes the rule you wrote and hands the row back to the default — that is, it turns a solid line into a dashed one. Pressing it on a row that has no rule is harmless; nothing changes.

The small labels on a row tell you where the EP is known from:

- **profile** — This EP is defined in the profile you loaded — part of the scenario your team agreed on.
- **page** — This EP was found while browsing the page but is not in the profile. Completing your profile means reducing these labels one by one.
- **sync XHR** — The request was made in an older way that cannot be awaited; DR-SIM cannot block it and passes it straight through. If an EP simply refuses to be blocked, check this label first.

> The bar and the label answer different questions: the bar is “have I written a rule for this EP”, the label is “is this EP defined in my profile”. You may well have allowed an EP by hand and never written it into your profile.

## The most common mistake: two different addresses

The address the application is served from and the address it pulls data from are usually different. You browse panel.company.com, but the data comes from api.company.com.

DR-SIM needs to know both: Domain says which requests to manage, while Active page says which page the extension should run inside. If you see the “Not injected into this page” warning in the panel, press Run on this page and reload.

> If nothing is being captured, this is the first place to look.

## Profiles: share your setup

The scenario you built — which EPs are blocked, which domains are in scope, what the fault type is — can be exported to a single file.

In the panel’s Profile section, download it with “⤒ Export”, send it to a teammate, and they pick it up with “⤓ Import”. You have both run the same test with the same setup. A profile you no longer want can be taken off the list with Remove.

## Reports

There are two download buttons at the bottom of the panel:

- **⤓ Report MD** — Downloads what was blocked, what passed and a summary of the round as readable text. Ideal for pasting into a note or a ticket; it leaves a blank space for you to write your observation.
- **⤓ Report JSON** — Gives you the raw data: the duration and status code of every request, and all success and failure entries. For feeding another tool or comparing two rounds.

## If something is not working

- No requests show up in the panel: make sure you added the domain and reloaded the page. The extension enters the page as it loads, so a reload is required.
- The Chrome permission dialog never appeared: the domain was not added, so press Add again. If you granted access earlier and then withdrew it, the domain turns amber and the “Allow” button next to it restores access.
- Everything is blocked and the page never opens: that is the expected behaviour, it is the test itself. Move forward by allowing the EPs that are needed; if you want out quickly, flip the switch to OFF.
- It says the extension cannot run on this kind of page: no extension can run on the browser’s own pages (those starting with chrome://, the extension store). Switch to an ordinary web page.
- The page opens but nothing is being blocked: check in order whether the switch is ON, whether the domain is right, and whether the default behaviour is what you expect.

## Where does your data go?

Nowhere. Everything stays on your own computer in the browser’s own storage; DR-SIM never sends any data to any server.

Request headers are not recorded at all by default. Even if you turn that on in the settings, sensitive fields such as passwords and session keys are masked as they are written. Request bodies are never recorded under any circumstances.

## Sample profile

A ready-made profile file. Download it, adjust the domain and rules to your own application, then load it from the panel with “⤓ Import”.

```json
{
  "id": "ornek-profil",
  "name": "Sample — payment closed",
  "defaultPolicy": "block",
  "domains": [
    {
      "id": "d1",
      "pattern": "api.example.com"
    }
  ],
  "rules": [
    {
      "key": "GET /users/current",
      "method": "GET",
      "path": "/users/current",
      "state": "allow",
      "source": "preset",
      "note": "needed for login, must stay open",
      "createdAt": 0
    },
    {
      "key": "GET /orders/:id/detail",
      "method": "GET",
      "path": "/orders/:id/detail",
      "state": "allow",
      "source": "preset",
      "note": "record id normalized with :id",
      "createdAt": 0
    },
    {
      "key": "POST /payments/checkout",
      "method": "POST",
      "path": "/payments/checkout",
      "state": "block",
      "source": "preset",
      "note": "the endpoint being tested for the DR scenario",
      "createdAt": 0
    }
  ],
  "fault": {
    "kind": "http",
    "status": 503,
    "statusText": "Service Unavailable",
    "body": "{\"message\":\"DR simulated unavailable\"}",
    "headers": {},
    "delayMs": 0,
    "timeoutMs": 30000
  },
  "updatedAt": 0
}
```

The same file is in the repository: [`sample-profile.json`](./sample-profile.json)

> Ready-made scenario files are not part of the extension package. A profile file you received from your team is loaded with “⤓ Import” in the panel.

## Profile fields

A reference for the file above: what each key means. Only the “rules” list is required; everything else falls back to your current settings.

### `{ … }` — Top-level fields

The outermost layer of the file. The only field the import requires is the “rules” list; anything missing keeps your current settings or the defaults.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `rules` | array | yes | The rule records. This is the actual content of a profile; an empty array is valid but then the profile changes nothing. |
| `name` | string | no | The name shown in the panel’s profile list. If left empty a fallback name in the interface language is assigned. The exported file name is derived from it too. |
| `defaultPolicy` | "block" \| "pass" | no | What happens to endpoints you wrote no rule for. "block" → everything not on the list fails. "pass" → only the ones you explicitly blocked fail. An unrecognised value is treated as "block". |
| `domains` | array | no | The domain scope shipped with the profile. If you pass an empty array your current domains are kept when the profile is applied — so a shared profile cannot wipe your scope. |
| `fault` | object | no | How blocked requests fail. If omitted, your current fault setting is kept. |
| `id` | string | no | The profile identity. Importing twice with the same id overwrites the earlier one. Leave it out and a new identity is generated — you rarely need to write it by hand. |
| `updatedAt` | number | no | Last change time (Unix ms). Ignored on import and replaced with the current time; you can leave it at 0. |

### `rules[]` — Rule record

Each record sets the state of exactly one endpoint. Wildcards are not supported: an endpoint has one single state, there is no precedence or conflict logic.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `key` | string | yes | The primary key, written as “METHOD /path” — it must be exactly `method` + a space + `path`. Matching runs on this, so a key inconsistent with the other two fields makes the rule unreachable. |
| `method` | string | yes | HTTP method in upper case: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. |
| `path` | string | yes | The normalized path. Variable segments are written as :id — not /orders/8842/detail but /orders/:id/detail. Leaving a raw id in matches that single record only, so in practice it never matches. |
| `state` | "allow" \| "block" | yes | "allow" → the request reaches the real backend. "block" → the request is intercepted and the selected fault is returned. |
| `source` | "inventory" \| "manual" \| "preset" \| "quick-allow" | no | Where the record came from; informational only, it does not affect the decision. "preset" is a sensible choice for hand-written profiles. |
| `note` | string | no | A free-form comment — “needed for login, must stay open”. The easiest way to carry the reasoning along when you share a profile. |
| `createdAt` | number | no | When the record was created (Unix ms). You can leave it at 0 when writing by hand. |

### `domains[]` — Domain scope

Selects which requests are managed — that is, the API host. Nothing outside this list is ever touched.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `pattern` | string | yes | A host with an optional base path: api.example.com, *.example.com, api.example.com/gw. Do not write the protocol. A port is allowed (localhost:5175) and is preserved when matching requests. |
| `id` | string | no | Record identity. A short value is enough when writing by hand; it means nothing beyond being unique. |
| `granted` | true \| false | no | Whether host access was granted. This field is not read from the file — it is recomputed from the browser’s real permission state, so permissions cannot travel inside a shared profile. |

### `fault` — Fault setting

Every blocked request fails this way. The setting is global: there is no per-rule fault.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `kind` | "http" \| "network" \| "timeout" | yes | "http" → a response with the status code you chose. "network" → the request fails at the network level (as if the server was never reached). "timeout" → no response ever arrives and the request times out. |
| `status` | number | yes | HTTP status code — 503, 500, 429 and so on. Used only when kind is "http". |
| `statusText` | string | yes | The status text, e.g. "Service Unavailable". Used only when kind is "http". |
| `body` | string | yes | The response body; if you want to return JSON, write the JSON itself AS A STRING. Valid JSON is served as application/json, anything else as plain text. |
| `headers` | object | yes | Extra headers added to the response. An empty object ({}) is the usual case. Simulated responses always carry an x-drsim-simulated header regardless. |
| `delayMs` | number | yes | How long to wait before returning the fault (ms). Useful for imitating a slow service; 0 means respond immediately. |
| `timeoutMs` | number | yes | How long to wait before timing out (ms). Used only when kind is "timeout". |

---

[← Back to the README](../README.md)
