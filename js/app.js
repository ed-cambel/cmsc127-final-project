/* ── OnLine Queue System — app.js ── */

const API = {
    async call(endpoint, method = 'GET', body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(endpoint, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    },

    // Auth
    login:    (u, p) => API.call('api/auth.php?action=login',    'POST', { username: u, password: p }),
    register: (u, p) => API.call('api/auth.php?action=register', 'POST', { username: u, password: p }),
    logout:   ()     => API.call('api/auth.php?action=logout',   'POST'),
    session:  ()     => API.call('api/auth.php?action=session'),

    // Services
    getServices:    ()   => API.call('api/services.php'),
    createService:  (d)  => API.call('api/services.php', 'POST', d),
    updateService:  (d)  => API.call('api/services.php', 'PUT', d),
    deleteService:  (id) => API.call('api/services.php', 'DELETE', { service_id: id }),

    // Locations
    getLocations:   ()   => API.call('api/locations.php'),
    createLocation: (d)  => API.call('api/locations.php', 'POST', d),
    updateLocation: (d)  => API.call('api/locations.php', 'PUT', d),
    deleteLocation: (id) => API.call('api/locations.php', 'DELETE', { location_id: id }),

    // Queues
    getQueues: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return API.call(`api/queues.php?${qs}`);
    },
    joinQueue:   (serviceId) => API.call('api/queues.php?action=join', 'POST', { service_id: serviceId }),
    nextInQueue: (serviceId) => API.call('api/queues.php?action=next', 'POST', { service_id: serviceId }),
    skipQueue:   (queueId)   => API.call('api/queues.php?action=skip', 'POST', { queue_id: queueId }),
    readdQueue:  (queueId)   => API.call('api/queues.php?action=readd', 'POST', { queue_id: queueId }),
    switchQueue: (a, b)      => API.call('api/queues.php?action=switch', 'POST', { queue_id_a: a, queue_id_b: b }),
    cancelQueue: (queueId)   => API.call('api/queues.php?action=cancel', 'POST', { queue_id: queueId }),
    deleteQueue: (queueId)   => API.call('api/queues.php', 'DELETE', { queue_id: queueId }),

    // Switch request (consent-based)
    requestSwitch:     (fromQid, toQid)    => API.call('api/queues.php?action=switch_request', 'POST', { from_queue_id: fromQid, to_queue_id: toQid }),
    respondSwitch:     (requestId, dec)    => API.call('api/queues.php?action=switch_respond', 'POST', { request_id: requestId, decision: dec }),
    cancelSwitch:      (requestId)         => API.call('api/queues.php?action=switch_cancel',  'POST', { request_id: requestId }),
    mySwitchRequests:  ()                  => API.call('api/queues.php?action=my_switch_requests'),

    // Users
    getUsers:   ()   => API.call('api/users.php'),
    createUser: (d)  => API.call('api/users.php', 'POST', d),
    updateUser: (d)  => API.call('api/users.php', 'PUT', d),
    deleteUser: (id) => API.call('api/users.php', 'DELETE', { user_id: id }),

    // Staff
    getStaff:    ()   => API.call('api/staff.php'),
    createStaff: (d)  => API.call('api/staff.php', 'POST', d),
    updateStaff: (d)  => API.call('api/staff.php', 'PUT', d),
    deleteStaff: (id) => API.call('api/staff.php', 'DELETE', { staff_id: id }),
};

/* ── State ── */
let currentUser = null;
let currentPage = 'dashboard';

/* ── Toast ── */
function toast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

/* ── Modal helper ── */
function openModal(title, bodyHTML, onConfirm) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <h3>${title}</h3>
            <div class="modal-body">${bodyHTML}</div>
            <div class="modal-actions">
                <button class="btn" id="modal-cancel">Cancel</button>
                ${onConfirm ? '<button class="btn btn-primary" id="modal-confirm">Confirm</button>' : ''}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#modal-cancel').onclick = () => overlay.remove();
    if (onConfirm) {
        overlay.querySelector('#modal-confirm').onclick = () => {
            onConfirm(overlay);
            overlay.remove();
        };
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    return overlay;
}
