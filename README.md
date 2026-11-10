# Einherjar dashboard

A single-page fitness dashboard (`index.html`), hosted with GitHub Pages:
https://andreaalonso0007.github.io/Fitness-Dashboard/

## How it works
- **Standalone:** no server. Logs (weigh-ins, steps, sleep, habits, check-ins) are saved in the browser.
- **Across devices:** with a GitHub token saved on a device, the page keeps an encrypted copy of the logs in `data/state.enc` and merges changes between devices. Photos stay on the device that took them.
- **Polar Loop:** a scheduled GitHub Action (`.github/workflows/polar-sync.yml`) pulls sleep, HRV, resting heart rate and steps from the Polar AccessLink API into `data/polar.enc`. The **Sync now** button runs it on demand.
- **Privacy:** everything under `data/` is encrypted with a passphrase (repository secret `DATA_KEY`). The passphrase is typed once per device and never stored in the repo.

## Setup (already done for this repo)
Repository secrets: `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET`, `DATA_KEY`.
First link: authorize the Polar app, then run the **Polar sync** workflow once with the authorization code.

`archive/` holds the previous version of the dashboard.
