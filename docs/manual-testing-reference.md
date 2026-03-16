# TestAlly manual testing reference

## How this document works

This document is a structured reference for an AI assistant. Each component follows the same repeating pattern so the AI can reliably extract testing instructions for any component type.

The format for every test step is **ITTT: If This, Then That.**
Each step describes one user action and one expected outcome. A step passes when the expected outcome matches what actually happens. A step fails when it does not.

The AI should use this document to:
1. Identify which component the developer is working with.
2. Select the matching section from this reference.
3. Walk the developer through each test, one step at a time.
4. When a step fails, explain what likely went wrong and cite the relevant WCAG success criterion.

### A note on screen reader announcements

Screen reader software (NVDA, JAWS, VoiceOver, TalkBack) all phrase announcements differently. This document describes the **meaning** that must be announced, not the exact words. When a test step says the screen reader should announce "button, expanded," the actual announcement might be "Section title, expanded, button" (NVDA) or "Section title, button, expanded" (VoiceOver). What matters is that the role, name, and state are all present.

### A note on testing scope

This document covers the most common implementation of each pattern. Variations exist. When the AI encounters a pattern that deviates from what is described here, it should flag the deviation and explain what additional testing may be needed.

---

## Component: Accordion

### What this component is

An accordion is a vertically stacked list of headers. Each header can be activated to reveal or hide a panel of content beneath it. Only the headers are interactive. The panels are passive content regions.

Think of it like a filing cabinet. Each drawer (header) has a label on the front. You pull a drawer open to see what is inside (the panel). You can close it again. The drawer handle is the only part you grab — you never interact with the contents to open or close the drawer.

### Expected semantic structure

The AI should check the component's code against this expected structure before generating test steps. Deviations from this structure are likely the root cause of test failures.

```html
<div class="accordion">

  <!-- One accordion item -->
  <h3>
    <button
      aria-expanded="false"
      aria-controls="panel-1"
      id="header-1"
    >
      Section title
    </button>
  </h3>
  <div
    id="panel-1"
    role="region"
    aria-labelledby="header-1"
  >
    <p>Panel content goes here.</p>
  </div>

  <!-- Next accordion item follows the same pattern -->

</div>
```

Key semantic requirements:
- Each header MUST be a `<button>` element, or have `role="button"`. A `<div>` or `<a>` without a role will fail screen reader and keyboard tests.
- The button MUST have `aria-expanded` set to `"true"` or `"false"` to communicate the open/closed state.
- The button SHOULD have `aria-controls` pointing to the `id` of the associated panel.
- The panel SHOULD have `role="region"` and `aria-labelledby` pointing back to the header, so screen readers can announce what the region belongs to.
- The heading level (h2, h3, h4) MUST fit the existing page hierarchy. It must not skip levels or restart at h1.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | The header/panel relationship must be programmatically conveyed, not just visual. |
| 1.3.2 Meaningful Sequence | A | Panel content must follow its header in the DOM order. |
| 2.1.1 Keyboard | A | All accordion functionality must be operable with a keyboard. |
| 2.4.3 Focus Order | A | Focus must move through headers and panels in a logical sequence. |
| 2.4.6 Headings and Labels | AA | The accordion header text must clearly describe the panel content. |
| 2.4.7 Focus Visible | AA | The focused header must have a visible focus indicator. |
| 4.1.2 Name, Role, Value | A | The button's name, expanded/collapsed state, and role must be exposed to assistive technology. |

### APG reference

ARIA Authoring Practices Guide — Accordion Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/accordion/

---

### Test method 1: Keyboard only

**Setup:** Disconnect or stop using your mouse. Begin with focus at the top of the page or just before the accordion component.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move focus to the first accordion header. | Focus lands on the first header button. A visible focus ring or outline appears around it. | 2.1.1, 2.4.7 | If focus skips the header entirely, the header is likely not a focusable element (missing `<button>` or `tabindex`). If focus lands but no visible indicator appears, the CSS may be suppressing the outline without providing a replacement. |
| K2 | Press `Enter` or `Space` on the focused header. | The panel below that header expands and becomes visible. The header's state changes to indicate it is open (for example, an icon rotates or text changes). | 2.1.1, 4.1.2 | If nothing happens, the button likely has no click/keydown handler, or the element is not a real `<button>`. If the panel opens but the visual state indicator does not change, the component may be toggling `aria-expanded` without updating the visual cue (or vice versa). |
| K3 | Press `Enter` or `Space` again on the same header. | The panel collapses and is no longer visible. The header returns to its closed state. | 2.1.1, 4.1.2 | If the panel does not collapse, the toggle logic may only handle opening. Check that `aria-expanded` switches between `"true"` and `"false"`. |
| K4 | Press `Tab` while a panel is expanded. | Focus moves into the panel content (links, text, form fields inside the panel). | 2.4.3 | If focus jumps past the panel to the next header, the panel content may be hidden with `display: none` or `visibility: hidden` even when it appears visually open, or it may lack focusable elements. |
| K5 | Press `Tab` until focus leaves the panel content. | Focus moves to the next accordion header. | 2.4.3 | If focus jumps somewhere unexpected (like back to the top of the page), the DOM order may not match the visual order, or there is a focus trap inside the panel. |
| K6 | (Optional, APG pattern) Press `Arrow Down` on a header. | Focus moves to the next accordion header, without opening or closing anything. | 2.1.1 | Arrow key navigation between headers is recommended by the APG but not strictly required by WCAG. If it does not work, note it as an enhancement rather than a failure, unless the developer explicitly follows the APG accordion pattern. |
| K7 | (Optional, APG pattern) Press `Home` on any header. | Focus moves to the first accordion header. | 2.1.1 | Same as K6. This is an APG recommendation. |
| K8 | (Optional, APG pattern) Press `End` on any header. | Focus moves to the last accordion header. | 2.1.1 | Same as K6. This is an APG recommendation. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the accordion component using heading navigation or Tab.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to the first accordion header using the screen reader. | The screen reader announces: the heading level, the header text, and that it is a button. It also announces the current state (collapsed or expanded). Example: "Heading level 3, Section title, collapsed, button." | 1.3.1, 4.1.2 | If the screen reader does not announce "button," the element is missing the button role. If it does not announce "collapsed" or "expanded," `aria-expanded` is missing or not set. If it does not announce a heading level, the button is not wrapped in a heading element. |
| SR2 | Activate the header (press `Enter` or `Space`). | The screen reader announces the state change: "expanded." The panel content becomes available to the reading cursor. | 4.1.2 | If there is no "expanded" announcement, `aria-expanded` is not toggling on activation. If panel content is not reachable, the panel may still be hidden from the accessibility tree (for example, using `aria-hidden="true"` that was not removed). |
| SR3 | Read forward into the panel content (press `Down Arrow` in NVDA browse mode, or swipe right in VoiceOver). | The screen reader reads the panel content in the order it appears. If the panel has a `role="region"` with `aria-labelledby`, the screen reader may announce entering a region. | 1.3.1, 1.3.2 | If the content reads out of order, the DOM order does not match the visual layout. If the region is not announced, the `role="region"` or `aria-labelledby` is missing or misconfigured. Note: the region announcement is a helpful landmark but not a strict WCAG requirement for accordions. |
| SR4 | Navigate back to the header and close the accordion. | The screen reader announces the state change: "collapsed." The panel content is no longer reachable by the reading cursor. | 4.1.2 | If "collapsed" is not announced, the `aria-expanded` attribute is not being updated. If the panel content is still reachable after collapsing, the content is not being properly hidden from the accessibility tree. |
| SR5 | Use heading navigation (press `H` in NVDA, or use the rotor in VoiceOver) to jump between accordion headers. | Each accordion header appears in the headings list and can be jumped to directly. | 1.3.1, 2.4.6 | If the headers do not appear in the headings list, the buttons are not nested inside heading elements. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software. The accordion must be visible on screen.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible header text]" (for example, "Click Section title"). | The accordion panel expands. The voice control software identifies the header as a clickable target. | 2.5.3 | If the voice control software cannot find the target, the accessible name of the button may not match the visible text. This often happens when `aria-label` overrides the visible text, or when the button's text is actually an image without alt text. WCAG 2.5.3 Label in Name requires that the accessible name contains the visible label text. |
| VC2 | Say "Click [visible header text]" again to close the panel. | The panel collapses. | 2.5.3, 2.1.1 | Same issues as VC1 apply. Also check that the toggle works in both directions. |
| VC3 | Say "Show numbers" or "Show links" (depending on the voice control software). | The accordion headers are highlighted with numbers or labels, making them selectable targets. | 4.1.2 | If the headers do not appear as selectable targets, they may not be recognised as interactive elements. This happens when a `<div>` or `<span>` is used instead of a `<button>`. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function. No assistive technology needed.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the accordion in its default (collapsed) state. | Each header clearly looks interactive (visually distinct from body text). The expanded/collapsed state is indicated by more than just colour — for example, an arrow, plus/minus icon, or text label. | 1.4.1, 1.4.11 | If the headers look like plain text, users will not know they can interact with them. If the state is communicated only by colour (for example, blue when open, grey when closed), users with colour vision deficiencies will miss it. |
| VZ2 | Open one or more panels and check that the relationship between header and panel is visually clear. | The panel appears directly below its header, with clear visual grouping (indentation, background colour, border, or spacing). A user can tell which panel belongs to which header without reading every label. | 1.3.1, 1.4.1 | If the panel content appears disconnected from its header (for example, separated by another component), users may not understand the relationship. |
| VZ3 | Zoom the browser to 200% (Ctrl/Cmd + until the zoom reads 200%). | The accordion is still fully usable. No text is cut off. No headers overlap. No horizontal scrollbar appears (content reflows into a single column if needed). | 1.4.4, 1.4.10 | If text overflows or is clipped, the component likely uses fixed pixel widths or `overflow: hidden`. If a horizontal scrollbar appears, the CSS is not handling reflow. |
| VZ4 | Zoom the browser to 400%. | The accordion still functions. Content reflows to fit a narrow viewport. All headers and panels remain readable and interactive. | 1.4.10 | 400% zoom on a 1280px-wide viewport simulates a 320px-wide screen. The accordion must behave as a responsive component at this size. |
| VZ5 | Tab through the accordion headers and check focus visibility. | Every focused header has a visible focus indicator that meets a minimum 3:1 contrast ratio against the surrounding area. The focus indicator is not fully hidden behind another element (for example, a sticky header). | 2.4.7, 2.4.11, 2.4.13 | If the focus indicator disappears or is very faint, the CSS may suppress `outline` or use a low-contrast colour. If the indicator is partially hidden behind another element, the focus is obscured. 2.4.11 requires that focus is not fully obscured by author-created content. |

---

### Common failures for accordion components

These are patterns the AI should flag proactively when analysing accordion code, even before testing begins.

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| Div instead of button | `<div class="accordion-header" onclick="toggle()">` | Not focusable by keyboard. Not announced as interactive by screen readers. Fails 2.1.1 and 4.1.2. |
| Missing aria-expanded | `<button>Section title</button>` with no `aria-expanded` attribute. | Screen readers cannot communicate whether the panel is open or closed. Fails 4.1.2. |
| Anchor without href used as toggle | `<a onclick="toggle()">Section title</a>` | Without `href`, the anchor is not focusable in all browsers. Screen readers may not treat it as interactive. Fails 2.1.1. |
| Outline removed without replacement | `button:focus { outline: none; }` with no alternative focus style. | The keyboard user cannot see where their focus is. Fails 2.4.7. |
| Panel hidden with aria-hidden but still visible | Panel has `aria-hidden="true"` while visually open. | Screen reader users cannot access content that sighted users can see. Fails 1.3.1. |
| Panel visible but not reachable | Panel animated open with CSS but content has `display: none` or `tabindex="-1"` on all children. | Keyboard and screen reader users cannot access the panel even though it appears open. Fails 2.1.1, 1.3.1. |
| Heading level mismatch | Page has h1 and h2, but the accordion uses h4 headers. | Skipping heading levels breaks the document outline and confuses screen reader navigation. Fails 1.3.1. |
| Icon-only state indicator | Expanded/collapsed shown by a rotated CSS triangle, with no text alternative or aria attribute. | The visual cue is meaningless to screen readers and may be missed by users with low vision. Fails 4.1.2. |

