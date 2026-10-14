import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { SEVERITIES } from './zabbixApi.js';

function formatTimeAgo(epochSeconds) {
    const elapsed = Math.floor(Date.now() / 1000) - epochSeconds;
    if (elapsed < 60) return `${Math.max(0, elapsed)}s ago`;
    const minutes = Math.floor(elapsed / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export const ZabbixIndicator = GObject.registerClass(
class ZabbixIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Zabbix Monitor');
        this._extension = extension;

        const box = new St.BoxLayout({
            style_class: 'panel-status-indicators-box zabbix-panel-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_name: 'network-server-symbolic',
            style_class: 'system-status-icon zabbix-panel-icon',
        });
        box.add_child(this._icon);

        this._countLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'zabbix-count-label',
        });
        box.add_child(this._countLabel);

        this.add_child(box);

        this._buildMenu();
    }

    _buildMenu() {
        this._headerItem = new PopupMenu.PopupMenuItem('Zabbix: Checking...', {
            reactive: false,
            style_class: 'zabbix-menu-header',
        });
        this.menu.addMenuItem(this._headerItem);

        this._problemsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._problemsSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refreshItem = new PopupMenu.PopupImageMenuItem('Refresh now', 'view-refresh-symbolic');
        refreshItem.connect('activate', () => {
            this._extension.refresh();
        });
        this.menu.addMenuItem(refreshItem);

        const openWebItem = new PopupMenu.PopupImageMenuItem('Open Zabbix Web', 'web-browser-symbolic');
        openWebItem.connect('activate', () => {
            const url = this._extension.settings.get_string('zabbix-url');
            if (url) {
                Gio.AppInfo.launch_default_for_uri(url, null);
            }
        });
        this.menu.addMenuItem(openWebItem);

        const settingsItem = new PopupMenu.PopupImageMenuItem('Settings', 'emblem-system-symbolic');
        settingsItem.connect('activate', () => {
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(settingsItem);
    }

    updateStatus(problems, error = null) {
        this._problemsSection.removeAll();

        if (error) {
            this._icon.icon_name = 'dialog-warning-symbolic';
            this._icon.remove_style_class_name('zabbix-icon-ok');
            for (let i = 0; i <= 5; i++) {
                this._icon.remove_style_class_name(`zabbix-icon-sev-${i}`);
            }
            this._icon.add_style_class_name('zabbix-icon-error');
            this._countLabel.set_text('!');
            this._headerItem.label.set_text(`Error: ${error.message}`);

            const errItem = new PopupMenu.PopupMenuItem(error.message, {
                reactive: false,
                style_class: 'zabbix-empty-item',
            });
            this._problemsSection.addMenuItem(errItem);
            return;
        }

        this._icon.remove_style_class_name('zabbix-icon-error');
        for (let i = 0; i <= 5; i++) {
            this._icon.remove_style_class_name(`zabbix-icon-sev-${i}`);
        }

        const showCount = this._extension.settings.get_boolean('show-count');
        const count = problems.length;

        const now = GLib.DateTime.new_now_local();
        const timeStr = now.format('%H:%M:%S');
        this._headerItem.label.set_text(`Active problems: ${count} (${timeStr})`);

        if (count === 0) {
            this._icon.icon_name = 'emblem-ok-symbolic';
            this._icon.add_style_class_name('zabbix-icon-ok');
            this._countLabel.set_text(showCount ? '0' : '');

            const okItem = new PopupMenu.PopupMenuItem('No active problems', {
                reactive: false,
                style_class: 'zabbix-empty-item',
            });
            this._problemsSection.addMenuItem(okItem);
            return;
        }

        let maxSev = 0;
        for (const p of problems) {
            const s = parseInt(p.severity, 10);
            if (s > maxSev) maxSev = s;
        }

        this._icon.icon_name = 'dialog-warning-symbolic';
        this._icon.remove_style_class_name('zabbix-icon-ok');
        this._icon.add_style_class_name(`zabbix-icon-sev-${maxSev}`);
        this._countLabel.set_text(showCount ? `${count}` : '');

        const baseUrl = this._extension.settings.get_string('zabbix-url').replace(/\/+$/, '');
        const maxDisplay = 20;
        const displayList = problems.slice(0, maxDisplay);

        for (const prob of displayList) {
            const sevNum = parseInt(prob.severity, 10) || 0;
            const sevMeta = SEVERITIES[sevNum] || SEVERITIES[0];
            const timeAgo = formatTimeAgo(parseInt(prob.clock, 10));

            const item = new PopupMenu.PopupBaseMenuItem({
                activate: true,
                style_class: `zabbix-problem-item zabbix-item-sev-${sevNum}`,
            });

            const contentBox = new St.BoxLayout({
                vertical: true,
                x_expand: true,
            });

            const titleBox = new St.BoxLayout({
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });

            const badge = new St.Label({
                text: `[${sevMeta.name.toUpperCase()}]`,
                style_class: `zabbix-badge zabbix-badge-sev-${sevNum}`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            titleBox.add_child(badge);

            const nameLabel = new St.Label({
                text: prob.name,
                style_class: 'zabbix-problem-name',
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            nameLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            titleBox.add_child(nameLabel);

            contentBox.add_child(titleBox);

            const metaBox = new St.BoxLayout({
                style_class: 'zabbix-meta-box',
                y_align: Clutter.ActorAlign.CENTER,
            });

            if (prob.hostname) {
                const hostLabel = new St.Label({
                    text: prob.hostname,
                    style_class: 'zabbix-host-label',
                });
                metaBox.add_child(hostLabel);

                const dotLabel = new St.Label({
                    text: ' • ',
                    style_class: 'zabbix-dot-label',
                });
                metaBox.add_child(dotLabel);
            }

            const timeLabel = new St.Label({
                text: `${timeAgo}${prob.acknowledged === '1' ? ' • Acknowledged' : ''}`,
                style_class: 'zabbix-time-label',
            });
            metaBox.add_child(timeLabel);
            contentBox.add_child(metaBox);

            item.add_child(contentBox);

            item.connect('activate', () => {
                if (baseUrl) {
                    const targetUrl = `${baseUrl}/zabbix.php?action=problem.view&filter_name=${encodeURIComponent(prob.name)}`;
                    Gio.AppInfo.launch_default_for_uri(targetUrl, null);
                }
            });

            this._problemsSection.addMenuItem(item);
        }

        if (problems.length > maxDisplay) {
            const moreCount = problems.length - maxDisplay;
            const moreItem = new PopupMenu.PopupMenuItem(`...and ${moreCount} more in Zabbix`, {
                style_class: 'zabbix-more-item',
            });
            moreItem.connect('activate', () => {
                if (baseUrl) {
                    Gio.AppInfo.launch_default_for_uri(`${baseUrl}/zabbix.php?action=problem.view`, null);
                }
            });
            this._problemsSection.addMenuItem(moreItem);
        }
    }
});
