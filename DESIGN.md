# Design System Document

## 1. Overview & Creative North Star: "The Organic Grove"
This design system moves away from the rigid, clinical "grid-of-boxes" typical of e-commerce and moves toward **The Organic Grove**. The North Star for this system is to evoke the feeling of a sun-drenched, fresh garden where every element feels plucked from nature—soft, tactile, and breathing. 

We break the "template" look by utilizing **intentional asymmetry** and **tonal layering**. Instead of perfectly symmetrical product grids, we use varied card heights and overlapping elements (like a carrot icon peeking out from behind a category title) to create a sense of life. The experience should feel like an editorial magazine for high-end produce, rather than a warehouse inventory list.

---

## 2. Colors & The Surface Manifesto
The palette is rooted in the vitality of `primary` (#176a21) and the playful energy of `secondary` (#9b3e20). 

### The "No-Line" Rule
**Borders are prohibited.** To define sections, designers must use background shifts. A section might sit on `surface` (#ddffe2), while a featured carousel sits on `surface-container-low` (#cafdd4). This creates a "boundary-less" UI that feels infinite and fluid.

### Surface Hierarchy & Nesting
Treat the mobile screen as a series of stacked, organic layers:
- **Base Level:** `surface` (#ddffe2) – The soil of the app.
- **Content Blocks:** `surface-container` (#bef5ca) – For grouping related items.
- **Elevated Cards:** `surface-container-lowest` (#ffffff) – Used for product cards to make them "pop" against the tinted background.

### The Glass & Gradient Rule
To move beyond a flat digital look, apply a **Signature Glow**:
- **Hero CTAs:** Use a linear gradient from `primary` (#176a21) to `primary-dim` (#025d16) at a 135° angle.
- **Glassmorphism:** Floating navigation bars or "Quick Add" modals must use `surface` at 80% opacity with a `24px` backdrop blur, allowing the vibrant product colors to bleed through softly.

---

## 3. Typography: Editorial Rhythm
We use a high-contrast scale to guide the eye. While the tokens use `plusJakartaSans` and `beVietnamPro` as placeholders, these are mapped to **Tajawal** (for Display/Headline) and **Almarai** (for Body/Labels) for the Arabic implementation.

- **Display & Headlines (Tajawal):** Bold and expressive. Use `display-lg` (3.5rem) for promotional "Rabbit Deals" to create a boutique editorial feel.
- **Body & Titles (Almarai):** Highly legible. Use `body-md` for product descriptions, ensuring a generous line-height (1.6) to prevent the text from feeling cramped in the vibrant UI.
- **Visual Hierarchy:** Headlines use `on-background` (#0b361d), while secondary information uses `on-surface-variant` (#3b6447) to create a natural receding effect.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are often "dirty." In this system, we use light and color to create height.

- **The Layering Principle:** To lift a "Rabbit Choice" product, place a `surface-container-highest` (#acecbb) element inside a `surface` (#ddffe2) container. The shift in chroma provides enough distinction without structural lines.
- **Ambient Shadows:** If a floating action button (FAB) requires a shadow, use the `on-surface` color (#0b361d) at **6% opacity** with a **32px blur**. This mimics the soft shadow of a leaf on the ground.
- **The Ghost Border:** If a border is required for accessibility on form fields, use `outline-variant` (#8bb795) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: The Tactile Kit

### Buttons
- **Primary:** Rounded `full` (9999px), using the `primary` gradient. Soft, pill-shaped, and inviting.
- **Secondary:** Using `secondary-container` (#ffc4b3) with `on-secondary-container` text. This is for "Add to Cart" to provide a warm, carrot-themed contrast to the green environment.

### Cards & Lists
- **The "No-Divider" Rule:** Never use horizontal lines to separate list items. Use `1.5rem` (md) vertical spacing or alternate background tints (`surface-container-low` vs `surface-container-high`).
- **Product Cards:** Use `xl` (3rem) corner radius on the top-right corner and `DEFAULT` (1rem) on others to create a signature, "leaf-like" organic shape.

### Input Fields
- **Search Bar:** Must be `surface-container-lowest` (#ffffff) with a `full` radius. Use a `tertiary` (#7f5200) magnifying glass icon for a sophisticated "earthy" touch.

### Chips (Category Selectors)
- **Unselected:** `surface-container-high` with `on-surface-variant`.
- **Selected:** `primary` background with `on-primary` text. Use an "asymmetric bounce" animation when tapped.

---

## 6. Do’s and Don’ts

### Do:
- **Use "White Space" as a Tool:** Allow items to breathe. The supermarket should feel like a premium farmer's market, not a bargain bin.
- **Embrace the Corner Scale:** Use `xl` (3rem) for large layout containers and `sm` (0.5rem) only for the smallest elements (like qty badges).
- **Prioritize Motion:** When a user adds an item, use a "squash and stretch" animation to reinforce the playful "Rabbit" persona.

### Don't:
- **No Pure Blacks:** Never use #000000. Use `on-background` (#0b361d) for deep contrast.
- **No Hard Edges:** Avoid `none` or `sm` roundedness for major components; it breaks the "Organic Grove" metaphor.
- **No 1px Borders:** Do not use borders to separate the bottom nav from the content; use a backdrop-blur glass effect instead.