---
---

## Component: Tabs

### What this component is

A tabs component is a set of labelled triggers (the tabs) that each reveal one panel of content at a time. Selecting a tab hides the previously visible panel and shows the one associated with the selected tab.

Think of it like the dividers in a physical binder. You can see all the labelled tabs sticking out at the top, and you flip to the one you want. Only one section of the binder is open at a time, and you always know which section you are looking at because the divider tab is visually highlighted.

### Expected semantic structure

```html
<div role="tablist" aria-label="Description of the tab group">

  <button
    role="tab"
    id="tab-1"
    aria-selected="true"
    aria-controls="panel-1"
  >
    Tab one
  </button>

  <button
    role="tab"
    id="tab-2"
    aria-selected="false"
    aria-controls="panel-2"
    tabindex="-1"
  >
    Tab two
  </button>

</div>

<div
  role="tabpanel"
  id="panel-1"
  aria-labelledby="tab-1"
>
  <p>Panel one content.</p>
</div>

<div
  role="tabpanel"
  id="panel-2"
  aria-labelledby="tab-2"
  hidden
>
  <p>Panel two content.</p>
</div>
```

Key semantic requirements:
- The tab container MUST have `role="tablist"`.
- Each tab MUST have `role="tab"`.
- The active tab MUST have `aria-selected="true"`. All other tabs MUST have `aria-selected="false"`.
- Inactive tabs SHOULD have `tabindex="-1"` so only the active tab is in the Tab order. Arrow keys move between tabs.
- Each panel MUST have `role="tabpanel"`.
- Each panel MUST be associated with its tab via `aria-labelledby` pointing to the tab's `id`.
- Each tab SHOULD have `aria-controls` pointing to the panel's `id`.
- The tablist SHOULD have an `aria-label` or `aria-labelledby` to describe the group.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | The tab/panel structure and the selected state must be programmatically exposed. |
| 2.1.1 Keyboard | A | All tab switching and panel access must be keyboard operable. |
| 2.4.3 Focus Order | A | Focus must follow a logical order: tabs, then into the active panel. |
| 2.4.7 Focus Visible | AA | The focused tab must have a visible focus indicator. |
| 4.1.2 Name, Role, Value | A | Each tab's name, role, and selected state must be exposed to assistive technology. |

### APG reference

ARIA Authoring Practices Guide — Tabs Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

---

### Test method 1: Keyboard only

**Setup:** Disconnect or stop using your mouse. Begin with focus before the tabs component.

**Note:** Tabs can follow two activation patterns. Automatic activation selects a tab as soon as it receives focus (arrow key moves focus and selects). Manual activation requires pressing `Enter` or `Space` after focusing a tab. Both are valid. The tests below cover automatic activation and note where manual activation differs.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move focus into the tab list. | Focus lands on the currently selected (active) tab. A visible focus indicator appears. | 2.1.1, 2.4.7 | If focus lands on the first tab regardless of which is selected, `tabindex` management may be incorrect. The active tab should have `tabindex="0"` and all others `tabindex="-1"`. |
| K2 | Press `Arrow Right`. | Focus moves to the next tab. With automatic activation, the new tab also becomes selected and its panel becomes visible. With manual activation, focus moves but the panel does not change until `Enter` or `Space` is pressed. | 2.1.1, 4.1.2 | If nothing happens, the component may not have arrow key handlers. If the panel does not switch (in automatic mode), the activation logic may not be connected to the focus movement. |
| K3 | Press `Arrow Right` while on the last tab. | Focus wraps to the first tab. | 2.1.1 | If focus stays on the last tab or leaves the tab list, the wrapping logic is missing. This is a recommended APG behaviour. |
| K4 | Press `Arrow Left`. | Focus moves to the previous tab (with the same activation behaviour as K2). | 2.1.1 | Mirror of K2. Same failure explanations apply. |
| K5 | Press `Tab` while a tab is focused. | Focus moves out of the tab list and into the active panel content. | 2.4.3 | If focus skips the panel entirely and moves to the next component after the tabs, the panel may be hidden from the focus order, or the panel may lack focusable content. If the panel has no interactive elements, the panel itself should have `tabindex="0"` so it receives focus. |
| K6 | Press `Shift+Tab` from inside the panel. | Focus moves back to the active tab in the tab list. | 2.4.3 | If focus jumps to an unexpected location, the DOM order may not match the visual layout. |
| K7 | (Optional, APG pattern) Press `Home` while in the tab list. | Focus moves to the first tab. | 2.1.1 | APG recommendation. Note as an enhancement if not present. |
| K8 | (Optional, APG pattern) Press `End` while in the tab list. | Focus moves to the last tab. | 2.1.1 | APG recommendation. Note as an enhancement if not present. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the tabs component.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to the tab list. | The screen reader announces that you are in a tab list, and announces the label of the tab group (if provided via `aria-label` or `aria-labelledby`). | 1.3.1, 4.1.2 | If "tab list" is not announced, `role="tablist"` is missing. If no group label is announced, the tablist lacks `aria-label` or `aria-labelledby`. |
| SR2 | Navigate to the active tab. | The screen reader announces: the tab text, that it is a tab, its position (for example, "1 of 3"), and that it is selected. | 1.3.1, 4.1.2 | If "tab" is not announced, `role="tab"` is missing. If "selected" is not announced, `aria-selected` is missing or not set to `"true"`. |
| SR3 | Arrow to an inactive tab. | The screen reader announces the tab text, its position, and that it is not selected. If automatic activation is used, the screen reader may also announce the panel switch. | 4.1.2 | If the tab is announced as selected when it should not be, `aria-selected` is not being updated correctly. |
| SR4 | Move reading cursor into the active panel. | The screen reader announces the panel content. If `role="tabpanel"` and `aria-labelledby` are present, it may announce entering a tab panel region with the tab's name. | 1.3.1 | If panel content is not reachable, it may be hidden from the accessibility tree. If the tabpanel role is not announced, `role="tabpanel"` is missing. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software. The tabs must be visible on screen.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible tab text]" (for example, "Click Tab two"). | The corresponding tab becomes selected and its panel becomes visible. | 2.5.3 | If the voice control software cannot find the target, the accessible name may not match the visible text. Check for `aria-label` overriding the visible text, or the tab text being inside an image or icon without alt text. |
| VC2 | Say "Show numbers." | Each tab is highlighted with a number, making them individually selectable. | 4.1.2 | If tabs do not appear as numbered targets, they may not be recognised as interactive. This happens when non-interactive elements (like `<div>` or `<li>`) are used without proper roles. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the tab list. | The selected tab is visually distinct from unselected tabs through more than just colour (for example, underline, bold weight, background change, or border). | 1.4.1, 1.4.11 | If the selected tab is only distinguished by colour, users with colour vision deficiencies will not be able to tell which tab is active. |
| VZ2 | Look at the relationship between the tab list and the active panel. | The panel appears directly beneath or beside the tab list. The selected tab and its panel are visually connected (shared border, aligned edges, matching background). | 1.3.1 | If the panel appears disconnected from the tab list, users may not understand which panel belongs to which tab. |
| VZ3 | Zoom to 200%. | Tabs remain usable. If the tabs do not fit on one line, they wrap or adapt gracefully (no overlapping, no cut-off text). | 1.4.4, 1.4.10 | If tab labels are truncated or overlap, the component uses fixed widths that do not adapt to zoom. |
| VZ4 | Zoom to 400%. | The component reflows into a usable single-column layout. All tab labels and panel content remain readable. | 1.4.10 | At 400% zoom on a 1280px viewport, the effective viewport is 320px. The tabs may need to stack vertically or become an accordion-like pattern. |
| VZ5 | Tab through the tab list and check focus visibility. | The focused tab has a visible focus indicator with at least 3:1 contrast ratio. The indicator is not hidden behind other elements. | 2.4.7, 2.4.11 | If the focus indicator is invisible or barely visible, check the CSS for `outline: none` or low-contrast focus styles. |

---

### Common failures for tab components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| Missing tablist role | `<div class="tabs">` without `role="tablist"`. | Screen readers cannot identify the tab structure. Fails 1.3.1. |
| Missing tab role | `<button class="tab">` without `role="tab"`. | Screen readers announce a generic button instead of a tab with position information. Fails 4.1.2. |
| Missing aria-selected | Tabs with no `aria-selected` attribute, using only a CSS class for the active state. | Screen readers cannot determine which tab is currently selected. Fails 4.1.2. |
| All tabs in the Tab order | Every tab has `tabindex="0"` or no tabindex management. | Users must press `Tab` multiple times to pass through the tab list instead of using arrow keys. This is not a WCAG failure but deviates from the expected APG interaction pattern and creates unnecessary keystrokes. |
| Panel not associated with tab | `<div class="panel">` without `role="tabpanel"` or `aria-labelledby`. | Screen readers cannot associate the panel with its tab. Fails 1.3.1. |
| Tab content rendered as links | `<a href="#panel-1" class="tab">` used for each tab. | Links navigate to a new location; tabs reveal a panel. Using links breaks the expected keyboard pattern (arrow keys vs Tab). Fails 4.1.2 because the role does not match the behaviour. |

---
---

## Component: Modal / dialog

### What this component is

A modal dialog is an overlay window that appears on top of the main page content. While the modal is open, the user cannot interact with anything behind it. The user must complete or dismiss the modal before returning to the page.

Think of it like someone holding a clipboard in front of your face. You have to deal with whatever is on the clipboard first — sign it, read it, or hand it back — before you can go back to what you were doing. You cannot reach past the clipboard to grab something on the desk behind it.

### Expected semantic structure

```html
<!-- Trigger button on the page -->
<button id="open-dialog">Open settings</button>

<!-- The dialog -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
>
  <h2 id="dialog-title">Settings</h2>
  <p>Dialog content goes here.</p>
  <button id="close-dialog">Close</button>
</div>
```

Key semantic requirements:
- The dialog container MUST have `role="dialog"` (or use the native `<dialog>` element).
- The dialog MUST have `aria-modal="true"` to signal that content behind the dialog is inert. Alternatively, using the native `<dialog>` element with `showModal()` handles this natively.
- The dialog MUST have an accessible name, provided by `aria-labelledby` pointing to a visible heading, or by `aria-label`.
- The dialog MUST have at least one way to close it (a close button, a cancel button, or both).
- When the dialog opens, focus MUST move into the dialog. Typically to the first focusable element, or to the dialog element itself if it has `tabindex="-1"`.
- When the dialog closes, focus MUST return to the element that triggered it.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | The dialog's role, label, and structure must be programmatically exposed. |
| 2.1.1 Keyboard | A | All dialog functionality (interaction, closing) must be keyboard operable. |
| 2.1.2 No Keyboard Trap | A | Although focus is constrained to the dialog while open, the user must always be able to close the dialog and return to the page. |
| 2.4.3 Focus Order | A | Focus must move into the dialog on open and return to the trigger on close. Focus order within the dialog must be logical. |
| 2.4.7 Focus Visible | AA | Focus indicators must be visible on all interactive elements inside the dialog. |
| 4.1.2 Name, Role, Value | A | The dialog role and its accessible name must be exposed. |

### APG reference

ARIA Authoring Practices Guide — Dialog (Modal) Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

---

### Test method 1: Keyboard only

