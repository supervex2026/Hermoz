Read this before any UI/design/redesign task on Hermoz.

# Hermoz UI/UX Design Precedence Hierarchy

This document defines the strict priority order and domain ownership for design skills when modifying Hermoz's desktop application interface.

## Ranked Skills & Ownership Boundaries

1. **desktop-ui-mastery** (Rank 1 — Primary Visual & Ergonomic Authority)
   - **What it owns**: Information density, typography scales, spacing tokens (`derive_tokens.py`), contrast tiers, layout rhythms, and keyboard-first desktop interaction patterns.
   - **What it does NOT own**: Platform-level window lifecycle, OS-specific APIs, or low-level WebView2 process management.

2. **native-feel-cross-platform-desktop** (Rank 2 — Desktop Architecture & Performance)
   - **What it owns**: Custom window chrome, Windows titlebar drag/snap conventions, system tray behavior, instant keyboard shortcuts, and keeping memory/GPU overhead minimal for low-end hardware (Dell OptiPlex 7040 / Intel HD 530 / 4GB RAM).
   - **What it does NOT own**: Detailed color palette choices, typography sizing scales, or aesthetic style definitions.

3. **ui_ux_pro_max** (Rank 3 — Searchable Reference & Palette Library)
   - **What it owns**: Searchable reference database (`search.py`) for looking up accessible color harmonies, WCAG contrast verification, and standard UI pattern catalogs.
   - **What it does NOT own**: Desktop ergonomics, window layouts, or deciding application spatial density.

4. **design-taste-frontend** (Rank 4 — Subordinated / Web-Only Aesthetics)
   - **What it owns**: Creative editorial direction for web landing pages, documentation sites, and external marketing portfolios.
   - **What it does NOT own**: Desktop app shells, desktop modals, companion overlays, toolbars, or in-app workspace panels.

---

## Conflict Resolution Rule

When design guidance conflicts, apply the higher-ranked skill. **`design-taste-frontend` is web-landing-page oriented and must be subordinated on all desktop surfaces.** Avoid web anti-patterns such as oversized empty whitespace, floating marketing cards, heavy blur/backdrop filters that strain Intel HD 530 graphics, and `cursor: pointer` on desktop table rows.
