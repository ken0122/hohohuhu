---
timestamp: 2026-08-30T10-06-41Z
slug: src-renderer-character-library-html
---
# Impeccable critique: Character Library

Method: dual-agent (A: /root/impeccable_review_a · B: /root/impeccable_review_b)

Target: `src/renderer/character-library.html` · Mode: Operate · 2026-08-30

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Preview/current distinction is spread across list copy, status and footer CTA. |
| 2 | Match system/real world | 3 | Trustworthy native flow; some implementation language reaches users. |
| 3 | User control/freedom | 3 | Draft can be silently replaced or abandoned by close/Esc. |
| 4 | Consistency/standards | 3 | Affection feedback stays blue after changing character. |
| 5 | Error prevention | 3 | Strong file limits, but dirty draft is not protected. |
| 6 | Recognition over recall | 3 | Users must combine multiple regions to know preview vs current. |
| 7 | Flexibility/efficiency | 2 | Catalog lacks arrow navigation; action controls mix semantics. |
| 8 | Aesthetic/minimalist design | 3 | Clear character stage; five peer motion buttons compete. |
| 9 | Error recovery | 2 | Generic retry copy and no recovery for discarded drafts. |
| 10 | Help/documentation | 3 | Honest limits, but guidance is distributed across four regions. |
| **Total** | | **28/40** | **Good; identity propagation and state model need tightening.** |

## Specificity verdict

The milk-white, ink/brand-blue system, 84px/64px reality checks, local conversion comparison and explicit apply step clearly belong to 呼噜呼噜. Its list/detail skeleton is conventional, and a new character currently changes only the center artwork: blue affection hearts remain global and the cat has static white eyes. The next refinement should propagate a trusted character identity into feedback, gaze and preview copy without redesigning the surface.

## Priority issues

1. **P1 — Character identity does not reach Pet affection.** Hard-coded blue hearts make the cat feel like swapped artwork. Add trusted per-character presentation metadata; blue heart feedback remains for the original, warm star/heart feedback for the cat, and a neutral fallback for local imports.
2. **P1 — Black-cat eyes cannot move.** BLACK_CAT inherits BASIC_SVG with no pupil or gaze binding. Add runtime-only pupils to the trusted built-in binding; do not infer eyes from user imports. Support cursor gaze in Dodge/Pet and direct preview pointer gaze, respecting reduced motion.
3. **P1 — Preview and current state are too similar.** Add a persistent current badge, a concise preview/current line, and a resolved current-state CTA. Give apply success a short character response.
4. **P2 — Draft loss is silent.** Protect close/Esc/re-import while a converted draft is dirty. Keep/edit vs discard must be explicit.
5. **P2 — Motion controls mix three semantics.** Group idle/walk/run as a segmented choice, separate one-shot hop and pause, and keep motion status separate from save/error status.
6. **P2 — Minimum-height context is fragmented.** Compress the preview stage at 720×620 so name, status and fixed primary action stay connected.

## Evidence and run notes

- Detector: one regex-degraded `broken-image` finding at `character-library.html:25`; false positive because the hidden `<img>` gets a blob URL only after conversion and is cleaned afterward. Parser modules were unavailable, so computed selector/contrast coverage was unavailable.
- Native evidence: `work/character-library.png`, `work/character-import.png`, `work/character-library-small.png`. 820×800 is clear; 720×620 has no horizontal overflow and fixed footer actions but initially cuts supporting draft context below the fold.
- Structural confirmation: `pet.css:57` hard-codes blue; `BLACK_CAT` has `gaze:null` and no pupil part; character motion requires both pupil and gaze.
- Existing strengths: character-first stage; accurate 84px/64px previews; preview-before-apply safety; explicit local/private conversion copy; solid focus, labels, fieldset, aria-live and busy states.
- Browser overlay was skipped because a static browser cannot supply Electron preload IPC and would render a misleading loading state. No live server was started; no cleanup remained.
- Ignore list absent. Assessment A completed before detector evidence entered parent synthesis. Temporary detector output was removed.

Questions skipped: the user explicitly requested the named fixes and optimization, so implementation proceeds from the two-agent findings.
