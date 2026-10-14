# Zabbix Monitor for GNOME Shell

**Zabbix Monitor** is a lightweight, responsive GNOME Shell extension that monitors active problems and triggers directly from the GNOME panel in real time.

---

## Features

- **Real-Time Panel Indicator**: Displays the current problem count with color-coded severity icons (OK, Warning, Average, High, Disaster).
- **Interactive Dropdown Menu**:
  - View the list of active problems with severity badges and affected host names.
  - Formatted elapsed time (`10s ago`, `5m ago`, `2h ago`).
  - Acknowledgment status flag.
  - Click any problem to jump directly to its details in your Zabbix Web UI.
- **Desktop Notifications**: Configurable alerts when the problem count increases or decreases, with adjustable cooldown to avoid alert fatigue.
- **Connection Diagnostics**: Built-in test tool in Preferences to verify server reachability and API token validity.
- **Filtering Options**: Filter by minimum severity level or hide acknowledged problems.
- **Clean & Lightweight**: Native GNOME Shell implementation with zero external dependencies.

---

## Compatibility

- **GNOME Shell**: 45, 46, 47, 48, 49, 50
- **Session**: Wayland & X11

---

## Installation & Deployment

### Local Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/loginone33/Gnome-Extension-Zabbix-Monitor.git
   cd Gnome-Extension-Zabbix-Monitor
   ```
2. Run the included installation script:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
3. Restart GNOME Shell (log out and log back in on Wayland, or press `Alt+F2`, type `r`, and press `Enter` on X11).
4. Enable the extension:
   ```bash
   gnome-extensions enable zabbix-monitor@loginone
   ```

---

## Configuration

Open Extension Preferences (`gnome-extensions prefs zabbix-monitor@loginone` or via the panel menu) to configure:

- **Server URL**: The base URL of your Zabbix web interface (e.g. `https://zabbix.example.com`).
- **API Token**: A personal Bearer API token generated in Zabbix (*User settings -> API tokens*). Compatible with Zabbix 5.4+.
- **Refresh Interval**: How often to poll the Zabbix API (10 to 3600 seconds, default: 60s).
- **Minimum Severity**: Filter alerts below a specific severity threshold.
- **Only Unacknowledged**: Toggle to ignore acknowledged alerts.
- **Notifications**: Enable/disable desktop alerts and adjust cooldown interval.

---

## Support & Donations

If you like this extension and want to support its ongoing development, your support is greatly appreciated!

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Donate%20(PayPal)-ff5e5b.svg)](https://ko-fi.com/loginone)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-yellow.svg)](https://buymeacoffee.com/loginone)

- **Ko-fi** *(PayPal available)*: [ko-fi.com/loginone](https://ko-fi.com/loginone)
- **Buy Me A Coffee**: [buymeacoffee.com/loginone](https://buymeacoffee.com/loginone)