**Setup:** Focus on the button or link that opens the dialog.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Enter` or `Space` on the trigger element. | The dialog opens. Focus moves inside the dialog (to the first focusable element, or to the dialog heading/container). The page behind the dialog is visually dimmed or obscured by a backdrop. | 2.1.1, 2.4.3 | If the dialog opens but focus stays on the trigger behind the dialog, the focus management logic is missing. If the backdrop is not present, the user may not realise the page behind is inactive. |
| K2 | Press `Tab` repeatedly inside the dialog. | Focus cycles through the interactive elements inside the dialog (form fields, buttons, links). After the last focusable element, focus wraps back to the first focusable element in the dialog. Focus never leaves the dialog. | 2.1.2, 2.4.3 | If focus escapes the dialog and moves to elements on the page behind it, the focus trap is not implemented. This can happen if `aria-modal="true"` is set but there is no JavaScript focus trap, because `aria-modal` alone does not prevent focus from leaving in all browsers. |
| K3 | Press `Shift+Tab` from the first focusable element in the dialog. | Focus wraps to the last focusable element in the dialog. | 2.1.2, 2.4.3 | If focus escapes backwards to the page, the focus trap is incomplete. |
| K4 | Press `Escape`. | The dialog closes. Focus returns to the trigger element that opened the dialog. | 2.1.1, 2.1.2 | If `Escape` does nothing, the key handler is missing. If the dialog closes but focus does not return to the trigger, the focus restoration logic is missing. The user is now lost on the page. |
| K5 | Press `Enter` or `Space` on the close button inside the dialog. | The dialog closes. Focus returns to the trigger element. | 2.1.1, 2.4.3 | Same focus-return requirement as K4. |
| K6 | With the dialog open, try pressing `Tab` many times (20+). | Focus never escapes the dialog, even after many Tab presses. | 2.1.2 | Some focus traps break after many cycles due to implementation bugs. This test confirms the trap is robust. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the trigger element.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Activate the trigger to open the dialog. | The screen reader announces that a dialog has opened. It announces the dialog's name (from `aria-labelledby` or `aria-label`). Example: "Settings, dialog." | 1.3.1, 4.1.2 | If "dialog" is not announced, `role="dialog"` is missing. If no name is announced, `aria-labelledby` or `aria-label` is missing. |
| SR2 | Read the content inside the dialog. | The screen reader reads the dialog content in a logical order: heading, body text, then interactive elements. | 1.3.1 | If the content reads in a confusing order, the DOM order inside the dialog does not match the visual layout. |
| SR3 | Try to read content outside the dialog (press `Down Arrow` or navigate landmarks). | The screen reader cannot reach content outside the dialog. All page content behind the dialog is hidden from the accessibility tree. | 4.1.2 | If the screen reader can read page content behind the dialog, `aria-modal="true"` is not working, or the background content has not been made inert. With native `<dialog>` and `showModal()`, the browser handles this. With a custom dialog, background content needs `aria-hidden="true"` or the `inert` attribute. |
| SR4 | Close the dialog. | The screen reader announces that focus has returned to the trigger. The previous context is restored. | 2.4.3 | If the screen reader is silent after closing, or announces an unexpected location, focus has not returned to the trigger. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software. The trigger element must be visible.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [trigger button text]" (for example, "Click Open settings"). | The dialog opens. | 2.5.3 | If the voice control cannot find the trigger, the accessible name may not match the visible text. |
| VC2 | With the dialog open, say "Click Close" or "Click [close button text]." | The dialog closes. | 2.5.3 | If the close button is an icon (for example, an X) with no accessible name, the voice control user cannot target it by name. The button needs visible text or an `aria-label` that a user can guess (like "Close"). |
| VC3 | With the dialog open, say "Show numbers." | Only elements inside the dialog are highlighted with numbers. Elements on the page behind the dialog are not selectable. | 4.1.2 | If background page elements appear as numbered targets, the dialog is not properly trapping interaction. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Open the dialog and look at the overlay. | The dialog has a visible backdrop that obscures the page content behind it. The dialog is clearly a separate layer. | 1.3.1 | If there is no backdrop or visual separation, users may not realise they are in a modal context and try to interact with the page behind it. |
| VZ2 | Check the dialog for a visible close mechanism. | There is at least one clearly labelled close or cancel button. If the dialog uses an icon-only close button (X), the icon is large enough to be recognised and has sufficient contrast. | 2.4.7, 2.5.8 | If the only close mechanism is the `Escape` key, mouse-only and touch users have no way to dismiss the dialog. An icon-only X that is too small (under 24x24 CSS pixels) fails 2.5.8 Target Size (Minimum). |
| VZ3 | Zoom to 200%. | The dialog content remains fully visible. No text is cut off. If the dialog content is taller than the viewport, it scrolls within the dialog (not the page behind it). | 1.4.4, 1.4.10 | If content overflows outside the dialog boundary, or if the close button scrolls out of view, the dialog is not handling overflow correctly. |
| VZ4 | Zoom to 400%. | The dialog reflows to fit the viewport. Content remains readable. The close button is still accessible. | 1.4.10 | At 400% zoom, the dialog may need to be nearly full-screen. If it overflows the viewport with no way to scroll, the dialog is not responsive. |
| VZ5 | Tab through elements inside the dialog. | Every interactive element has a visible focus indicator. | 2.4.7, 2.4.11 | If focus indicators are missing or hidden behind the dialog's own styling, check the CSS. |

---

### Common failures for modal/dialog components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| No focus management on open | Dialog opens but focus stays on the trigger behind the backdrop. | Keyboard user is trapped behind a visual overlay they cannot interact with. Fails 2.4.3. |
| No focus trap | `Tab` key moves focus from the dialog to elements behind the backdrop. | Keyboard user interacts with invisible page content. Fails 2.1.2 (the user can still escape, but they are interacting with content they should not reach). |
| No focus return on close | Dialog closes and focus jumps to the top of the page or to `<body>`. | Keyboard user loses their place. Fails 2.4.3. |
| Missing dialog role | `<div class="modal">` with no `role="dialog"`. | Screen readers do not know this is a dialog. Fails 4.1.2. |
| Missing accessible name | `role="dialog"` present but no `aria-labelledby` or `aria-label`. | Screen readers announce "dialog" with no context about what the dialog is for. Fails 4.1.2. |
| Background content not inert | `aria-modal="true"` is set but background content is still reachable by screen readers. | Screen reader can read and interact with content that is supposed to be hidden. Use `inert` attribute on background content or native `<dialog>` with `showModal()`. Fails 1.3.1, 4.1.2. |
| Escape key does not close | No `keydown` handler for the `Escape` key on the dialog. | Keyboard users have to Tab to the close button to dismiss the dialog. While not always a WCAG failure, it violates the expected dialog interaction pattern and creates friction. |
| Icon-only close button without name | `<button class="close"><svg>...</svg></button>` with no `aria-label` or visually hidden text. | Screen readers announce "button" with no name. Voice control users cannot target it. Fails 4.1.2 and 2.5.3. |

---
---

## Component: Navigation menu

### What this component is

A navigation menu is a collection of links that help users move between pages or sections of a website. It can be a simple flat list of links, or it can contain submenus (dropdown or flyout menus) that reveal nested links.

Think of it like a signpost at a crossroads. The signpost has several arms pointing in different directions, each labelled with a destination. Some arms might have smaller signs hanging below them for more specific destinations. You read the signs to decide where to go.

### Expected semantic structure

**Simple navigation (no submenus):**

```html
<nav aria-label="Main">
  <ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

**Navigation with submenus (disclosure pattern):**

```html
<nav aria-label="Main">
  <ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li>
      <button aria-expanded="false" aria-controls="submenu-products">
        Products
      </button>
      <ul id="submenu-products">
        <li><a href="/products/alpha">Alpha</a></li>
        <li><a href="/products/beta">Beta</a></li>
      </ul>
    </li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

Key semantic requirements:
- The navigation MUST be wrapped in a `<nav>` element.
- If there are multiple `<nav>` elements on the page (for example, main navigation and footer navigation), each MUST have a unique `aria-label` to distinguish them.
- Navigation links SHOULD be in an unordered list (`<ul>`) so screen readers announce the number of items.
- The current page link SHOULD have `aria-current="page"`.
- Submenu triggers MUST be `<button>` elements with `aria-expanded` (not links that go nowhere).
- Submenus MUST be hidden from the accessibility tree when closed (using `hidden`, `display: none`, or equivalent).

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | The nav structure, list hierarchy, and current page must be programmatically exposed. |
| 2.1.1 Keyboard | A | All navigation links and submenu toggles must be keyboard operable. |
| 2.4.1 Bypass Blocks | A | The navigation is a repeated block. A skip link or landmark structure allows users to bypass it. |
| 2.4.3 Focus Order | A | Focus must follow the visual order through navigation items. |
| 2.4.5 Multiple Ways | AA | The website must provide more than one way to find pages (navigation plus search, sitemap, or similar). |
| 2.4.7 Focus Visible | AA | Focus indicators must be visible on all navigation items. |
| 4.1.2 Name, Role, Value | A | The nav landmark, link names, and submenu expanded/collapsed state must be exposed. |

### APG reference

ARIA Authoring Practices Guide — Disclosure (Show/Hide) Pattern (for submenus)
https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

---

### Test method 1: Keyboard only

**Setup:** Begin with focus at the top of the page.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab`. | If a skip navigation link exists, it receives focus first (it may become visible only on focus). Pressing `Enter` on it moves focus past the navigation to the main content. | 2.4.1 | If no skip link exists and the navigation has many items, keyboard users must Tab through every item to reach the main content. A `<nav>` landmark helps screen reader users, but a skip link is the most reliable solution for keyboard users. |
| K2 | Press `Tab` through the navigation items. | Focus moves through each link and button in the visual order, left to right (or top to bottom for vertical menus). Each focused item has a visible focus indicator. | 2.1.1, 2.4.3, 2.4.7 | If focus order does not match the visual order, the DOM order and CSS layout are misaligned (for example, using `float: right` or CSS `order` to reposition items). |
| K3 | Press `Enter` on a navigation link. | The browser navigates to the linked page. | 2.1.1 | If nothing happens, the element may not be an `<a>` with an `href`, or JavaScript may be intercepting and suppressing the default behaviour. |
| K4 | Press `Enter` or `Space` on a submenu trigger button. | The submenu opens and becomes visible. The trigger button now indicates the expanded state (for example, an arrow rotates). | 2.1.1, 4.1.2 | If the submenu does not open, the button may lack a click handler. If it opens on hover only, keyboard users cannot access it. |
| K5 | Press `Tab` after opening a submenu. | Focus moves into the submenu links, in order. | 2.4.3 | If focus skips the submenu and moves to the next top-level item, the submenu content may be hidden from the focus order even when visually open. |
| K6 | Press `Escape` while focus is inside a submenu. | The submenu closes. Focus returns to the submenu trigger button. | 2.1.1 | If `Escape` does nothing, the key handler is missing. This is a recommended pattern for disclosure menus, not strictly required by WCAG, but essential for usability. |
| K7 | Press `Tab` past the last navigation item. | Focus moves to the next component after the navigation (main content area, or the element after the nav). Focus does not get trapped inside the navigation. | 2.1.1 | If focus loops back to the first navigation item, there is a focus trap. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the navigation using landmark navigation (press `D` in NVDA for landmarks, or use the VoiceOver rotor).

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to the navigation landmark. | The screen reader announces "Main navigation" (or the `aria-label` value) when entering the `<nav>` element. | 1.3.1, 4.1.2 | If "navigation" is not announced, the `<nav>` element is missing. If the label is generic (just "navigation"), there may be multiple nav elements and this one needs a more specific `aria-label`. |
| SR2 | Read through the navigation items. | The screen reader announces each item as a link, including the link text. It also announces the list structure (for example, "list, 4 items"). | 1.3.1 | If the list structure is not announced, the links are not inside a `<ul>`. If a link is announced as "button" or "clickable," it may be a `<div>` or `<span>` with an onClick handler. |
| SR3 | Navigate to the link for the current page. | The screen reader announces "current page" along with the link text. | 1.3.1 | If "current page" is not announced, `aria-current="page"` is missing from the active link. Without this, screen reader users have no way to know which page they are on from the navigation alone. |
| SR4 | Navigate to a submenu trigger button. | The screen reader announces the button text, that it is a button, and its expanded/collapsed state. | 4.1.2 | If the trigger is announced as a link, it is likely an `<a>` instead of a `<button>`. If no state is announced, `aria-expanded` is missing. |
| SR5 | Open the submenu and read through its items. | The submenu items are announced as links within a nested list. | 1.3.1 | If the submenu items are flat (no list structure), the submenu is not wrapped in a `<ul>`. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software. The navigation must be visible.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible link text]" (for example, "Click Products"). | The browser navigates to that page, or the submenu opens if the item is a trigger button. | 2.5.3 | If the voice control cannot find the target, the accessible name may differ from the visible text. Common cause: `aria-label` on the link that does not match the visible label. |
| VC2 | Say "Show links." | All navigation links are highlighted as targets. | 4.1.2 | If some navigation items are not highlighted, they may not be implemented as proper links or buttons. |
| VC3 | After opening a submenu, say "Click [submenu link text]." | The browser navigates to the submenu page. | 2.5.3 | If the submenu links are not reachable by voice, they may be visually hidden or not rendered as proper links. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the navigation. | Navigation items are clearly identifiable as interactive (underlined, distinct colour, or other visual cue). The current page is visually marked by more than just colour. | 1.4.1, 1.4.11 | If navigation items look like plain text, users may not know they are clickable. If the current page is indicated only by colour, users with colour vision deficiencies will miss it. |
| VZ2 | Hover over a navigation item. | A visible hover state appears (colour change, underline, background change). | 1.4.13 | If the hover state shows additional content (like a tooltip or submenu), that content must remain visible while the pointer is over it, and must be dismissable without moving the pointer (for example, pressing `Escape`). |
| VZ3 | Zoom to 200%. | Navigation remains usable. If the navigation does not fit on one line, it adapts (wraps, becomes a hamburger menu, or otherwise remains accessible). | 1.4.4, 1.4.10 | If navigation items overlap or disappear at 200% zoom, the CSS does not handle reflow. |
| VZ4 | Zoom to 400%. | Navigation is still accessible. If it collapses into a hamburger menu or similar pattern, that menu must be keyboard and screen reader accessible (re-test with Test method 1 and 2 for the collapsed version). | 1.4.10 | At this zoom, a responsive navigation pattern usually activates. If it does not, or if the pattern is inaccessible, both the zoom and keyboard tests fail. |
| VZ5 | Tab through navigation items. | Every item has a visible focus indicator. | 2.4.7, 2.4.11 | If focus indicators are missing, the CSS may suppress outlines. |

