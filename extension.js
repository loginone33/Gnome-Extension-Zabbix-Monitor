import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { ZabbixIndicator } from './indicator.js';
import { ZabbixClient } from './zabbixApi.js';

export default class ZabbixExtension extends Extension {
    enable() {
        this.settings = this.getSettings();
        this._client = new ZabbixClient();
        this._cancellable = null;
        this._timeoutId = null;
        this._settingsSignals = [];
        this._lastProblems = null;
        this._baselineCount = null;
        this._lastNotificationTime = 0;

        this._indicator = new ZabbixIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');

        this._settingsSignals.push(
            this.settings.connect('changed::refresh-interval', () => this._resetTimer()),
            this.settings.connect('changed::min-severity', () => {
                this._baselineCount = null;
                this.refresh();
            }),
            this.settings.connect('changed::only-unacknowledged', () => {
                this._baselineCount = null;
                this.refresh();
            }),
            this.settings.connect('changed::zabbix-url', () => {
                this._baselineCount = null;
                this.refresh();
            }),
            this.settings.connect('changed::api-token', () => {
                this._baselineCount = null;
                this.refresh();
            }),
            this.settings.connect('changed::show-count', () => {
                if (this._lastProblems && this._indicator) {
                    this._indicator.updateStatus(this._lastProblems);
                }
            })
        );

        this._resetTimer();
        this.refresh();
    }

    _resetTimer() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        const interval = Math.max(10, this.settings.get_int('refresh-interval') || 60);
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            this.refresh();
            return GLib.SOURCE_CONTINUE;
        });
    }

    async refresh() {
        if (!this.settings || !this._client) return;

        if (this._cancellable) {
            this._cancellable.cancel();
        }
        this._cancellable = new Gio.Cancellable();

        const url = this.settings.get_string('zabbix-url');
        const token = this.settings.get_string('api-token');
        const minSeverity = this.settings.get_int('min-severity');
        const onlyUnacknowledged = this.settings.get_boolean('only-unacknowledged');

        if (!url) {
            this._indicator?.updateStatus([], new Error('Zabbix URL is not configured in settings'));
            return;
        }

        try {
            const problems = await this._client.getProblems(
                url,
                token,
                { minSeverity, onlyUnacknowledged },
                this._cancellable
            );
            this._lastProblems = problems;
            this._indicator?.updateStatus(problems);

            const count = problems.length;
            if (this._baselineCount === null) {
                this._baselineCount = count;
            } else if (count !== this._baselineCount) {
                this._checkAndNotify(count, problems);
            }
        } catch (e) {
            if (e.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                return;
            }
            this._indicator?.updateStatus([], e);
        }
    }

    _checkAndNotify(newCount, problems) {
        if (!this.settings.get_boolean('enable-notifications')) {
            this._baselineCount = newCount;
            return;
        }

        const cooldownSec = Math.max(10, this.settings.get_int('notification-cooldown') || 60);
        const now = Date.now();

        if (now - this._lastNotificationTime < cooldownSec * 1000) {
            return;
        }

        const oldCount = this._baselineCount;

        if (newCount > oldCount) {
            const diff = newCount - oldCount;
            const latest = problems[0];
            const hostInfo = latest?.hostname ? `[${latest.hostname}] ` : '';
            const probDesc = latest?.name ? `\nLatest: ${hostInfo}${latest.name}` : '';

            Main.notifyError(
                `🔴 Zabbix: Problem Count Increased (+${diff})`,
                `Alert count increased: ${oldCount} ➔ ${newCount}${probDesc}`
            );
        } else if (newCount < oldCount) {
            const diff = oldCount - newCount;
            const msg = newCount === 0
                ? `All active problems resolved! (${oldCount} ➔ 0)`
                : `Alert count decreased: ${oldCount} ➔ ${newCount}`;

            Main.notify(
                `🟢 Zabbix: Problem Count Decreased (-${diff})`,
                msg
            );
        }

        this._lastNotificationTime = now;
        this._baselineCount = newCount;
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }

        if (this.settings) {
            for (const id of this._settingsSignals) {
                this.settings.disconnect(id);
            }
            this._settingsSignals = [];
            this.settings = null;
        }

        if (this._client) {
            this._client.destroy();
            this._client = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._lastProblems = null;
        this._baselineCount = null;
        this._lastNotificationTime = 0;
    }
}
