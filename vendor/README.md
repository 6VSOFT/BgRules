# vendor/

Third-party libraries, bundled locally so the PWA works offline. No build step; they load as plain
`<script>` tags in `index.html` and are wired together in `fx.js`.

| Library | Version | Files | License |
| --- | --- | --- | --- |
| [GSAP](https://gsap.com) | 3.15.1 | `gsap/gsap.min.js`, `gsap/ScrollTrigger.min.js`, `gsap/SplitText.min.js` | [GSAP Standard "no charge" license](https://gsap.com/standard-license) (header in each file) |
| [Lenis](https://lenis.dev) | 1.3.27 | `lenis/lenis.min.js`, `lenis/lenis.css` | MIT (`lenis/LICENSE`) |
| [React](https://react.dev) + ReactDOM | 18.3.1 (UMD builds) | `react/react.production.min.js`, `react/react-dom.production.min.js` | MIT (`react/LICENSE`) |
| [React Bits](https://reactbits.dev) — SplitText | from `DavidHDev/react-bits` main | `reactbits/SplitText.js` (ported to run without a build) | MIT + Commons Clause (notice in the file) |

React 18 is used because it is the last major version that ships browser-ready UMD builds.

To update: `npm pack <pkg>@<version>`, copy the same `dist`/`umd` files over, then bump `VERSION` in `sw.js`.