---

### Common failures for navigation menus

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| No nav landmark | `<div class="navigation">` without a `<nav>` element. | Screen reader users cannot jump to or identify the navigation using landmark navigation. Fails 1.3.1. |
| Duplicate generic labels | Two `<nav>` elements on the page, both without `aria-label`. | Screen readers announce "navigation" for both with no way to distinguish them. Fails 1.3.1. |
| Missing aria-current | The current page link has a visual highlight but no `aria-current="page"`. | Screen readers do not indicate which page is active. Fails 1.3.1. |
| Submenu opens on hover only | Submenu appears on `:hover` CSS but has no keyboard trigger. | Keyboard users cannot open the submenu. Fails 2.1.1. |
| Link used as submenu trigger | `<a href="#">Products</a>` toggles a submenu on click. | The link role does not communicate the toggle pattern. There is no `aria-expanded`. Using `href="#"` can scroll the page. Fails 4.1.2. |
| No skip link | A long navigation with 20+ items and no skip link or bypass mechanism. | Keyboard users must Tab through all items to reach the main content. Fails 2.4.1. |
| Submenu items not in a list | Submenu links are loose `<a>` elements inside a `<div>`. | Screen readers cannot announce the number of items or the hierarchical structure. Fails 1.3.1. |

---
---

## Component: Button

### What this component is

A button is an interactive element that triggers an action when activated. Buttons do things: submit a form, open a dialog, toggle a setting, delete an item. They do not navigate to a new page (that is what links are for).

Think of it like a doorbell. You press it, and something happens on the other side of the door. The doorbell does not take you to a new location — it triggers an event where you are standing.

### Expected semantic structure

**Standard button:**

```html
<button type="button">Save draft</button>
```

**Submit button:**

```html
<button type="submit">Place order</button>
```

**Toggle button:**

```html
<button
  type="button"
  aria-pressed="false"
>
  Dark mode
</button>
```

**Icon-only button:**

```html
<button type="button" aria-label="Close">
  <svg aria-hidden="true" focusable="false"><!-- icon --></svg>
</button>
```

Key semantic requirements:
- Buttons MUST use the native `<button>` element whenever possible. This provides keyboard focus, `Enter`/`Space` activation, and the correct role for free.
- If a non-button element must be used, it MUST have `role="button"` and a `keydown` handler for both `Enter` and `Space`.
- Buttons MUST have an accessible name. For text buttons, the visible text is the name. For icon-only buttons, use `aria-label` or visually hidden text.
- Toggle buttons MUST have `aria-pressed` set to `"true"` or `"false"` to communicate the current state.
- The `type` attribute SHOULD be set explicitly (`type="button"` or `type="submit"`) to avoid unexpected form submission. A `<button>` without a `type` defaults to `type="submit"`.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.1.1 Non-text Content | A | Icon-only buttons must have a text alternative (accessible name). |
| 2.1.1 Keyboard | A | Buttons must be activatable with `Enter` and `Space`. |
| 2.4.7 Focus Visible | AA | Focused buttons must have a visible focus indicator. |
| 2.5.3 Label in Name | A | The accessible name must contain the visible text (for buttons with visible labels). |
| 2.5.8 Target Size (Minimum) | AA | The clickable area must be at least 24x24 CSS pixels. |
| 4.1.2 Name, Role, Value | A | The button's name, role, and state (for toggle buttons) must be exposed. |

### APG reference

ARIA Authoring Practices Guide — Button Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/button/

---

### Test method 1: Keyboard only

**Setup:** Disconnect your mouse. Tab to the button.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move focus to the button. | Focus lands on the button. A visible focus indicator appears. | 2.1.1, 2.4.7 | If focus skips the button, it is not a focusable element. A `<div>` or `<span>` without `tabindex` will be skipped. If focus lands but no indicator appears, the CSS suppresses the outline. |
| K2 | Press `Enter`. | The button's action fires (form submits, dialog opens, setting changes, etc.). | 2.1.1 | If nothing happens, the element may not be a real `<button>`. Native buttons respond to `Enter` automatically. A `<div role="button">` needs a `keydown` handler. |
| K3 | Press `Space`. | The button's action fires (same as `Enter`). | 2.1.1 | If `Space` scrolls the page instead of activating the button, the element is not a `<button>`. Native buttons handle `Space` by default. For `<div role="button">`, a `keydown` handler must call `event.preventDefault()` to stop scrolling. |
| K4 | (For toggle buttons) Press `Enter` or `Space`. | The button's pressed state toggles. The visual appearance changes to reflect the new state. | 4.1.2 | If the visual appearance changes but the state is not communicated to assistive tech, `aria-pressed` may not be toggling. If neither changes, the toggle logic is missing. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the button.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to the button. | The screen reader announces the button text (or `aria-label` for icon-only buttons) and that it is a "button." | 4.1.2 | If "button" is not announced, the element lacks the button role. If no name is announced, the button has no text, `aria-label`, or other accessible name source. |
| SR2 | (For toggle buttons) Navigate to the button. | The screen reader announces the button text, "button," and the pressed state ("pressed" or "not pressed"). | 4.1.2 | If the pressed state is not announced, `aria-pressed` is missing. |
| SR3 | Activate the button. | The screen reader announces any change that results from the action. For toggle buttons, it announces the new state. For buttons that open dialogs, the dialog announcement follows. | 4.1.2 | If the state change is not announced, `aria-pressed` or `aria-expanded` is not being updated on activation. |
| SR4 | (For icon-only buttons) Navigate to the button. | The screen reader announces a meaningful name (for example, "Close, button" — not just "button" or "image, button"). | 1.1.1, 4.1.2 | If the name is empty or meaningless (like "x" or "icon"), the `aria-label` is missing or not descriptive. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible button text]" (for example, "Click Save draft"). | The button's action fires. | 2.5.3 | If the voice control cannot find the button, the accessible name may not match the visible text. This happens when `aria-label` replaces rather than supplements the visible text. For example, a button that says "Save" visually but has `aria-label="Save current draft to server"` may confuse some voice control software. The accessible name MUST contain the visible label text. |
| VC2 | (For icon-only buttons) Say "Click [aria-label text]" (for example, "Click Close"). | The button's action fires. | 2.5.3 | If the voice control cannot find it, the `aria-label` may not be set, or the user cannot guess the label. Icon-only buttons are harder for voice control users because the name is invisible. |
| VC3 | Say "Show buttons." | All buttons on the page are highlighted as targets. | 4.1.2 | If a custom button (`<div role="button">`) is not highlighted, voice control may not recognise it as a button. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the button. | The button looks interactive: it has a distinct border, background colour, or other visual treatment that distinguishes it from plain text and from links. | 1.4.11 | If the button is styled to look like plain text, users will not know it is interactive. The button's visual boundary must have at least 3:1 contrast against the background. |
| VZ2 | Check the button's size. | The clickable/tappable area is at least 24x24 CSS pixels. | 2.5.8 | Use the browser's inspector to measure the element's dimensions. Small icon-only buttons frequently fail this. Note: inline text buttons within a sentence are exempt from this requirement. |
| VZ3 | (For toggle buttons) Activate the button and check the visual state. | The pressed/active state is visually distinguishable by more than colour alone (for example, the button appears recessed, has a check mark, or changes text). | 1.4.1, 1.4.11 | If the toggle state is indicated only by colour, users with colour vision deficiencies cannot perceive the change. |
| VZ4 | Zoom to 400%. | The button remains visible, tappable, and its label is fully readable. No text is truncated. | 1.4.4, 1.4.10 | If the button text overflows or the button disappears off-screen, the layout is not responsive. |
| VZ5 | Tab to the button and check focus visibility. | The focus indicator is visible and has at least 3:1 contrast. | 2.4.7, 2.4.11 | If the focus indicator blends into the button's existing border or background, it may be invisible. |

---

### Common failures for button components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| Div as button without role | `<div class="btn" onclick="save()">Save</div>` | Not focusable, not announced as a button, does not respond to keyboard. Fails 2.1.1, 4.1.2. |
| Div as button with role but no keyboard | `<div role="button" onclick="save()">Save</div>` | Announced as a button but does not respond to `Enter` or `Space`. Needs `tabindex="0"` and a `keydown` handler. Fails 2.1.1. |
| Link styled as button | `<a href="#" class="btn" onclick="save()">Save</a>` | Announced as a link, not a button. `Space` does not activate links (only `Enter` does). The role does not match the behaviour. Fails 4.1.2. |
| No accessible name | `<button><svg>...</svg></button>` with no `aria-label` or visually hidden text. | Screen readers announce "button" with no name. Voice control users cannot target it. Fails 4.1.2, 1.1.1. |
| aria-label mismatches visible text | Button text says "Save" but `aria-label="Submit form data"`. | Voice control user says "Click Save" but it does not work because the accessible name is different. Fails 2.5.3. |
| Missing type attribute | `<button onclick="doSomething()">Go</button>` inside a form. | Without `type="button"`, the default is `type="submit"`, so the button submits the form unexpectedly. Not a direct WCAG failure but a common bug that disrupts the user experience. |

---
---

## Component: Radio button

### What this component is

A radio button is one option in a group of mutually exclusive choices. Selecting one radio button deselects the previously selected one. Radio buttons always come in groups of two or more.

