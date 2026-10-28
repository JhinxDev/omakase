# Lite account browser regression

From the repository root, with the existing Python environment and Playwright
available, run:

```sh
node tests/js/account_midnight_qa.cjs
```

The runner renders actual Jinja templates into a temporary output directory and
opens an isolated headless browser. It intercepts every request: no app server,
app database, saved credential, provider request or inference is involved. The
five intercepted account writes are synthetic responses only. It checks ten
states at 320, 390 and 1440 pixels, expanded invitation/history states, labels,
visible-text contrast, control sizes, overflow, keyboard focus and normal/reduced
motion. Screenshots and browser-receipt.json include the tested source hashes.
This is browser emulation and contrast smoke, not physical-device, full WCAG or
creative acceptance.

The default interpreter is the repository .venv when present, then Python on PATH.
Jinja is already an app dependency. Playwright resolves from the installed Node
environment; this script never installs dependencies. Windows defaults to the
installed Edge channel; other platforms use Playwright Chromium.

Optional arguments: --root PATH, --output PATH, --python EXECUTABLE and --browser
EXECUTABLE. Equivalent environment overrides are OMAKASE_ACCOUNT_QA_OUTPUT,
OMAKASE_QA_PYTHON and OMAKASE_QA_BROWSER_EXECUTABLE. OMAKASE_QA_NODE_MODULES can name
an existing package directory, and OMAKASE_QA_BROWSER_CHANNEL can choose an
installed browser channel. NODE_PATH also works with standard Node resolution.
Use an output directory outside source control. Required tools must already be
available; a missing tool fails the check without installing or substituting it.

## Guest counter regression

Run `node tests/js/public_midnight_qa.cjs` to check the real guest markup, CSS and
controllers with intercepted jobs at 320, 390, 1440 and 2560 pixels. It covers
validation, loading, cancellation, provider errors, empty/results/comparison
states, key clearing, keyboard focus and text collisions. It never calls a real
provider or opens an application database. The same browser/module environment
overrides apply. `OMAKASE_PUBLIC_QA_OUTPUT` chooses its temporary report folder.
