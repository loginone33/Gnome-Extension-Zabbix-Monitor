import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const SEVERITIES = [
    {id: 0, name: 'Not classified', color: '#97AAB3', cssClass: 'zabbix-sev-0'},
    {id: 1, name: 'Information',    color: '#7499FF', cssClass: 'zabbix-sev-1'},
    {id: 2, name: 'Warning',        color: '#FFC859', cssClass: 'zabbix-sev-2'},
    {id: 3, name: 'Average',        color: '#FFA059', cssClass: 'zabbix-sev-3'},
    {id: 4, name: 'High',           color: '#E97659', cssClass: 'zabbix-sev-4'},
    {id: 5, name: 'Disaster',       color: '#E45959', cssClass: 'zabbix-sev-5'},
];

export class ZabbixClient {
    constructor(session = null) {
        this._session = session ?? new Soup.Session();
    }

    async request(url, token, method, params, cancellable = null) {
        if (!url) {
            throw new Error('Zabbix server URL is not configured.');
        }

        const endpoint = url.replace(/\/+$/, '') + '/api_jsonrpc.php';
        const payload = JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id: Date.now(),
            ...(token ? {auth: token} : {}),
        });

        const message = Soup.Message.new('POST', endpoint);
        if (!message)
            throw new Error(`Invalid Zabbix server URL: "${endpoint}"`);

        if (token) {
            message.get_request_headers().append('Authorization', `Bearer ${token}`);
        }
        message.set_request_body_from_bytes('application/json-rpc', new GLib.Bytes(payload));

        return new Promise((resolve, reject) => {
            this._session.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                cancellable,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const status = message.get_status();
                        if (status < 200 || status >= 300) {
                            reject(new Error(`HTTP error ${status}: ${message.get_reason_phrase()}`));
                            return;
                        }
                        const decoder = new TextDecoder('utf-8');
                        const data = JSON.parse(decoder.decode(bytes.get_data()));
                        if (data.error) {
                            reject(new Error(data.error.data ? `${data.error.message} (${data.error.data})` : data.error.message));
                            return;
                        }
                        resolve(data.result);
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
    }

    async getVersion(url, cancellable = null) {
        return this.request(url, null, 'apiinfo.version', {}, cancellable);
    }

    async getProblems(url, token, {minSeverity = 2, onlyUnacknowledged = false, limit = 250} = {}, cancellable = null) {
        const severities = [];
        for (let i = minSeverity; i <= 5; i++) {
            severities.push(i);
        }

        const params = {
            output: ['eventid', 'name', 'severity', 'clock', 'acknowledged', 'objectid'],
            severities,
            sortfield: ['eventid'],
            sortorder: 'DESC',
            recent: false,
            suppressed: false,
            limit,
        };

        if (onlyUnacknowledged) {
            params.acknowledged = false;
        }

        const problems = await this.request(url, token, 'problem.get', params, cancellable);
        if (!Array.isArray(problems) || problems.length === 0) {
            return [];
        }

        const triggerIds = [...new Set(
            problems.map(p => p.objectid).filter(id => id && id !== '0')
        )];

        if (triggerIds.length > 0) {
            const triggers = await this.request(
                url,
                token,
                'trigger.get',
                {
                    output: ['triggerid'],
                    triggerids: triggerIds,
                    selectHosts: ['hostid', 'host', 'name'],
                    monitored: true,
                    skipDependent: true,
                },
                cancellable
            );

            const hostMap = new Map();
            if (Array.isArray(triggers)) {
                for (const t of triggers) {
                    const host = t.hosts?.[0];
                    hostMap.set(t.triggerid, host ? (host.name || host.host || '') : '');
                }
            }

            // Zabbix problem.get ignores host/item status; trigger.get filters inactive/dependent alerts
            const activeProblems = [];
            for (const prob of problems) {
                if (prob.objectid && prob.objectid !== '0') {
                    if (hostMap.has(prob.objectid)) {
                        prob.hostname = hostMap.get(prob.objectid);
                        activeProblems.push(prob);
                    }
                } else {
                    prob.hostname = '';
                    activeProblems.push(prob);
                }
            }
            return activeProblems;
        }

        return problems;
    }

    destroy() {
        this._session.abort();
    }
}