Think of it like the preset buttons on a car radio. You can tune to station 1, station 2, or station 3, but you can only listen to one station at a time. Pressing a new preset automatically turns off the previous one.

### Expected semantic structure

```html
<fieldset>
  <legend>Shipping method</legend>

  <label>
    <input type="radio" name="shipping" value="standard">
    Standard (3-5 days)
  </label>

  <label>
    <input type="radio" name="shipping" value="express">
    Express (1-2 days)
  </label>

  <label>
    <input type="radio" name="shipping" value="overnight">
    Overnight
  </label>
</fieldset>
```

Key semantic requirements:
- Radio buttons MUST be grouped using a `<fieldset>` with a `<legend>` that describes the group question or purpose. Alternatively, `role="radiogroup"` with `aria-labelledby` can be used.
- All radios in a group MUST share the same `name` attribute so the browser enforces mutual exclusion.
- Each radio button MUST have a visible `<label>` associated with it (wrapping the input, or using `for`/`id`).
- Native `<input type="radio">` is always preferred over custom ARIA radio buttons, because the browser provides focus management, keyboard behaviour, and form integration for free.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | The group label (legend) and individual radio labels must be programmatically associated. |
| 1.3.5 Identify Input Purpose | AA | Where applicable, the `autocomplete` attribute should identify the purpose of the radio group (this applies mainly to personal data inputs). |
| 2.1.1 Keyboard | A | Radio buttons must be selectable by keyboard. |
| 2.4.7 Focus Visible | AA | The focused radio button must have a visible focus indicator. |
| 3.3.2 Labels or Instructions | A | Each radio button must have a clear label, and the group must have a clear question/description. |
| 4.1.2 Name, Role, Value | A | The radio role, checked state, group name, and individual label must be exposed. |

### APG reference

ARIA Authoring Practices Guide — Radio Group Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/radio/

---

### Test method 1: Keyboard only

**Setup:** Disconnect your mouse. Tab to the radio button group.

**Important:** Native radio button groups have a specific keyboard pattern. `Tab` moves focus into the group (landing on the selected radio, or the first radio if none is selected). Arrow keys move between radios within the group and select them. `Tab` again moves focus out of the group. This is different from checkboxes.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move focus into the radio group. | Focus lands on the currently selected radio button. If no radio is selected, focus lands on the first radio. A visible focus indicator appears. | 2.1.1, 2.4.7 | If focus lands on every individual radio (requiring multiple Tab presses to pass through the group), the native radio keyboard behaviour may be broken by custom JavaScript. If no focus indicator appears, the CSS may suppress it. |
| K2 | Press `Arrow Down` or `Arrow Right`. | Focus and selection move to the next radio button. The newly focused radio becomes selected (its circle fills in). The previously selected radio is deselected. | 2.1.1, 4.1.2 | If arrow keys do not work, the component may use custom radio buttons without implementing the keyboard pattern. If the visual selected state does not update, the CSS is not reflecting the checked state. |
| K3 | Press `Arrow Up` or `Arrow Left`. | Focus and selection move to the previous radio button. | 2.1.1 | Mirror of K2. |
| K4 | Press `Arrow Down` on the last radio. | Focus and selection wrap to the first radio. | 2.1.1 | If focus does not wrap, the wrapping logic is missing. This is the expected native behaviour. |
| K5 | Press `Tab` to leave the radio group. | Focus moves to the next focusable element after the group. Only one Tab press is needed to exit the entire group. | 2.1.1, 2.4.3 | If leaving the group requires pressing Tab multiple times (one per radio), the focus management is wrong. Native radio groups only place one radio in the Tab order. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the radio group.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to the radio group. | The screen reader announces the group label (legend text). Example: "Shipping method, group." | 1.3.1, 3.3.2 | If no group label is announced, the `<fieldset>` and `<legend>` are missing, or the ARIA equivalent is misconfigured. |
| SR2 | Navigate to a radio button. | The screen reader announces: the radio label, that it is a radio button, whether it is checked or not, and its position in the group (for example, "Standard, radio button, not checked, 1 of 3"). | 1.3.1, 4.1.2 | If "radio button" is not announced, the element is not a radio input and lacks the radio role. If the checked state is not announced, the state is not programmatically exposed. If the position is not announced, the radios may not be properly grouped. |
| SR3 | Select a radio button (press `Space` or Arrow keys). | The screen reader announces the newly selected radio as "checked." | 4.1.2 | If the checked state does not update in the announcement, the custom radio may not be updating `aria-checked`. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible radio label]" (for example, "Click Express"). | The radio button becomes selected. | 2.5.3 | If the voice control cannot find the target, the label may not be associated with the radio input. Check that the `<label>` wraps the input or is connected via `for`/`id`. |
| VC2 | Say "Show numbers." | Each radio button is highlighted as a numbered target. | 4.1.2 | If the radios are not highlighted, they may be custom elements not recognised as interactive. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the radio group. | The group has a visible label/question text above or beside the radios. Each individual radio has a visible label. The selected radio is visually distinct by more than colour alone (for example, filled circle vs empty circle). | 1.4.1, 3.3.2 | If the group question is missing, users do not know what they are choosing between. If the selected state is only a colour change (for example, blue vs grey with identical shapes), users with colour vision deficiencies cannot tell which is selected. |
| VZ2 | Zoom to 200%. | The radio group remains usable. Labels are not cut off. Radios and their labels stay visually aligned. | 1.4.4 | If labels truncate or wrap in a way that disconnects them from their radio, the layout needs adjustment. |
| VZ3 | Zoom to 400%. | The radios and labels reflow into a readable layout. All options remain visible and selectable. | 1.4.10 | If options are clipped or overlap, the CSS does not handle narrow viewports. |
| VZ4 | Tab to the radio group and check focus visibility. | The focused radio has a visible focus indicator. | 2.4.7 | Custom-styled radios often hide the native radio and the native focus ring with it. The custom style must provide its own visible focus indicator. |

---

### Common failures for radio button components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| No fieldset or group label | Radio buttons without a `<fieldset>` and `<legend>`, or without `role="radiogroup"` and `aria-labelledby`. | Screen readers announce individual radios without context. "Checked, radio button" means nothing without the group question. Fails 1.3.1, 3.3.2. |
| Missing labels | `<input type="radio"> Standard` without a `<label>` element. | The text next to the radio is not programmatically associated. Screen readers announce "radio button" with no name. Clicking the text does not select the radio. Fails 1.3.1, 4.1.2, 3.3.2. |
| Custom radios without keyboard support | `<div class="radio" onclick="select()">` with no keyboard handling. | Cannot be selected with arrow keys or any keyboard interaction. Fails 2.1.1. |
| Same visual for checked and unchecked | Custom-styled radios where checked and unchecked look identical except for colour. | Users with colour vision deficiencies cannot determine the selected option. Fails 1.4.1. |
| No name attribute grouping | Each radio has a different `name` value. | The browser does not enforce mutual exclusion. Selecting one does not deselect the others. This is a functional bug that also confuses assistive technology. |

---
---

## Component: Checkbox

### What this component is

A checkbox is an independent toggle that can be checked or unchecked. Unlike radio buttons, each checkbox in a group operates independently. Checking one checkbox does not affect the others.

Think of it like a shopping list. You tick off items as you put them in your basket. Ticking off "milk" does not affect whether "bread" is ticked. Each item is its own separate decision.

### Expected semantic structure

**Single checkbox:**

```html
<label>
  <input type="checkbox" name="terms">
  I agree to the terms and conditions
</label>
```

**Grouped checkboxes:**

```html
<fieldset>
  <legend>Notification preferences</legend>

  <label>
    <input type="checkbox" name="notifications" value="email">
    Email
  </label>

  <label>
    <input type="checkbox" name="notifications" value="sms">
    SMS
  </label>

  <label>
    <input type="checkbox" name="notifications" value="push">
    Push notifications
  </label>
</fieldset>
```

Key semantic requirements:
- Each checkbox MUST have a visible `<label>` associated with it.
- When checkboxes form a related group, they SHOULD be wrapped in a `<fieldset>` with a `<legend>` describing the group.
- A standalone checkbox (like "I agree to terms") does not need a fieldset.
- Native `<input type="checkbox">` is preferred. Custom ARIA checkboxes (`role="checkbox"` with `aria-checked`) must replicate the full native keyboard behaviour.
- For tri-state/mixed checkboxes (like a "select all" that shows a partial state), use `aria-checked="mixed"`.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | The checkbox label, group label, and checked state must be programmatically exposed. |
| 2.1.1 Keyboard | A | Checkboxes must be togglable with `Space`. |
| 2.4.7 Focus Visible | AA | The focused checkbox must have a visible focus indicator. |
| 3.3.2 Labels or Instructions | A | Each checkbox must have a clear label. Groups must have a clear description. |
| 4.1.2 Name, Role, Value | A | The checkbox role, name, and checked/unchecked state must be exposed. |

### APG reference

ARIA Authoring Practices Guide — Checkbox Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/

---

### Test method 1: Keyboard only

**Setup:** Disconnect your mouse. Tab to the first checkbox.

**Important:** Unlike radio buttons, each checkbox is an independent Tab stop. You use `Tab` to move between checkboxes and `Space` to toggle them. Arrow keys are not used for native checkboxes.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move focus to the first checkbox. | Focus lands on the checkbox. A visible focus indicator appears. | 2.1.1, 2.4.7 | If focus skips the checkbox, it may not be a native checkbox or may be hidden with CSS. If no focus indicator appears, the custom styling may have hidden the native indicator without providing a replacement. |
| K2 | Press `Space`. | The checkbox toggles between checked and unchecked. The visual state changes (for example, a check mark appears or disappears). | 2.1.1, 4.1.2 | If `Space` scrolls the page, the element is not a native checkbox and lacks a keyboard handler. If the visual state does not change, the CSS is not reflecting the `:checked` state. |
| K3 | Press `Tab` to move to the next checkbox. | Focus moves to the next checkbox in the group. | 2.1.1, 2.4.3 | If focus skips a checkbox, it may be hidden or not in the Tab order. |
| K4 | Toggle several checkboxes and then press `Tab` past the group. | Focus leaves the group and moves to the next component. All previously toggled checkboxes retain their state. | 2.1.1 | If a checkbox loses its state when focus leaves, the toggle logic has a bug. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the checkbox.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to a group of checkboxes. | The screen reader announces the group label (legend text) when entering the group. | 1.3.1, 3.3.2 | If no group label is announced, the `<fieldset>` and `<legend>` are missing. |
| SR2 | Navigate to an individual checkbox. | The screen reader announces: the checkbox label, that it is a checkbox, and whether it is checked or not. Example: "Email, checkbox, not checked." | 1.3.1, 4.1.2 | If "checkbox" is not announced, the element lacks the checkbox role. If the checked state is not announced, the state is not programmatically exposed. If no label is announced, the label association is broken. |
| SR3 | Press `Space` to toggle the checkbox. | The screen reader announces the new state: "checked" or "not checked." | 4.1.2 | If the state change is not announced, `aria-checked` (for custom checkboxes) or the native checked state is not updating. |
| SR4 | (For tri-state checkboxes) Navigate to the "select all" checkbox. | The screen reader announces "mixed" or "partially checked" when some but not all sub-checkboxes are checked. | 4.1.2 | If "mixed" is not announced, `aria-checked="mixed"` is not being set when the partial state applies. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible checkbox label]" (for example, "Click Email"). | The checkbox toggles. | 2.5.3 | If the voice control cannot find the target, the label is not properly associated. Check that clicking the label text also toggles the checkbox (if it does not, the `<label>` is not connected via wrapping or `for`/`id`). |
| VC2 | Say "Show checkboxes" or "Show numbers." | All checkboxes are highlighted as targets. | 4.1.2 | If custom checkboxes are not highlighted, they may not be recognised as form controls. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the checkboxes. | Each checkbox has a visible label. The checked state is indicated by more than colour alone (for example, a check mark, a filled square, or a dash for mixed state). | 1.4.1, 3.3.2 | If the checked state relies solely on colour (blue for checked, grey for unchecked with identical shape), users with colour vision deficiencies cannot perceive the state. |
| VZ2 | Look at a checkbox group. | The group has a visible heading or question that explains what the group of checkboxes is for. | 3.3.2 | If the group label is missing, users do not know the context for the individual options. |
| VZ3 | Zoom to 400%. | Checkboxes and labels remain aligned and readable. No labels are cut off. | 1.4.4, 1.4.10 | If labels truncate or separate from their checkboxes, the layout does not handle narrow viewports. |
| VZ4 | Tab through checkboxes and check focus visibility. | Each focused checkbox has a visible focus indicator. | 2.4.7 | Custom-styled checkboxes that hide the native input often lose the focus indicator. The custom style must provide its own. |

