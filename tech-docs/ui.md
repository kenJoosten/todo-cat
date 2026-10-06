# UI

todo-cat has one visual direction, "Blue hour on the windowsill": Lissie watches the household from the windowsill as the sky turns periwinkle, and the interface is her vantage point. Light mode is early blue hour; dark mode is the same sill at night.

## The direction

- **Color:** a dusk-blue ground, indigo ink, and her amber eyes as the only accent. Amber marks the one main action of a page (Add, Sign in, Approve, Send), checkboxes, focus rings on inputs, and the claw marks; it is never text on the light ground.
- **Type:** Imbue (a condensed Didone) for the wordmark, page titles and section heads, upright and haughty like a cat sitting very straight; Atkinson Hyperlegible Next for everything read or typed; Atkinson Hyperlegible Mono only for codes a user compares or types (the device code, the API tester's ids and JSON).
- **Layout:** left-aligned. Forms sit in one narrow column; `/` puts the list in the main column and the chat beside it (under it on phones). The list sits on the ground with rules between rows, and only the chat is a raised panel, so the two read as different things.
- **The signature detail:** a done todo's title is crossed by three tapered amber claw marks, not a line-through (`components/ui/claw-marks.tsx`). They draw left to right once when a todo is checked off while the list is on screen, by the user or by Lissie, and not for done todos on page load or with reduced motion. It is the only decorative motion; keep it that way.
- **Copy:** Lissie's voice in titles and empty states (dry, faintly superior), plain words on controls and errors.
- Avoid: all-caps labels, paw prints or other cat clip-art, a second accent color, and cards around list rows.

## Where things live

- Tokens: `app/globals.css`, one `@theme` block (light) and a `prefers-color-scheme: dark` block that redefines the same variables; components use the utilities (`bg-ground`, `text-ink`, `bg-surface`, ...) and never raw colors, so both modes follow from those two blocks.
- `on-amber` is the text color on amber in both modes; `night` and `on-night` are for a panel that stays dark in both modes (the API tester's response).
- Fonts: `app/layout.tsx` loads them with `next/font/google` as CSS variables, which `@theme inline` maps to `font-display`, `font-sans` and `font-mono`. Imbue's optical size follows the font size by itself (`font-optical-sizing: auto`), so don't set `opsz`.
- Shared components: `components/ui/`, including the page shell (wordmark and header actions), titles, section headings, buttons (`primary`, `secondary`, `danger`, `quiet`), the inline confirm step before something that can't be undone (deleting a todo, clearing the chat), fields, the checkbox and the claw marks. Pages compose them instead of repeating class strings.
- The list on `/`: `app/todo-list.tsx`, with its Server Actions in `app/todo-actions.ts` (see [architecture.md](architecture.md)).
- The chat's theme: `app/lissie-chat.css`.
- Dark mode follows the system setting; there is no toggle.

## CopilotKit styling gotchas

- The v2 chat reads shadcn-style tokens (`--background`, `--foreground`, `--primary`, ...) on `[data-copilotkit]`; `lissie-chat.css` maps them to the app's tokens, which switch with the color scheme.
- CopilotKit's dark styles key on a `.dark` class, not `prefers-color-scheme`; the app never sets it, so all of the chat's dark mode comes from the token mapping.
- Messages are Tailwind Typography `prose`, which sets `--tw-prose-*` on the `.cpk:prose` element itself and only inverts under `.dark`; `lissie-chat.css` overrides those variables on that element, or messages are grey on indigo in dark mode.
- The input pill, its add and send buttons and the placeholder use fixed colors (`bg-white`, `#444`, `#0d0d0d`, `#00000077`), so they are styled by `data-testid`; check those test ids after a CopilotKit upgrade.
- Its font comes from `--cpk-font-sans`, set to Atkinson.
- To find what still ignores the tokens, render the chat in dark mode with a conversation in Mastra memory and look for computed colors that don't come from the palette.

## Checking a change

- Look at it in light and dark mode at desktop and phone width (Playwright's `colorScheme` and viewport), with a conversation in the chat, before calling it done.
- Contrast: body text is ink or muted on ground or surface; amber carries only fills and marks, with on-amber text.
