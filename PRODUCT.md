# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Visitors arriving at Raj.v Singh's freight-services website on desktop or mobile.

## Product Purpose

Introduce the site with a cinematic, space-themed login experience, then let visitors enter the existing freight-services website without replacing or redesigning it.

## Operating Context

The project runs locally at `http://localhost:5173/` as a single-page static web experience.

## Capabilities and Constraints

- The existing freight website must remain intact after the intro is dismissed.
- The startup experience is full-viewport and responsive.
- Submitting the login form or choosing Google reveals the existing website at the same URL without creating a reload loop. Authentication is visual-only because no backend or identity provider is connected.
- After entry, refreshing keeps the visitor on the same page and allows the browser to restore the same scroll position instead of replaying the intro or navigating elsewhere.
- Motion respects `prefers-reduced-motion`.

## Brand Commitments

- Preserve the existing Raj.v Singh logo and freight website.
- The startup experience uses the supplied Earth video behind a neon-blue TransportPro login card inspired by the user-supplied visual reference.
- The card entrance uses GSAP 3.15 and MotionPathPlugin from jsDelivr.

## Evidence on Hand

- Existing freight website: `index.html`
- Existing logo asset: `public/raj-v-singh-logo.png`
- User-supplied startup-page specification: `C:\Users\rajsi\.codex\attachments\98b5d942-ba0e-4243-be33-b45acaed23c1\Pasted text.txt`

## Product Principles

- Make entry feel cinematic but immediate.
- Preserve a clear and accessible path into the main site.
- Keep the existing website unchanged beneath the intro.
- Adapt cleanly from phone to wide desktop.

## Accessibility & Inclusion

Keyboard navigation, visible focus, semantic controls, and reduced-motion behavior are required.
