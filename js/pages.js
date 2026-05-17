/* ── OnLine Queue System — pages.js ── */

/* ══════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════ */
function navigate(page) {
    currentPage = page;
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === page);
    });
    renderPage();
}

function renderPage() {
    const main = document.getElementById('main-content');
    switch (currentPage) {
        case 'dashboard':  renderDashboard(main);  break;
        case 'board':      renderBoard(main);       break;
        case 'queues':     renderQueues(main);      break;
        case 'services':   renderServices(main);    break;
        case 'staff':      renderStaffPage(main);   break;
        case 'users':      renderUsers(main);       break;
    }
}

/* ══════════════════════════════════════════════
   DASHBOARD — live queue board for customers
   ══════════════════════════════════════════════ */
async function renderDashboard(el) {
    el.innerHTML = `
        <div class="page-header">
            <h2>Dashboard</h2>
            <p>Join a queue and track your position in real time.</p>
        </div>
        <div id="dash-content">Loading...</div>
    `;
    try {
        const [svcData, qData] = await Promise.all([
            API.getServices(),
            API.getQueues({ date: today() })
        ]);
        const services = svcData.services;
        const queues   = qData.queues;

        let html = '<div class="queue-grid">';
        for (const svc of services) {
            const svcQ  = queues.filter(q => q.service_id == svc.service_id);
            const serving = svcQ.find(q => q.queue_status === 'serving');
            const waiting = svcQ.filter(q => q.queue_status === 'waiting');
            const myEntry = currentUser ? svcQ.find(q => q.user_id == currentUser.user_id && ['waiting','serving'].includes(q.queue_status)) : null;

            html += `<div class="card queue-card">
                <div class="service-label">${esc(svc.building_name)}</div>
                <div class="card-title">${esc(svc.service_name)}</div>
                <div class="now-serving-label">Now Serving</div>
                <div class="now-serving">${serving ? '#' + serving.queue_number : '—'}</div>
                <div class="mt-1 text-sm text-dim">${waiting.length} waiting</div>
                <div class="waiting-list mt-1">
                    ${waiting.map(w => `<span class="waiting-num">#${w.queue_number}</span>`).join('')}
                </div>
                <div class="mt-1 gap-row">
                    ${myEntry
                        ? `<span class="badge badge-${myEntry.queue_status}">You: #${myEntry.queue_number} (${myEntry.queue_status})</span>
                           ${myEntry.queue_status === 'waiting' ? `<button class="btn btn-sm btn-danger" onclick="cancelMyQueue(${myEntry.queue_id})">Cancel</button>` : ''}`
                        : (currentUser && currentUser.role === 'customer'
                            ? `<button class="btn btn-sm btn-primary" onclick="joinQueue(${svc.service_id})">Join Queue</button>`
                            : '')
                    }
                </div>
            </div>`;
        }
        html += '</div>';
        document.getElementById('dash-content').innerHTML = html;
    } catch (err) {
        document.getElementById('dash-content').innerHTML = `<p class="text-dim">${esc(err.message)}</p>`;
    }
}

async function joinQueue(serviceId) {
    try {
        const res = await API.joinQueue(serviceId);
        toast(`Joined! Your number: #${res.queue_number}`);
        renderPage();
    } catch (err) { toast(err.message, 'error'); }
}

async function cancelMyQueue(queueId) {
    try {
        await API.cancelQueue(queueId);
        toast('Queue cancelled');
        renderPage();
    } catch (err) { toast(err.message, 'error'); }
}

/* ══════════════════════════════════════════════
   QUEUE BOARD — staff view to manage serving
   ══════════════════════════════════════════════ */
async function renderBoard(el) {
    el.innerHTML = `
        <div class="page-header">
            <h2>Queue Board</h2>
            <p>Call next, skip, or re-add customers.</p>
        </div>
        <div id="board-content">Loading...</div>
    `;
    try {
        const [svcData, qData] = await Promise.all([
            API.getServices(),
            API.getQueues({ date: today() })
        ]);
        const services = svcData.services;
        const queues   = qData.queues;

        let html = '<div class="queue-grid">';
        for (const svc of services) {
            const svcQ    = queues.filter(q => q.service_id == svc.service_id);
            const serving = svcQ.find(q => q.queue_status === 'serving');
            const waiting = svcQ.filter(q => q.queue_status === 'waiting');
            const skipped = svcQ.filter(q => q.queue_status === 'skipped');

            html += `<div class="card queue-card">
                <div class="service-label">${esc(svc.building_name)}</div>
                <div class="card-title">${esc(svc.service_name)}</div>
                <div class="now-serving-label">Now Serving</div>
                <div class="now-serving">${serving ? `#${serving.queue_number} <span class="text-sm" style="font-family:var(--font);color:var(--text-dim)">(${esc(serving.username)})</span>` : '—'}</div>
                <div class="mt-1 gap-row">
                    <button class="btn btn-sm btn-primary" onclick="callNext(${svc.service_id})">Next ▸</button>
                    ${serving ? `<button class="btn btn-sm" onclick="skipEntry(${serving.queue_id})">Skip</button>` : ''}
                </div>
                ${waiting.length ? `
                    <div class="mt-1 text-sm text-dim">Waiting (${waiting.length}):</div>
                    <div class="table-wrap"><table>
                        <thead><tr><th>#</th><th>User</th><th>Actions</th></tr></thead>
                        <tbody>
                        ${waiting.map(w => `<tr>
                            <td class="text-mono">${w.queue_number}</td>
                            <td>${esc(w.username)}</td>
                            <td class="gap-row">
                                <button class="btn btn-sm" onclick="skipEntry(${w.queue_id})">Skip</button>
                            </td>
                        </tr>`).join('')}
                        </tbody>
                    </table></div>` : ''}
                ${skipped.length ? `
                    <div class="mt-1 text-sm" style="color:var(--danger)">Skipped:</div>
                    <div class="table-wrap"><table>
                        <thead><tr><th>#</th><th>User</th><th>Actions</th></tr></thead>
                        <tbody>
                        ${skipped.map(s => `<tr>
                            <td class="text-mono">${s.queue_number}</td>
                            <td>${esc(s.username)}</td>
                            <td><button class="btn btn-sm btn-primary" onclick="readdEntry(${s.queue_id})">Re-add to Front</button></td>
                        </tr>`).join('')}
                        </tbody>
                    </table></div>` : ''}
            </div>`;
        }
        html += '</div>';
        document.getElementById('board-content').innerHTML = html;
    } catch (err) {
        document.getElementById('board-content').innerHTML = `<p class="text-dim">${esc(err.message)}</p>`;
    }
}

async function callNext(serviceId) {
    try {
        const res = await API.nextInQueue(serviceId);
        toast(res.message);
        renderPage();
    } catch (err) { toast(err.message, 'error'); }
}

async function skipEntry(queueId) {
    try {
        await API.skipQueue(queueId);
        toast('Skipped');
        renderPage();
    } catch (err) { toast(err.message, 'error'); }
}

async function readdEntry(queueId) {
    try {
        await API.readdQueue(queueId);
        toast('Re-added to front of queue');
        renderPage();
    } catch (err) { toast(err.message, 'error'); }
}

/* ══════════════════════════════════════════════
   QUEUES — full record table with filters, switch
   ══════════════════════════════════════════════ */
async function renderQueues(el) {
    el.innerHTML = `
        <div class="page-header">
            <h2>Queue Records</h2>
            <p>Filter, search, switch, and manage all queue entries.</p>
        </div>
        <div class="filter-bar" id="queue-filters"></div>
        <div class="card"><div class="table-wrap" id="queue-table">Loading...</div></div>
    `;

    const svcData = await API.getServices();
    const services = svcData.services;

    // Build filters
    document.getElementById('queue-filters').innerHTML = `
        <div class="form-group">
            <label>Date</label>
            <input type="date" id="flt-date" value="${today()}">
        </div>
        <div class="form-group">
            <label>Service</label>
            <select id="flt-service">
                <option value="">All</option>
                ${services.map(s => `<option value="${s.service_id}">${esc(s.service_name)}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Status</label>
            <select id="flt-status">
                <option value="">All</option>
                <option value="waiting">Waiting</option>
                <option value="serving">Serving</option>
                <option value="served">Served</option>
                <option value="skipped">Skipped</option>
                <option value="cancelled">Cancelled</option>
            </select>
        </div>
        <button class="btn btn-primary" onclick="loadQueueTable()">Filter</button>
    `;
    loadQueueTable();
}

async function loadQueueTable() {
    const params = {};
    const d = document.getElementById('flt-date').value;
    const s = document.getElementById('flt-service').value;
    const st = document.getElementById('flt-status').value;
    if (d) params.date = d;
    if (s) params.service_id = s;
    if (st) params.status = st;

    try {
        const data = await API.getQueues(params);
        const qs = data.queues;
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isStaff = currentUser && ['admin','staff'].includes(currentUser.role);

        let html = `<table>
            <thead><tr>
                <th>ID</th><th>#</th><th>Service</th><th>User</th>
                <th>Date</th><th>Status</th><th>Actions</th>
            </tr></thead><tbody>`;

        for (const q of qs) {
            const waitingQ = qs.filter(x => x.service_id === q.service_id && x.queue_status === 'waiting' && x.queue_id !== q.queue_id);
            const isOwnRow = currentUser && q.user_id == currentUser.user_id;
            // Staff/admin: button on any waiting row opens the two-picker. Customer: button on OTHER users' rows requests a switch with them.
            const myWaiting = (currentUser && !isStaff)
                ? qs.find(x => x.service_id === q.service_id && x.queue_status === 'waiting' && x.user_id == currentUser.user_id)
                : null;
            const showSwitch = q.queue_status === 'waiting' && (
                (isStaff && waitingQ.length > 0) ||
                (!isStaff && !isOwnRow && myWaiting)
            );
            const switchOnClick = isStaff
                ? `openSwitch(${q.queue_id}, ${q.service_id})`
                : `requestSwitchWith(${myWaiting ? myWaiting.queue_id : 0}, ${q.queue_id}, '${esc(q.username)}', ${q.queue_number})`;
            const switchLabel = isStaff ? 'Switch' : 'Request Switch';

            html += `<tr>
                <td class="text-dim">${q.queue_id}</td>
                <td class="text-mono">${q.queue_number}</td>
                <td>${esc(q.service_name)}</td>
                <td>${esc(q.username)}</td>
                <td>${q.queue_date}</td>
                <td><span class="badge badge-${q.queue_status}">${q.queue_status}</span></td>
                <td class="gap-row">
                    ${showSwitch ? `<button class="btn btn-sm" onclick="${switchOnClick}">${switchLabel}</button>` : ''}
                    ${q.queue_status === 'skipped' && isStaff
                        ? `<button class="btn btn-sm btn-primary" onclick="readdEntry(${q.queue_id})">Re-add</button>` : ''}
                    ${isAdmin
                        ? `<button class="btn btn-sm btn-danger" onclick="deleteQueueEntry(${q.queue_id})">Delete</button>` : ''}
                </td>
            </tr>`;
        }
        html += '</tbody></table>';
        if (!qs.length) html = '<p class="text-dim text-sm" style="padding:1rem">No records found.</p>';
        document.getElementById('queue-table').innerHTML = html;
    } catch (err) {
        document.getElementById('queue-table').innerHTML = `<p class="text-dim">${esc(err.message)}</p>`;
    }
}

async function openSwitch(queueId, serviceId) {
    try {
        const data = await API.getQueues({ date: today(), service_id: serviceId, status: 'waiting' });
        const others = data.queues.filter(q => q.queue_id !== queueId);
        if (!others.length) { toast('No one else to switch with', 'error'); return; }

        const isStaff = currentUser && ['staff', 'admin'].includes(currentUser.role);
        const opts = others.map(q => `<option value="${q.queue_id}">#${q.queue_number} — ${esc(q.username)}</option>`).join('');
        const helpText = isStaff
            ? '<p class="text-sm text-dim">Staff/admin: this swap is immediate.</p>'
            : '<p class="text-sm text-dim">A request will be sent. The other party must accept before positions swap.</p>';

        openModal(isStaff ? 'Switch Positions' : 'Request Switch', `
            <div class="form-group">
                <label>Switch with</label>
                <select id="switch-target">${opts}</select>
            </div>
            ${helpText}
        `, async (overlay) => {
            const target = parseInt(overlay.querySelector('#switch-target').value);
            try {
                if (isStaff) {
                    await API.switchQueue(queueId, target);
                    toast('Positions switched!');
                } else {
                    await API.requestSwitch(queueId, target);
                    toast('Switch request sent — waiting for response.');
                }
                renderPage();
            } catch (err) { toast(err.message, 'error'); }
        });
    } catch (err) { toast(err.message, 'error'); }
}

function requestSwitchWith(myQueueId, targetQueueId, targetUsername, targetQueueNumber) {
    if (!myQueueId) { toast('You need a waiting entry in this service first', 'error'); return; }
    openModal('Request Switch', `
        <p>Send a switch request to <strong>${esc(targetUsername)}</strong> (currently #${targetQueueNumber})?</p>
        <p class="text-sm text-dim mt-1">They must accept before your positions swap.</p>
    `, async () => {
        try {
            await API.requestSwitch(myQueueId, targetQueueId);
            toast('Switch request sent — waiting for response.');
        } catch (err) { toast(err.message, 'error'); }
    });
}

/* ══════════════════════════════════════════════
   SWITCH-REQUEST INBOX (consent-based switching)
   ══════════════════════════════════════════════ */
let _lastIncomingIds = new Set();

async function openSwitchInbox() {
    try {
        const data = await API.mySwitchRequests();
        const incoming = data.incoming || [];
        const outgoing = (data.outgoing || []).filter(r => r.status === 'pending');

        const incomingHtml = incoming.length ? `
            <h4 class="mt-1">Incoming requests</h4>
            <div class="table-wrap"><table>
                <thead><tr><th>From</th><th>Service</th><th>Their #</th><th>Your #</th><th>Actions</th></tr></thead>
                <tbody>
                ${incoming.map(r => `<tr>
                    <td>${esc(r.from_username)}</td>
                    <td>${esc(r.service_name)}</td>
                    <td class="text-mono">#${r.from_queue_number}</td>
                    <td class="text-mono">#${r.to_queue_number}</td>
                    <td class="gap-row">
                        <button class="btn btn-sm btn-primary" onclick="respondSwitchReq(${r.request_id}, 'accept')">Accept</button>
                        <button class="btn btn-sm btn-danger" onclick="respondSwitchReq(${r.request_id}, 'reject')">Reject</button>
                    </td>
                </tr>`).join('')}
                </tbody>
            </table></div>` : '<p class="text-dim text-sm">No incoming requests.</p>';

        const outgoingHtml = outgoing.length ? `
            <h4 class="mt-1">Your pending requests</h4>
            <div class="table-wrap"><table>
                <thead><tr><th>To</th><th>Service</th><th>Your #</th><th>Their #</th><th>Actions</th></tr></thead>
                <tbody>
                ${outgoing.map(r => `<tr>
                    <td>${esc(r.to_username)}</td>
                    <td>${esc(r.service_name)}</td>
                    <td class="text-mono">#${r.from_queue_number}</td>
                    <td class="text-mono">#${r.to_queue_number}</td>
                    <td><button class="btn btn-sm" onclick="cancelSwitchReq(${r.request_id})">Cancel</button></td>
                </tr>`).join('')}
                </tbody>
            </table></div>` : '';

        openModal('Switch Requests', incomingHtml + outgoingHtml, null);

        // Mark currently-shown incoming as seen so we don't re-toast them
        _lastIncomingIds = new Set(incoming.map(r => r.request_id));
        updateInboxBadge(incoming.length);
    } catch (err) { toast(err.message, 'error'); }
}

async function respondSwitchReq(requestId, decision) {
    try {
        const res = await API.respondSwitch(requestId, decision);
        toast(res.message || (decision === 'accept' ? 'Accepted' : 'Rejected'));
        document.querySelector('.modal-overlay')?.remove();
        await pollSwitchRequests();
        renderPage();
    } catch (err) { toast(err.message, 'error'); }
}

async function cancelSwitchReq(requestId) {
    try {
        await API.cancelSwitch(requestId);
        toast('Request cancelled');
        document.querySelector('.modal-overlay')?.remove();
        await pollSwitchRequests();
    } catch (err) { toast(err.message, 'error'); }
}

function updateInboxBadge(count) {
    const badge = document.getElementById('inbox-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = String(count);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

async function pollSwitchRequests() {
    if (!currentUser) return;
    try {
        const data = await API.mySwitchRequests();
        const incoming = data.incoming || [];
        updateInboxBadge(incoming.length);

        const currentIds = new Set(incoming.map(r => r.request_id));
        for (const r of incoming) {
            if (!_lastIncomingIds.has(r.request_id)) {
                toast(`${r.from_username} wants to switch positions with you`);
            }
        }
        _lastIncomingIds = currentIds;
    } catch (_) { /* silent during polling */ }
}

let _switchPollTimer = null;
function startSwitchPolling() {
    stopSwitchPolling();
    pollSwitchRequests();
    _switchPollTimer = setInterval(pollSwitchRequests, 12000);
}
function stopSwitchPolling() {
    if (_switchPollTimer) clearInterval(_switchPollTimer);
    _switchPollTimer = null;
    _lastIncomingIds = new Set();
    updateInboxBadge(0);
}

async function deleteQueueEntry(queueId) {
    if (!confirm('Delete this queue record permanently?')) return;
    try {
        await API.deleteQueue(queueId);
        toast('Deleted');
        loadQueueTable();
    } catch (err) { toast(err.message, 'error'); }
}

/* ══════════════════════════════════════════════
   SERVICES — CRUD
   ══════════════════════════════════════════════ */
async function renderServices(el) {
    el.innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center">
            <div><h2>Services</h2><p>Manage office services and their locations.</p></div>
            ${currentUser.role === 'admin' ? '<button class="btn btn-primary" onclick="openServiceForm()">+ Add Service</button>' : ''}
        </div>
        <div class="card"><div class="table-wrap" id="svc-table">Loading...</div></div>
    `;
    try {
        const data = await API.getServices();
        const isAdmin = currentUser.role === 'admin';
        let html = `<table>
            <thead><tr><th>ID</th><th>Name</th><th>Description</th><th>Location</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
            <tbody>`;
        for (const s of data.services) {
            html += `<tr>
                <td class="text-dim">${s.service_id}</td>
                <td>${esc(s.service_name)}</td>
                <td class="text-dim">${esc(s.description || '')}</td>
                <td>${esc(s.building_name)}</td>
                ${isAdmin ? `<td class="gap-row">
                    <button class="btn btn-sm" onclick="openServiceForm(${s.service_id}, '${esc(s.service_name)}', '${esc(s.description || '')}', ${s.location_id})">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteService(${s.service_id})">Delete</button>
                </td>` : ''}
            </tr>`;
        }
        html += '</tbody></table>';
        document.getElementById('svc-table').innerHTML = html;
    } catch (err) {
        document.getElementById('svc-table').innerHTML = `<p class="text-dim">${esc(err.message)}</p>`;
    }
}

async function openServiceForm(id, name, desc, locId) {
    const locs = (await API.getLocations()).locations;
    const locOpts = locs.map(l =>
        `<option value="${l.location_id}" ${l.location_id == locId ? 'selected' : ''}>${esc(l.building_name)}</option>`
    ).join('');

    openModal(id ? 'Edit Service' : 'Add Service', `
        <div class="form-group"><label>Name</label><input id="svc-name" value="${esc(name || '')}"></div>
        <div class="form-group"><label>Description</label><textarea id="svc-desc">${esc(desc || '')}</textarea></div>
        <div class="form-group"><label>Location</label><select id="svc-loc">${locOpts}</select></div>
    `, async (overlay) => {
        const payload = {
            service_name: overlay.querySelector('#svc-name').value,
            description:  overlay.querySelector('#svc-desc').value,
            location_id:  parseInt(overlay.querySelector('#svc-loc').value),
        };
        try {
            if (id) { payload.service_id = id; await API.updateService(payload); }
            else { await API.createService(payload); }
            toast(id ? 'Updated' : 'Created');
            renderPage();
        } catch (err) { toast(err.message, 'error'); }
    });
}

async function deleteService(id) {
    if (!confirm('Delete this service? All queue records will be lost.')) return;
    try { await API.deleteService(id); toast('Deleted'); renderPage(); }
    catch (err) { toast(err.message, 'error'); }
}

/* ══════════════════════════════════════════════
   STAFF — CRUD
   ══════════════════════════════════════════════ */
async function renderStaffPage(el) {
    el.innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center">
            <div><h2>Staff</h2><p>Manage staff assignments to services.</p></div>
            ${currentUser.role === 'admin' ? '<button class="btn btn-primary" onclick="openStaffForm()">+ Assign Staff</button>' : ''}
        </div>
        <div class="card"><div class="table-wrap" id="staff-table">Loading...</div></div>
    `;
    try {
        const data = await API.getStaff();
        const isAdmin = currentUser.role === 'admin';
        let html = `<table>
            <thead><tr><th>ID</th><th>User</th><th>Service</th><th>Role</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
            <tbody>`;
        for (const s of data.staff) {
            html += `<tr>
                <td class="text-dim">${s.staff_id}</td>
                <td>${esc(s.username)}</td>
                <td>${esc(s.service_name)}</td>
                <td>${esc(s.staff_role)}</td>
                ${isAdmin ? `<td class="gap-row">
                    <button class="btn btn-sm" onclick="openStaffForm(${s.staff_id}, ${s.user_id}, ${s.assigned_service_id}, '${esc(s.staff_role)}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStaffEntry(${s.staff_id})">Delete</button>
                </td>` : ''}
            </tr>`;
        }
        html += '</tbody></table>';
        document.getElementById('staff-table').innerHTML = html;
    } catch (err) {
        document.getElementById('staff-table').innerHTML = `<p class="text-dim">${esc(err.message)}</p>`;
    }
}

async function openStaffForm(staffId, userId, serviceId, role) {
    const [userData, svcData] = await Promise.all([API.getUsers(), API.getServices()]);
    const userOpts = userData.users.map(u =>
        `<option value="${u.user_id}" ${u.user_id == userId ? 'selected' : ''}>${esc(u.username)} (${u.role})</option>`
    ).join('');
    const svcOpts = svcData.services.map(s =>
        `<option value="${s.service_id}" ${s.service_id == serviceId ? 'selected' : ''}>${esc(s.service_name)}</option>`
    ).join('');

    openModal(staffId ? 'Edit Staff' : 'Assign Staff', `
        <div class="form-group"><label>User</label><select id="st-user">${userOpts}</select></div>
        <div class="form-group"><label>Service</label><select id="st-svc">${svcOpts}</select></div>
        <div class="form-group"><label>Role</label><input id="st-role" value="${esc(role || '')}"></div>
    `, async (overlay) => {
        const payload = {
            user_id: parseInt(overlay.querySelector('#st-user').value),
            assigned_service_id: parseInt(overlay.querySelector('#st-svc').value),
            staff_role: overlay.querySelector('#st-role').value,
        };
        try {
            if (staffId) { payload.staff_id = staffId; await API.updateStaff(payload); }
            else { await API.createStaff(payload); }
            toast(staffId ? 'Updated' : 'Assigned');
            renderPage();
        } catch (err) { toast(err.message, 'error'); }
    });
}

async function deleteStaffEntry(id) {
    if (!confirm('Remove this staff assignment?')) return;
    try { await API.deleteStaff(id); toast('Removed'); renderPage(); }
    catch (err) { toast(err.message, 'error'); }
}

/* ══════════════════════════════════════════════
   USERS — CRUD (admin only)
   ══════════════════════════════════════════════ */
async function renderUsers(el) {
    el.innerHTML = `
        <div class="page-header" style="display:flex;justify-content:space-between;align-items:center">
            <div><h2>Users</h2><p>Manage system users and roles.</p></div>
            <button class="btn btn-primary" onclick="openUserForm()">+ Add User</button>
        </div>
        <div class="card"><div class="table-wrap" id="user-table">Loading...</div></div>
    `;
    try {
        const data = await API.getUsers();
        let html = `<table>
            <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>`;
        for (const u of data.users) {
            html += `<tr>
                <td class="text-dim">${u.user_id}</td>
                <td>${esc(u.username)}</td>
                <td><span class="badge badge-${u.role === 'admin' ? 'serving' : u.role === 'staff' ? 'waiting' : 'served'}">${u.role}</span></td>
                <td class="text-dim">${u.created_at}</td>
                <td class="gap-row">
                    <button class="btn btn-sm" onclick="openUserForm(${u.user_id}, '${esc(u.username)}', '${u.role}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUserEntry(${u.user_id})">Delete</button>
                </td>
            </tr>`;
        }
        html += '</tbody></table>';
        document.getElementById('user-table').innerHTML = html;
    } catch (err) {
        document.getElementById('user-table').innerHTML = `<p class="text-dim">${esc(err.message)}</p>`;
    }
}

function openUserForm(id, username, role) {
    openModal(id ? 'Edit User' : 'Add User', `
        <div class="form-group"><label>Username</label><input id="u-name" value="${esc(username || '')}"></div>
        <div class="form-group"><label>Password ${id ? '(leave blank to keep)' : ''}</label><input type="password" id="u-pass"></div>
        <div class="form-group"><label>Role</label>
            <select id="u-role">
                <option value="customer" ${role === 'customer' ? 'selected' : ''}>Customer</option>
                <option value="staff" ${role === 'staff' ? 'selected' : ''}>Staff</option>
                <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        </div>
    `, async (overlay) => {
        const payload = {
            username: overlay.querySelector('#u-name').value,
            role:     overlay.querySelector('#u-role').value,
        };
        const pw = overlay.querySelector('#u-pass').value;
        if (pw) payload.password = pw;
        try {
            if (id) { payload.user_id = id; await API.updateUser(payload); }
            else {
                if (!pw) { toast('Password required', 'error'); return; }
                payload.password = pw;
                await API.createUser(payload);
            }
            toast(id ? 'Updated' : 'Created');
            renderPage();
        } catch (err) { toast(err.message, 'error'); }
    });
}

async function deleteUserEntry(id) {
    if (!confirm('Delete this user? This will remove all their queue records.')) return;
    try { await API.deleteUser(id); toast('Deleted'); renderPage(); }
    catch (err) { toast(err.message, 'error'); }
}

/* ── HELPERS ── */
function today() { return new Date().toISOString().slice(0, 10); }
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
