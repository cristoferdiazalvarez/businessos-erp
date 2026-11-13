# Third-party license review

No license has been added for the BusinessOS source code. MIT is a reasonable option for the owner's original code, subject to the owner's confirmation and the separate obligations of bundled dependencies. This is a dependency metadata review, not a complete legal assessment.

The installed production dependency metadata was inspected using `pnpm licenses list --prod --json` on 2026-11-13. Most packages use permissive licenses, including MIT, Apache-2.0, ISC and BSD variants. Retain their upstream notices when distributing packaged software.

Additional license groups in the local dependency graph include:

| Component | Reported license | Distribution consideration |
| --- | --- | --- |
| `@img/sharp-libvips-darwin-arm64` 1.3.4 | LGPL-3.0-or-later | Native libvips packaging; review LGPL obligations and upstream source availability before distributing binaries. Linux builds resolve platform-specific equivalents. |
| `argparse` 3.0.4 | PSF-2.0 | Retain upstream license notices. |
| `caniuse-lite` 1.0.30001826 | CC-BY-4.0 | Retain dataset attribution where redistributed. |

The local report is platform-specific and remains outside the publication tree. Re-run the review for the deployment platform and final image contents. A future MIT license for BusinessOS does not relicense or remove third-party licenses. Keep upstream license files in packaged dependencies.
