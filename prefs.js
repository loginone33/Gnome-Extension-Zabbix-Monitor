import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { ZabbixClient } from './zabbixApi.js';

export default class ZabbixPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-other-symbolic',
        });
        window.add(page);

        const connGroup = new Adw.PreferencesGroup({
            title: 'Zabbix Server Connection',
            description: 'Enter your Zabbix Web URL and Personal API Token (Bearer Token)',
        });
        page.add(connGroup);

        const urlRow = new Adw.EntryRow({
            title: 'Server URL',
        });
        settings.bind('zabbix-url', urlRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        connGroup.add(urlRow);

        const tokenRow = new Adw.PasswordEntryRow({
            title: 'API Token (Zabbix 5.4+)',
        });
        settings.bind('api-token', tokenRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        connGroup.add(tokenRow);

        const testRow = new Adw.ActionRow({
            title: 'Test Connection',
            subtitle: 'Verify server reachability and API token authentication',
        });
        const testButton = new Gtk.Button({
            label: 'Test',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        testRow.add_suffix(testButton);
        connGroup.add(testRow);

        const monitorGroup = new Adw.PreferencesGroup({
            title: 'Monitoring',
            description: 'Polling interval and alert filter settings',
        });
        page.add(monitorGroup);

        const refreshAdjustment = new Gtk.Adjustment({
            lower: 10,
            upper: 3600,
            step_increment: 5,
            page_increment: 30,
        });
        const refreshRow = new Adw.SpinRow({
            title: 'Refresh interval (seconds)',
            adjustment: refreshAdjustment,
        });
        settings.bind('refresh-interval', refreshRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        monitorGroup.add(refreshRow);

        const severities = Gtk.StringList.new([
            'All (Not classified)',
            'Information (1+)',
            'Warning (2+)',
            'Average (3+)',
            'High (4+)',
            'Disaster (5)',
        ]);
        const severityRow = new Adw.ComboRow({
            title: 'Minimum severity',
            model: severities,
        });
        settings.bind('min-severity', severityRow, 'selected', Gio.SettingsBindFlags.DEFAULT);
        monitorGroup.add(severityRow);

        const unackRow = new Adw.SwitchRow({
            title: 'Only unacknowledged problems',
            subtitle: 'Hide problems already acknowledged by administrators',
        });
        settings.bind('only-unacknowledged', unackRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        monitorGroup.add(unackRow);

        const countRow = new Adw.SwitchRow({
            title: 'Show count in panel',
            subtitle: 'Display active problem count badge next to the icon',
        });
        settings.bind('show-count', countRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        monitorGroup.add(countRow);

        const notifGroup = new Adw.PreferencesGroup({
            title: 'Notifications',
            description: 'Desktop alerts on problem count changes',
        });
        page.add(notifGroup);

        const notifSwitch = new Adw.SwitchRow({
            title: 'Problem count change notifications',
            subtitle: 'Send desktop notification when problem count increases or decreases',
        });
        settings.bind('enable-notifications', notifSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        notifGroup.add(notifSwitch);

        const cooldownAdjustment = new Gtk.Adjustment({
            lower: 10,
            upper: 3600,
            step_increment: 10,
            page_increment: 60,
        });
        const cooldownRow = new Adw.SpinRow({
            title: 'Notification cooldown (seconds)',
            subtitle: 'Minimum delay between notifications to prevent notification flooding',
            adjustment: cooldownAdjustment,
        });
        settings.bind('notification-cooldown', cooldownRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        notifGroup.add(cooldownRow);

        testButton.connect('clicked', async () => {
            testButton.set_sensitive(false);
            testRow.set_subtitle('Connecting to Zabbix server...');

            const client = new ZabbixClient();
            const cancellable = new Gio.Cancellable();
            const url = settings.get_string('zabbix-url');
            const token = settings.get_string('api-token');

            try {
                const version = await client.getVersion(url, cancellable);
                if (token) {
                    await client.getProblems(url, token, {limit: 1}, cancellable);
                    testRow.set_subtitle(`Connected! Zabbix API v${version} (Token valid)`);
                } else {
                    testRow.set_subtitle(`Connected! Zabbix API v${version} (No API token)`);
                }
            } catch (err) {
                testRow.set_subtitle(`Error: ${err.message}`);
            } finally {
                testButton.set_sensitive(true);
                client.destroy();
            }
        });
    }
}