---

### Common failures for checkbox components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| No label association | `<input type="checkbox"> Subscribe` with text not inside or connected to a `<label>`. | Screen readers announce "checkbox" with no name. Clicking the text does not toggle the checkbox. Fails 1.3.1, 4.1.2, 3.3.2. |
| Custom checkbox without role | `<div class="checkbox" onclick="toggle()">` with no `role="checkbox"`. | Not recognised as a checkbox by assistive technology. Fails 4.1.2. |
| Custom checkbox without keyboard | `<div role="checkbox" aria-checked="false" onclick="toggle()">` with no keyboard handler. | Cannot be toggled with `Space`. Fails 2.1.1. |
| Visual state mismatch | Custom checkbox shows a check mark visually but `aria-checked` remains `"false"`. | Screen reader and visual state disagree. Fails 4.1.2. |
| Hidden native input with no focus forwarding | Native `<input>` is visually hidden and a `<div>` is styled as the checkbox, but focus does not transfer. | Keyboard user sees focus disappear when it lands on the hidden native input. Fails 2.4.7. |

---
---

## Component: Link

### What this component is

A link is an interactive element that navigates the user to a new page, a different section of the current page, or an external resource. Links go somewhere. They do not trigger actions (that is what buttons are for).

Think of it like a door with a sign on it. The sign tells you what is on the other side. You walk through the door and end up in a new place. The door does not do anything itself — it takes you somewhere.

### Expected semantic structure

**Standard link:**

```html
<a href="/products">View our products</a>
```

**Link that opens in a new window:**

```html
<a href="/terms" target="_blank" rel="noopener">
  Terms and conditions
  <span class="visually-hidden">(opens in a new tab)</span>
</a>
```

**Link with an image:**

```html
<a href="/home">
  <img src="logo.png" alt="Company name - go to homepage">
</a>
```

Key semantic requirements:
- Links MUST be `<a>` elements with an `href` attribute. An `<a>` without `href` is not a link — it is not focusable or interactive by default.
- Links MUST have a descriptive accessible name. The visible text should describe the destination. Avoid "click here" or "read more" without context.
- If a link opens in a new tab/window, the user SHOULD be warned (via visible text, an icon with alt text, or visually hidden text).
- Image-only links MUST have `alt` text on the image that describes the link destination, not the image content. For example: "Go to homepage" rather than "Logo."
- Links and buttons serve different purposes. A common mistake is using a link (`<a>`) to trigger an action or using a button to navigate.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.1.1 Non-text Content | A | Image-only links must have alt text describing the destination. |
| 1.3.1 Info and Relationships | A | The link role must be programmatically exposed. |
| 1.4.1 Use of Color | A | Links must be distinguishable from surrounding text by more than colour alone. |
| 2.1.1 Keyboard | A | Links must be focusable and activatable with `Enter`. |
| 2.4.4 Link Purpose (In Context) | A | The purpose of the link must be clear from the link text alone, or from the link text plus its surrounding context. |
| 2.4.7 Focus Visible | AA | Focused links must have a visible focus indicator. |
| 4.1.2 Name, Role, Value | A | The link role and accessible name must be exposed. |

### APG reference

ARIA Authoring Practices Guide — Link Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/link/

---

### Test method 1: Keyboard only

**Setup:** Disconnect your mouse. Tab to the link.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move focus to the link. | Focus lands on the link. A visible focus indicator appears. | 2.1.1, 2.4.7 | If focus skips the link, the `<a>` may be missing its `href` attribute, or a non-link element (like a `<span>`) is being used. If no focus indicator appears, the CSS suppresses the outline. |
| K2 | Press `Enter`. | The link activates: the browser navigates to the link destination (or opens a new tab if `target="_blank"`). | 2.1.1 | If nothing happens, the element may not be an `<a>` with `href`, or JavaScript may be intercepting the event. |
| K3 | (Note) Press `Space`. | `Space` does NOT activate links (unlike buttons). For native links, `Space` scrolls the page. | — | If `Space` activates the element, it may actually be a button or a custom element. This is not a failure, but it signals a potential role mismatch worth investigating. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the link.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to the link. | The screen reader announces the link text and "link." Example: "View our products, link." | 1.3.1, 4.1.2 | If "link" is not announced, the element may not be an `<a>` with `href`. If a `<div>` or `<span>` with an `onclick` is used, it is announced as static text. |
| SR2 | (For image-only links) Navigate to the link. | The screen reader announces the image's alt text and "link." Example: "Company name - go to homepage, link." | 1.1.1, 4.1.2 | If the screen reader announces "link" with no name, or "graphic, link," the image is missing alt text. |
| SR3 | Listen to the link text. | The link text describes where the link goes. It is not generic like "click here" or "read more." | 2.4.4 | If the link text is generic, the purpose cannot be determined. Screen reader users often navigate by pulling up a list of all links on the page. In that list, "read more" repeated five times is meaningless. |
| SR4 | (For links that open in a new tab) Navigate to the link. | The screen reader announces that the link opens in a new window or tab, either through visible text or an announced icon. | 2.4.4 | If there is no indication that the link opens a new tab, the user is surprised when their context changes. This is recommended best practice; not a strict WCAG failure at Level A but expected at AAA under 3.2.5 Change on Request. |
| SR5 | Use the screen reader's links list (press `Insert+F7` in NVDA, or use the VoiceOver rotor). | The link appears in the list with a descriptive name. | 2.4.4, 2.4.9 | If the link shows up as "click here" or "here" in the links list, the link text is not descriptive out of context. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible link text]" (for example, "Click View our products"). | The link activates and the browser navigates. | 2.5.3 | If the voice control cannot find the target, the accessible name may not match the visible text. Check for `aria-label` overriding the link text. |
| VC2 | (For image-only links) Say "Click [alt text]." | The link activates. | 2.5.3 | If the voice control cannot find it, the alt text may be missing or the user cannot guess it because the image provides no visible text clue. |
| VC3 | Say "Show links." | All links on the page are highlighted. | 4.1.2 | If a styled `<span>` or `<div>` that looks like a link is not highlighted, it is not a real link. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the link within its surrounding text. | The link is visually distinguishable from non-link text by more than colour alone. It has an underline, a border, a font weight change, or another non-colour visual cue. | 1.4.1 | If the link is only a different colour from the surrounding text (with no underline or other cue), users with colour vision deficiencies may not identify it as a link. Exception: if the link colour has at least 3:1 contrast against the surrounding text AND a non-colour cue appears on hover/focus, this is acceptable. |
| VZ2 | Hover over the link. | A visible hover state appears (underline, colour change, or similar). | — | Not a strict WCAG requirement, but the absence of a hover state makes links harder to identify for mouse users. |
| VZ3 | Zoom to 400%. | Link text remains readable and the link remains clickable. No text is truncated or hidden. | 1.4.4, 1.4.10 | If link text overflows or becomes hidden, the CSS is not handling reflow. |
| VZ4 | Tab to the link. | The link has a visible focus indicator with at least 3:1 contrast. | 2.4.7, 2.4.11 | If the focus indicator is missing or low-contrast, check the CSS. |

---

### Common failures for link components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| Anchor without href | `<a onclick="navigate()">Products</a>` with no `href`. | Not focusable by keyboard in most browsers. Not announced as a link by screen readers. Fails 2.1.1, 4.1.2. |
| Generic link text | `<a href="/report">Click here</a>` or `<a href="/report">Read more</a>` with no surrounding context. | Link purpose is unclear, especially in a links list. Fails 2.4.4. |
| Image link without alt | `<a href="/"><img src="logo.png"></a>` with no `alt` attribute. | Screen readers announce "link, graphic" with no name. Fails 1.1.1, 4.1.2. |
| Colour-only differentiation | Links styled with a different colour but no underline or other non-colour indicator, and the colour contrast between link text and surrounding text is below 3:1. | Users with colour vision deficiencies cannot identify links. Fails 1.4.1. |
| Link used as button | `<a href="#" onclick="delete()">Delete item</a>` used to trigger an action. | The role says "link" but the behaviour is a button. Screen readers announce "link" which implies navigation, confusing users. The `href="#"` may scroll the page. Fails 4.1.2 (role does not match behaviour). |
| New tab without warning | `<a href="/terms" target="_blank">Terms</a>` with no visual or programmatic indication. | The user is unexpectedly moved to a new tab. This creates confusion, especially for screen reader users who may not realise the context changed. |

---
---

## Component: Form

### What this component is

A form is a container for a collection of input fields that together allow a user to submit data. Forms include text inputs, selects, textareas, and submit buttons, structured with labels, instructions, and error handling.

Think of it like filling in a paper application form. Each field has a label beside it telling you what to write. Required fields are marked with an asterisk. If you make a mistake, someone circles the error and writes what went wrong in the margin. At the bottom is a "Submit" button to hand it in.

Note: Radio buttons and checkboxes have their own sections in this document. This form section covers the overall form structure, text inputs, error handling, and submission flow.

### Expected semantic structure

```html
<form novalidate>

  <label for="full-name">Full name</label>
  <input
    type="text"
    id="full-name"
    name="full-name"
    required
    aria-required="true"
    autocomplete="name"
  >

  <label for="email">Email address</label>
  <input
    type="email"
    id="email"
    name="email"
    required
    aria-required="true"
    autocomplete="email"
    aria-describedby="email-hint"
  >
  <p id="email-hint">We will only use this to confirm your booking.</p>

  <button type="submit">Submit booking</button>

</form>
```

**Error state example:**

```html
<label for="email">Email address</label>
<input
  type="email"
  id="email"
  name="email"
  required
  aria-required="true"
  aria-invalid="true"
  aria-describedby="email-error"
>
<p id="email-error" role="alert">Please enter a valid email address.</p>
```

Key semantic requirements:
- Every input MUST have a visible `<label>` connected via `for`/`id`. Placeholder text is NOT a substitute for a label.
- Required fields MUST be indicated both visually (asterisk or text) and programmatically (`aria-required="true"` or the HTML `required` attribute).
- Help text or hint text SHOULD be connected to its input using `aria-describedby`.
- Error messages MUST be programmatically associated with their input using `aria-describedby`. They SHOULD use `role="alert"` or be injected into a live region so screen readers announce them.
- Inputs for personal data SHOULD have the `autocomplete` attribute set to the appropriate value (for example, `autocomplete="email"`, `autocomplete="name"`, `autocomplete="tel"`).
- The form SHOULD have `novalidate` on the `<form>` element if custom validation is used, to prevent the browser's built-in validation from conflicting.
- Error messages MUST identify the field in error and describe the error clearly.
- After submission fails, focus SHOULD move to the first field with an error, or to an error summary at the top of the form.

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | Labels, groups (fieldset/legend), required indicators, and error associations must be programmatic. |
| 1.3.5 Identify Input Purpose | AA | Inputs for personal data must have the appropriate `autocomplete` value. |
| 2.1.1 Keyboard | A | All form controls and the submit action must be keyboard operable. |
| 2.4.6 Headings and Labels | AA | Labels must clearly describe the input's purpose. |
| 2.4.7 Focus Visible | AA | Focused inputs and buttons must have a visible focus indicator. |
| 3.3.1 Error Identification | A | Errors must be identified in text and clearly describe the problem. |
| 3.3.2 Labels or Instructions | A | Every input must have a visible label or instruction. |
| 3.3.3 Error Suggestion | AA | When an error is detected and a correction is known, the suggestion must be provided. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | For forms that cause legal, financial, or data-changing actions, submissions must be reversible, checked, or confirmed. |
| 3.3.7 Redundant Entry | A | The form must not require the user to re-enter information already provided in the same session. |
| 3.3.8 Accessible Authentication (Minimum) | AA | The form must not require the user to solve a cognitive function test (like a CAPTCHA that requires transcription) as the only authentication method. |
| 4.1.2 Name, Role, Value | A | All form controls must expose their name, role, and current value. |

