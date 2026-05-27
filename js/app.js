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
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    el.addEventListener('click', () => el.remove());
    c.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

/* ── Button loading helper ── */
function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.loading = 'true';
        btn.dataset.originalLabel = btn.textContent;
        btn.setAttribute('aria-busy', 'true');
        btn.disabled = true;
    } else {
        btn.removeAttribute('data-loading');
        btn.removeAttribute('aria-busy');
        btn.disabled = false;
        if (btn.dataset.originalLabel) {
            btn.textContent = btn.dataset.originalLabel;
            delete btn.dataset.originalLabel;
        }
    }
}

/* ── Modal helper (focus trap, Escape, accessibility) ── */
let _lastFocusedBeforeModal = null;
function openModal(title, bodyHTML, onConfirm) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    _lastFocusedBeforeModal = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');
    overlay.innerHTML = `
        <div class="modal">
            <h3 id="modal-title">${title}</h3>
            <div class="modal-body">${bodyHTML}</div>
            <div class="modal-actions">
                <button class="btn" id="modal-cancel" type="button">Cancel</button>
                ${onConfirm ? '<button class="btn btn-primary" id="modal-confirm" type="button">Confirm</button>' : ''}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        if (_lastFocusedBeforeModal && _lastFocusedBeforeModal.focus) {
            try { _lastFocusedBeforeModal.focus(); } catch (_) {}
        }
    };

    overlay.querySelector('#modal-cancel').onclick = close;

    const confirmBtn = overlay.querySelector('#modal-confirm');
    if (onConfirm && confirmBtn) {
        confirmBtn.onclick = async () => {
            const result = onConfirm(overlay);
            if (result && typeof result.then === 'function') {
                setLoading(confirmBtn, true);
                try { await result; } finally { setLoading(confirmBtn, false); }
            }
            close();
        };
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Focus trap + Escape
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key !== 'Tab') return;
        const focusable = overlay.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }
    document.addEventListener('keydown', onKey);

    // Move focus into modal — first input, otherwise first button
    requestAnimationFrame(() => {
        const target = overlay.querySelector('input, select, textarea, button.btn-primary, button');
        if (target) target.focus();
    });

    return overlay;
}