### APG reference

There is no single APG pattern for forms. Relevant references:
- WAI Tutorials — Forms: https://www.w3.org/WAI/tutorials/forms/
- ARIA Authoring Practices Guide — various input patterns

---

### Test method 1: Keyboard only

**Setup:** Disconnect your mouse. Tab to the first form field.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move through the form fields. | Focus moves through each input, select, textarea, and button in the visual order. Each focused element has a visible focus indicator. | 2.1.1, 2.4.3, 2.4.7 | If focus skips an input, it may have `tabindex="-1"` or be hidden. If focus order does not match visual order, the DOM and layout are misaligned. |
| K2 | Type text into a text input. | Characters appear in the input as typed. | 2.1.1 | If the input does not accept keyboard input, it may be disabled or readonly without clear indication. |
| K3 | Press `Tab` to move to a `<select>` dropdown. Press `Arrow Down` to choose an option. | The dropdown options cycle through. The selected option is highlighted. | 2.1.1 | If arrow keys do not work, a custom select may not have keyboard support. Native `<select>` elements handle this automatically. |
| K4 | Press `Tab` to the submit button and press `Enter`. | The form submits. | 2.1.1 | If the submit button is not focusable, it may be a `<div>` instead of a `<button type="submit">`. |
| K5 | Submit the form with one or more fields left invalid. | Error messages appear. Focus moves to the first field with an error, or to an error summary at the top of the form. | 3.3.1, 2.4.3 | If errors appear visually but focus stays on the submit button, the user does not know something went wrong. If errors appear but focus moves to an unexpected place, the focus management logic is incorrect. |
| K6 | Correct the error and re-submit. | The error message for the corrected field disappears. The form submits successfully. | 3.3.1 | If the error message persists after the field is corrected, the validation logic does not clear errors dynamically. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the form.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to a text input. | The screen reader announces: the label text, the input type (for example, "edit text"), and whether it is required. Example: "Full name, edit, required." | 1.3.1, 3.3.2, 4.1.2 | If no label is announced, the `<label>` is not connected to the input. If "required" is not announced, neither `required` nor `aria-required` is set. |
| SR2 | Navigate to an input with hint text. | The screen reader announces the label and then the hint text (from `aria-describedby`). Example: "Email address, edit, required. We will only use this to confirm your booking." | 1.3.1 | If the hint text is not announced, `aria-describedby` is missing or points to the wrong id. |
| SR3 | Submit the form with errors. | The screen reader announces that errors exist. If an error summary is present, it is announced (via `role="alert"` or a live region). When navigating to the invalid field, the error message is announced as part of the field's description. | 3.3.1, 4.1.2 | If the error is not announced, the error message is not associated with the input (missing `aria-describedby`) and is not in a live region. |
| SR4 | Navigate to a field in an error state. | The screen reader announces "invalid" or "invalid entry" (from `aria-invalid="true"`), along with the error description. | 3.3.1, 4.1.2 | If "invalid" is not announced, `aria-invalid="true"` is missing from the input. |
| SR5 | Check that `autocomplete` is correctly set for personal data fields. | This cannot be directly observed via screen reader, but many screen readers and browser extensions auto-fill fields with correct `autocomplete` values. If the browser auto-fills the correct data in the correct field, the `autocomplete` values are likely correct. | 1.3.5 | If the browser fills the wrong data into a field, the `autocomplete` value is incorrect or missing. Verify by inspecting the code. |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible label text]" (for example, "Click Full name"). | Focus moves to the corresponding input field. | 2.5.3 | If the voice control cannot find the field, the label may not be associated with the input. Check `for`/`id` matching. |
| VC2 | Say "Show text fields" or "Show numbers." | All form inputs are highlighted as targets. | 4.1.2 | If inputs are not highlighted, they may be custom elements not recognised as form controls. |
| VC3 | Dictate text into a field (for example, say "Type John Smith"). | The dictated text appears in the focused input. | 2.1.1 | If the text does not appear, the input may not accept keyboard/dictation input, or it may not have focus. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the form. | Every input has a visible label above or beside it (not just placeholder text inside the field). Required fields are visually marked (for example, with an asterisk, or the word "required"). | 3.3.2, 1.4.1 | If labels are only placeholders, they disappear when the user starts typing, removing all context. If required fields are only marked by colour (for example, a red border), users with colour vision deficiencies may miss it. |
| VZ2 | Submit the form with errors. | Error messages appear near the fields they relate to. Each error message describes the problem in text (not just a colour change or icon). The error text has sufficient contrast. | 3.3.1, 3.3.3, 1.4.3 | If errors are indicated only by a red border or icon without text, screen readers and users with colour vision deficiencies will not detect them. |
| VZ3 | Zoom to 200%. | All labels, inputs, and buttons remain visible and usable. Labels stay associated with their inputs. No text is truncated. | 1.4.4, 1.4.10 | If labels and inputs separate or overlap, the CSS does not handle reflow correctly. |
| VZ4 | Zoom to 400%. | The form reflows to a single column. All fields, labels, and buttons remain usable. | 1.4.10 | At 400% zoom, side-by-side layouts should stack vertically. If the form is unusable at this zoom, the layout is not responsive. |
| VZ5 | Tab through the form. | Every input, select, and button has a visible focus indicator. | 2.4.7, 2.4.11 | If focus indicators disappear on custom-styled inputs, the CSS has hidden them. |
| VZ6 | Check that the form does not ask for information the user already provided. | If the form spans multiple pages/steps, data entered on a previous step is not asked for again. | 3.3.7 | If the user must re-enter their email or name on a subsequent step, the form violates redundant entry requirements. Pre-populating or auto-filling from the previous step is the expected solution. |

---

### Common failures for form components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| Placeholder as only label | `<input type="text" placeholder="Full name">` with no `<label>`. | Placeholder disappears on input. Screen readers may not announce it as a label. Fails 1.3.1, 3.3.2. |
| Label not connected to input | `<label>Name</label> <input type="text">` with no `for`/`id` match. | Clicking the label does not focus the input. Screen readers do not announce the label with the input. Fails 1.3.1, 4.1.2. |
| Error messages not associated | Error text appears visually near the input but has no `aria-describedby` connection. | Screen readers do not announce the error when the user focuses the field. Fails 3.3.1, 4.1.2. |
| Error indicated by colour only | Input border turns red on error, with no text error message. | Users with colour vision deficiencies cannot detect the error. Fails 3.3.1, 1.4.1. |
| Missing autocomplete | `<input type="email" name="email">` for a personal data field without `autocomplete="email"`. | Browser and assistive technology cannot auto-fill the field. Fails 1.3.5. |
| No focus management on error | Errors appear after submit but focus stays on the submit button. | Keyboard user must Tab backwards through the entire form to find the error. Fails 2.4.3 (not a strict failure, but a significant usability problem). |
| Required not programmatically indicated | Required field shown with a red asterisk in CSS (`::after`), but the input has no `required` or `aria-required` attribute. | Screen readers do not announce the field as required. Fails 1.3.1. |
| CAPTCHA as only auth method | Login form uses a visual CAPTCHA with no alternative. | Users who cannot see or interpret the CAPTCHA are locked out. Fails 3.3.8. |

---
---

## Component: Select dropdown

### What this component is

A select dropdown lets a user pick one option (or sometimes multiple options) from a list that appears when the control is activated. The list is hidden until the user opens it, then it shows all available options.

Think of it like a vending machine display panel. You see a small window showing the current selection. When you press the button, the full menu rolls down and you can scroll through all the options. Once you pick one, the menu rolls back up and your choice is shown in the window.

There are two fundamentally different implementations: the native HTML `<select>` element, and custom-built dropdowns (often called listboxes or comboboxes). They require very different testing approaches because the native `<select>` gives you keyboard, screen reader, and focus behaviour for free, while custom builds must recreate all of it manually.

### Expected semantic structure

**Native select (single choice):**

```html
<label for="country">Country</label>
<select id="country" name="country">
  <option value="">Choose a country</option>
  <option value="de">Germany</option>
  <option value="nl">Netherlands</option>
  <option value="be">Belgium</option>
</select>
```

**Native select (multiple choice):**

```html
<label for="toppings">Toppings</label>
<select id="toppings" name="toppings" multiple size="5">
  <option value="cheese">Extra cheese</option>
  <option value="mushrooms">Mushrooms</option>
  <option value="peppers">Peppers</option>
  <option value="olives">Olives</option>
  <option value="onions">Onions</option>
</select>
```

**Custom listbox (single choice):**

```html
<label id="colour-label">Colour</label>
<button
  aria-haspopup="listbox"
  aria-expanded="false"
  aria-labelledby="colour-label colour-value"
  id="colour-trigger"
>
  <span id="colour-value">Choose a colour</span>
</button>
<ul
  role="listbox"
  aria-labelledby="colour-label"
  tabindex="-1"
  id="colour-listbox"
>
  <li role="option" id="opt-red" aria-selected="false">Red</li>
  <li role="option" id="opt-blue" aria-selected="false">Blue</li>
  <li role="option" id="opt-green" aria-selected="false">Green</li>
</ul>
```

**Custom combobox (with text input and filtering):**

```html
<label for="city-input">City</label>
<input
  type="text"
  id="city-input"
  role="combobox"
  aria-expanded="false"
  aria-autocomplete="list"
  aria-controls="city-listbox"
  aria-activedescendant=""
>
<ul
  role="listbox"
  id="city-listbox"
  hidden
>
  <li role="option" id="city-1">Amsterdam</li>
  <li role="option" id="city-2">Berlin</li>
  <li role="option" id="city-3">Brussels</li>
</ul>
```

Key semantic requirements:
- Native `<select>` is always preferred when the design allows it. It handles keyboard interaction, screen reader announcements, and form submission automatically.
- Every select MUST have a visible `<label>` associated via `for`/`id`.
- For custom listboxes: the trigger MUST have `aria-haspopup="listbox"` and `aria-expanded` to communicate whether the list is open or closed.
- Each option in a custom listbox MUST have `role="option"`.
- The list container MUST have `role="listbox"`.
- The selected option MUST have `aria-selected="true"`. All others MUST have `aria-selected="false"`.
- For comboboxes: the input MUST have `role="combobox"`, `aria-expanded`, `aria-controls` pointing to the listbox, and `aria-activedescendant` pointing to the currently highlighted option.
- When the dropdown is closed, its options MUST be hidden from the accessibility tree (`hidden`, `display: none`, or equivalent).

### WCAG success criteria that apply

| Success criterion | Level | Why it applies |
|---|---|---|
| 1.3.1 Info and Relationships | A | The label, the listbox role, and the selected state must be programmatically exposed. |
| 2.1.1 Keyboard | A | The dropdown must be openable, navigable, and closable with a keyboard. |
| 2.4.3 Focus Order | A | Focus must move logically into and out of the dropdown. |
| 2.4.7 Focus Visible | AA | The focused option and the trigger must have visible focus indicators. |
| 2.5.3 Label in Name | A | The accessible name of the trigger must contain the visible label text. |
| 3.3.2 Labels or Instructions | A | The dropdown must have a visible label. |
| 4.1.2 Name, Role, Value | A | The trigger's name, role, expanded state, and the selected option must be exposed. |

### APG reference

ARIA Authoring Practices Guide — Listbox Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/listbox/

ARIA Authoring Practices Guide — Combobox Pattern
https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

---

### Test method 1: Keyboard only

**Setup:** Disconnect your mouse. Tab to the select dropdown.

**Important:** Native `<select>` and custom listboxes have different keyboard patterns. Native selects respond to `Arrow Up`/`Arrow Down` immediately (the value changes as you arrow). Some also open a dropdown popup with `Alt+Arrow Down` (Windows) or `Space` (varies). Custom listboxes typically require opening the list first (with `Enter`, `Space`, or `Arrow Down`), then arrowing through options, then selecting with `Enter`. The tests below cover both patterns and note where they diverge.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| K1 | Press `Tab` to move focus to the select or its trigger button. | Focus lands on the select element or the custom trigger. A visible focus indicator appears. | 2.1.1, 2.4.7 | If focus skips the dropdown, the trigger may not be focusable (a `<div>` without `tabindex`). If no focus indicator appears, the CSS suppresses the outline. |
| K2 | (Native select) Press `Arrow Down`. | The selected value changes to the next option. The displayed value updates immediately. | 2.1.1 | If arrow keys do not work, the element may be a custom build that has not implemented keyboard navigation. |
| K3 | (Native select) Press `Alt+Arrow Down` (Windows) or `Space` (varies by browser/OS). | The dropdown list opens, showing all options. | 2.1.1 | Not all browsers support `Alt+Arrow Down`. This is a native browser behaviour and not a WCAG failure if the select is still operable via plain arrow keys. |
| K4 | (Custom listbox) Press `Enter`, `Space`, or `Arrow Down` on the trigger. | The dropdown list opens. Focus moves into the list or the trigger indicates the list is open. | 2.1.1, 4.1.2 | If the dropdown does not open, the trigger lacks a keyboard handler. If the list opens but focus does not move to an option, the focus management is incomplete. |
| K5 | (Custom listbox, open) Press `Arrow Down` / `Arrow Up`. | The highlighted option moves through the list, one option at a time. The currently highlighted option is visually distinct. | 2.1.1, 2.4.7 | If arrow keys do not move through the options, the keyboard handler for the listbox is missing. If the highlight is invisible, the CSS does not style the active descendant. |
| K6 | (Custom listbox, open) Press `Enter`. | The highlighted option is selected. The dropdown closes. The trigger displays the selected value. | 2.1.1, 4.1.2 | If `Enter` does not select, the selection logic is missing. If the dropdown does not close, the close logic is missing. |
| K7 | (Custom listbox, open) Press `Escape`. | The dropdown closes without changing the selection. Focus returns to the trigger. | 2.1.1 | If `Escape` does not close the dropdown, the key handler is missing. |
| K8 | (Custom combobox) Type text into the input. | The dropdown opens and filters the list to show matching options. | 2.1.1 | If typing does not filter, the autocomplete logic is missing. If the dropdown does not open on typing, the `aria-expanded` state is not being updated. |
| K9 | (Custom combobox) Press `Arrow Down` while the filtered list is open. | Focus (via `aria-activedescendant`) moves to the first option in the filtered list. | 2.1.1, 4.1.2 | If the option is not highlighted, `aria-activedescendant` is not being updated. |
| K10 | (Custom combobox) Press `Enter` on a highlighted option. | The option is selected. The input value updates to the selected option's text. The dropdown closes. | 2.1.1 | If the input does not update, the selection logic is not connected to the input value. |
| K11 | (Native or custom, multiple select) Press `Space` on an option, or hold `Shift+Arrow Down`. | The option is selected or deselected without affecting other selections. Multiple options can be selected. | 2.1.1 | If selecting a new option deselects the previous one, the multi-select behaviour is not implemented. For native multiple selects, `Ctrl+Click` is the mouse pattern, but keyboard users use `Space` to toggle individual options and `Shift+Arrow` to select ranges. |
| K12 | Press `Tab` to leave the dropdown. | Focus moves to the next focusable element. The selected value is retained. | 2.1.1, 2.4.3 | If the selection is lost when focus leaves, the component has a state management bug. |

---

### Test method 2: Screen reader (NVDA on Windows / VoiceOver on macOS)

**Setup:** Start your screen reader. Navigate to the dropdown.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| SR1 | Navigate to the select or custom trigger. | The screen reader announces the label, the role (for example, "combo box," "list box," or "pop-up button"), and the currently selected value. Example: "Country, combo box, collapsed, Choose a country." | 1.3.1, 4.1.2, 3.3.2 | If no label is announced, the `<label>` is not connected. If no role is announced, the custom trigger lacks the correct ARIA roles. If no selected value is announced, the trigger does not expose its current value. |
| SR2 | Open the dropdown. | The screen reader announces that the list is expanded. For custom listboxes, it may announce the number of options. Example: "expanded" or "list box, 3 items." | 4.1.2 | If "expanded" is not announced, `aria-expanded` is not toggling. |
| SR3 | Arrow through the options. | The screen reader announces each option's text as it receives focus or becomes the active descendant. For custom listboxes, it may announce the position (for example, "Germany, 2 of 4"). | 4.1.2 | If option text is not announced, the options lack `role="option"` or the `aria-activedescendant` is not updating. If position is not announced, the options may not be inside a `role="listbox"` container. |
| SR4 | Select an option and close the dropdown. | The screen reader announces the selected value and that the dropdown is collapsed. | 4.1.2 | If the selected value is not announced after closing, the trigger text or `aria-selected` is not updating. |
| SR5 | (For combobox) Type a filter string and listen. | The screen reader announces the number of filtered results or the first matching option (depending on implementation). The live region or `aria-live` attribute communicates how many matches are available. | 4.1.2, 1.3.1 | If the user types and hears nothing about the results, there is no live region announcing the filter status. The user is flying blind. A common pattern is a visually hidden `aria-live="polite"` region that says "3 results available." |

---

### Test method 3: Voice control (Dragon NaturallySpeaking / Voice Control on macOS)

**Setup:** Activate your voice control software.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VC1 | Say "Click [visible label text]" (for example, "Click Country"). | Focus moves to the select or the custom trigger. | 2.5.3 | If the voice control cannot find the target, the label may not be associated. Check `for`/`id` matching. For custom triggers, check that the accessible name includes the visible label. |
| VC2 | (Native select) Say "Show choices" or interact with the select directly. | The browser's native dropdown opens showing all options. | 4.1.2 | Native selects are generally well-supported by voice control. If the dropdown does not open, there may be JavaScript intercepting the native behaviour. |
| VC3 | (Custom listbox) Say "Click [trigger text]" or "Click [visible label]." | The custom dropdown opens. | 2.5.3 | If the trigger text does not match the accessible name, voice control cannot find it. |
| VC4 | Say "Click [option text]" (for example, "Click Germany"). | The option is selected. | 2.5.3 | If the option cannot be targeted by voice, it may not be rendered as a recognisable interactive element. Options inside a custom listbox need `role="option"` to be discoverable. |
| VC5 | Say "Show numbers." | The trigger and all visible options (when open) are highlighted as numbered targets. | 4.1.2 | If options are not numbered, they may not be recognised as interactive elements. |

---

### Test method 4: Visual and zoom check

**Setup:** Use only your eyes and the browser's zoom function.

| Step | Action (If This) | Expected outcome (Then That) | WCAG ref | Failure explanation |
|---|---|---|---|---|
| VZ1 | Look at the dropdown in its closed state. | The dropdown has a visible label above or beside it. The trigger clearly looks interactive (has a border, a down arrow icon, or other visual affordance). The current selected value or placeholder text is visible. | 3.3.2, 1.4.11 | If there is no visible label, users do not know what the dropdown is for. If the trigger looks like plain text, users will not know it is interactive. The trigger boundary must have at least 3:1 contrast against the background. |
| VZ2 | Open the dropdown and check the options list. | The options list appears clearly connected to the trigger (directly below or overlapping). Each option is readable. The currently selected option (if any) is visually highlighted by more than colour alone. | 1.3.1, 1.4.1 | If the selected option is indicated only by colour (for example, blue background with no other cue), users with colour vision deficiencies cannot identify it. A check mark, bold text, or border in addition to colour is needed. |
| VZ3 | Check the dropdown against its surroundings. | The options list has sufficient contrast against the page background. If the list overlays other content, it is clearly distinguished (with a border, shadow, or solid background). | 1.4.3, 1.4.11 | If the dropdown options blend into the page background, users may not be able to read them. |
| VZ4 | Zoom to 200%. | The dropdown and its options remain fully visible and usable. Option text is not truncated. The trigger does not overflow its container. | 1.4.4, 1.4.10 | If option text is cut off or the trigger overflows, the CSS uses fixed widths. |
| VZ5 | Zoom to 400%. | The dropdown reflows with the page. It remains usable. If the options list is taller than the viewport, it scrolls within its own container. | 1.4.10 | At 400% zoom, the effective viewport is 320px. The dropdown must adapt to this narrow width. If the list extends beyond the viewport with no scroll, options are unreachable. |
| VZ6 | Tab to the trigger and check focus visibility. Then open the list and arrow through options. | The trigger has a visible focus indicator. Each highlighted option inside the open list has a visible focus/highlight indicator. | 2.4.7, 2.4.11 | Custom dropdowns often miss the focus indicator on the options inside the list. The options need a visible highlight that meets 3:1 contrast, not just a subtle background tint. |

---

### Common failures for select dropdown components

| Failure pattern | What the code looks like | Why it fails |
|---|---|---|
| No label association | `<select>` without a connected `<label>`, or a custom trigger with no `aria-labelledby`. | Screen readers announce "combo box" or "list box" with no name. Voice control users cannot target it. Fails 1.3.1, 3.3.2, 4.1.2. |
| Custom dropdown not keyboard operable | `<div class="dropdown" onclick="open()">` with no keyboard handler. Options only selectable by mouse click. | Keyboard users cannot open the list or select an option. Fails 2.1.1. |
| Missing listbox and option roles | Custom dropdown uses `<div>` elements for options with no ARIA roles. | Screen readers announce generic text instead of selectable options. No position information is provided. Fails 4.1.2, 1.3.1. |
| No aria-expanded on trigger | Custom trigger has no `aria-expanded` attribute. | Screen readers cannot tell whether the dropdown is open or closed. Fails 4.1.2. |
| No aria-selected on options | Options in a custom listbox have no `aria-selected` attribute. | Screen readers cannot announce which option is currently selected. Fails 4.1.2. |
| Options visible to screen reader when closed | Custom dropdown hides options visually with `opacity: 0` or `height: 0` but does not use `hidden`, `display: none`, or `aria-hidden="true"`. | Screen reader users can browse and interact with options that are supposed to be hidden. Fails 1.3.1. |
| No live region for combobox filter | Combobox filters options as the user types but provides no `aria-live` announcement of the results count. | Screen reader users type and hear nothing about what matched. They do not know if any options are available or how many. Not a strict WCAG failure, but a significant usability barrier. |
| Arrow keys do not work in open list | Custom dropdown opens but arrow keys move focus outside the list (scrolling the page or moving to unrelated elements). | The user cannot navigate the options. Fails 2.1.1. |
| Escape does not close | Custom dropdown has no `Escape` key handler. The only way to close is to click outside. | Keyboard users must Tab away to close the dropdown, which may also change the selection unintentionally. Not always a strict WCAG failure, but a serious usability problem and a deviation from the expected interaction pattern. |
| Native select wrapped in a hidden div | `<select>` is visually hidden and replaced by a custom `<div>` that does not forward focus or keyboard events. | The custom visual does not respond to keyboard. The native select is invisible. Both keyboard and screen reader interaction break. Fails 2.1.1, 4.1.2. |

---
---
