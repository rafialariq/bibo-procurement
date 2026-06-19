const USERS = [
  { id: "admin", name: "Admin", title: "System Administrator", role: "Admin" },
  { id: "novi", name: "Novi Safitri", title: "Specialist Coordinator", role: "Requester" },
  { id: "nabila", name: "Nabila Yasmindira", title: "Monev Specialist", role: "Requester" },
  { id: "dana", name: "Dana", title: "Finance Admin", role: "Approver", requester: true, approvalLevel: 2 },
  { id: "dili", name: "Dili", title: "Finance Maker", role: "Approver", requester: true, approvalLevel: 3 },
  { id: "ikhsan", name: "Ikhsan", title: "Finance Approval", role: "Approver", requester: true, approvalLevel: 4 },
  { id: "johana", name: "Johana Ernawati", title: "Team Leader", role: "Approver", requester: true, approvalLevel: 1 }
];

const APPROVERS = ["johana", "dana", "dili", "ikhsan"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const STATUS = ["Draft", "Submitted", "Pending Approval", "Approved", "Rejected", "Revision"];

const DEFAULT_STATE = {
  activeUserId: null,
  page: "dashboard",
  requests: [],
  departments: [],
  categories: [],
  notifications: [],
  filters: { q: "", status: "All" },
  editingId: null,
  sidebarOpen: false
};

let state = loadState();
let toastTimer;

function loadState() {
  const saved = localStorage.getItem("bibo-obi-sowi-state");
  if (!saved) return structuredClone(DEFAULT_STATE);
  return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(saved) };
}

function saveState() {
  const safe = { ...state, sidebarOpen: false };
  localStorage.setItem("bibo-obi-sowi-state", JSON.stringify(safe));
}

function currentUser() {
  return USERS.find((user) => user.id === state.activeUserId);
}

function canCreate(user) {
  return user?.role === "Requester" || user?.requester || user?.role === "Admin";
}

function canAdmin(user) {
  return user?.role === "Admin";
}

function canApprove(user) {
  return user?.role === "Approver";
}

function formatMoney(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes = 0) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function attachmentOf(request) {
  if (request.attachment?.dataUrl) return request.attachment;
  if (request.attachmentName) return { name: request.attachmentName, type: "", size: 0, dataUrl: "" };
  return null;
}

function statusClass(status) {
  return `status-${status.split(" ")[0]}`;
}

function requestNumber() {
  const next = state.requests.length + 1;
  return `BOS-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
}

function approvalStep(request) {
  return APPROVERS[request.currentLevel - 1] || null;
}

function notify(message, requestId) {
  state.notifications.unshift({
    id: crypto.randomUUID(),
    message,
    requestId,
    date: new Date().toISOString()
  });
  showToast(message);
}

function showToast(message) {
  clearTimeout(toastTimer);
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="toast">${escapeHtml(message)}</div>`);
  toastTimer = setTimeout(() => document.querySelector(".toast")?.remove(), 3200);
}

function setPage(page) {
  state.page = page;
  state.editingId = null;
  state.sidebarOpen = false;
  saveState();
  render();
}

function login(userId) {
  state.activeUserId = userId;
  state.page = "dashboard";
  saveState();
  render();
}

function logout() {
  state.activeUserId = null;
  saveState();
  render();
}

function resetDemoData() {
  if (!confirm("Kosongkan seluruh request, master departemen, kategori, dan notifikasi?")) return;
  state = { ...structuredClone(DEFAULT_STATE), activeUserId: state.activeUserId };
  saveState();
  render();
}

function deleteRequest(id) {
  const user = currentUser();
  if (!canAdmin(user)) {
    showToast("Hanya Admin yang dapat menghapus riwayat pengajuan.");
    return;
  }

  const request = state.requests.find((item) => item.id === id);
  if (!request) return;
  if (!confirm(`Hapus riwayat pengajuan ${request.number}? Data ini tidak dapat dikembalikan.`)) return;

  state.requests = state.requests.filter((item) => item.id !== id);
  state.notifications = state.notifications.filter((item) => item.requestId !== id);
  if (state.modal?.id === id) state.modal = null;
  saveState();
  render();
  showToast(`${request.number} berhasil dihapus.`);
}

function navItems(user) {
  const items = [
    ["dashboard", "Dashboard"],
    ...(canCreate(user) ? [["request", "Budget Request"]] : []),
    ...(canApprove(user) ? [["approval", "Approval"]] : []),
    ["history", "Riwayat"],
    ...(canAdmin(user) ? [["admin", "Admin"]] : []),
    ["notifications", "Notifikasi"]
  ];
  return items;
}

function render() {
  const app = document.querySelector("#app");
  const user = currentUser();
  if (!user) {
    app.innerHTML = renderLogin();
    return;
  }

  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(user)}
      <main class="main">
        ${renderTopbar(user)}
        <section class="content">
          <div class="print-header">
            <h1>Bibo Obi Sowi Platform</h1>
            <p>Export data pengajuan anggaran</p>
          </div>
          ${renderPage(user)}
        </section>
      </main>
    </div>
    ${renderModal()}
  `;
}

function renderLogin() {
  return `
    <section class="auth-shell">
      <div class="auth-brand">
        <div class="brand-mark">BO</div>
        <div>
          <h1>Bibo Obi Sowi Platform</h1>
          <p>Budget Approval Platform untuk mengelola pengajuan anggaran, dokumen pendukung, approval berjenjang, dan riwayat keputusan secara digital.</p>
        </div>
        <div class="auth-foot">
          <span>Clean data</span>
          <span>Approval berjenjang</span>
          <span>Responsive</span>
        </div>
      </div>
      <div class="auth-panel">
        <form class="login-box" onsubmit="event.preventDefault(); login(document.querySelector('#loginUser').value)">
          <h2>Masuk ke platform</h2>
          <p class="helper">Pilih akun untuk simulasi role. Data request masih kosong dan siap digunakan.</p>
          <div class="field">
            <label for="loginUser">User</label>
            <select id="loginUser">
              ${USERS.map((user) => `<option value="${user.id}">${user.name} - ${user.title} (${user.role}${user.requester ? " + Requester" : ""})</option>`).join("")}
            </select>
          </div>
          <div class="login-actions">
            <button class="btn primary" type="submit">Login</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderSidebar(user) {
  return `
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      <div class="side-top">
        <span class="brand-mark">BO</span>
        <div>
          <strong>Bibo Obi Sowi</strong>
          <small>Budget Approval</small>
        </div>
      </div>
      <nav class="nav">
        ${navItems(user)
          .map(([id, label]) => `<button class="btn ${state.page === id ? "active" : ""}" onclick="setPage('${id}')">${label}</button>`)
          .join("")}
      </nav>
      <div class="side-bottom">
        <div class="user-card">
          <div>
            <strong>${escapeHtml(user.name)}</strong>
            <small>${escapeHtml(user.title)} · ${escapeHtml(user.role)}</small>
          </div>
          <button class="btn ghost" onclick="logout()">Logout</button>
        </div>
      </div>
    </aside>
  `;
}

function renderTopbar(user) {
  const unread = state.notifications.length;
  return `
    <header class="topbar">
      <button class="btn ghost mobile-menu" onclick="state.sidebarOpen = !state.sidebarOpen; render()">Menu</button>
      <div>
        <h1>${pageTitle()}</h1>
        <p>${escapeHtml(user.name)} · ${escapeHtml(user.title)}</p>
      </div>
      <button class="btn ghost" onclick="setPage('notifications')">Notifikasi ${unread ? `(${unread})` : ""}</button>
    </header>
  `;
}

function pageTitle() {
  return {
    dashboard: "Dashboard",
    request: state.editingId ? "Edit Budget Request" : "Budget Request",
    approval: "Approval",
    history: "Riwayat",
    admin: "Admin",
    notifications: "Notifikasi"
  }[state.page];
}

function renderPage(user) {
  if (state.page === "dashboard") return renderDashboard(user);
  if (state.page === "request") return renderRequestForm(user);
  if (state.page === "approval") return renderApproval(user);
  if (state.page === "history") return renderHistory(user);
  if (state.page === "admin") return renderAdmin();
  if (state.page === "notifications") return renderNotifications();
  return renderDashboard(user);
}

function visibleRequests(user) {
  if (canAdmin(user) || canApprove(user)) return state.requests;
  return state.requests.filter((request) => request.requesterId === user.id);
}

function filteredRequests(user) {
  const q = state.filters.q.toLowerCase();
  return visibleRequests(user).filter((request) => {
    const text = [request.number, request.title, request.requesterName, request.department, request.category, request.status].join(" ").toLowerCase();
    const statusOk = state.filters.status === "All" || request.status === state.filters.status;
    return text.includes(q) && statusOk;
  });
}

function renderDashboard(user) {
  const rows = visibleRequests(user);
  const totalBudget = rows.reduce((sum, request) => sum + Number(request.amount || 0), 0);
  const pending = rows.filter((request) => request.status === "Pending Approval" || request.status === "Submitted").length;
  const approved = rows.filter((request) => request.status === "Approved").length;
  const rejected = rows.filter((request) => request.status === "Rejected").length;
  const monthly = Array.from({ length: 12 }, (_, idx) => rows.filter((request) => new Date(request.date).getMonth() === idx).length);
  const max = Math.max(1, ...monthly);

  return `
    <div class="metrics">
      ${metric("Total Pengajuan", rows.length)}
      ${metric("Pending Approval", pending)}
      ${metric("Approved", approved)}
      ${metric("Rejected", rejected)}
      ${metric("Total Nominal Budget", formatMoney(totalBudget))}
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-title">
          <h2>Grafik Pengajuan per Bulan</h2>
        </div>
        <div class="chart" aria-label="Grafik pengajuan per bulan">
          ${monthly.map((value) => `<div class="bar" style="height:${Math.max(8, (value / max) * 100)}%">${value || ""}</div>`).join("")}
        </div>
        <div class="bar-labels">${MONTHS.map((month) => `<span>${month}</span>`).join("")}</div>
      </div>
      <div class="panel">
        <div class="panel-title">
          <h2>Ringkasan Approval</h2>
          ${canCreate(user) ? `<button class="btn primary" onclick="setPage('request')">Request Baru</button>` : ""}
        </div>
        ${rows.length ? renderMiniTimeline(rows.slice(0, 5)) : emptyState("Belum ada pengajuan", "Data masih kosong dan siap digunakan untuk proses baru.")}
      </div>
    </div>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderMiniTimeline(rows) {
  return `
    <div class="timeline">
      ${rows
        .map(
          (request) => `
            <div class="timeline-item">
              <strong>${escapeHtml(request.title)}</strong>
              <small>${escapeHtml(request.number)} · ${escapeHtml(request.status)} · ${formatMoney(request.amount)}</small>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderRequestForm(user) {
  if (!canCreate(user)) return emptyState("Akses tidak tersedia", "Role Anda tidak dapat membuat budget request.");
  const request = state.requests.find((item) => item.id === state.editingId);
  const canEdit = !request || request.requesterId === user.id || canAdmin(user);
  if (!canEdit) return emptyState("Tidak dapat mengedit", "Request ini bukan milik Anda.");

  const number = request?.number || requestNumber();
  const isRevision = request?.status === "Revision";
  const requesterOptions = USERS.filter((item) => item.role === "Requester" || item.requester || item.role === "Admin");
  return `
    <form class="form-block" onsubmit="event.preventDefault(); saveRequest(event)">
      <div class="section-title">
        <div>
          <h2>${request ? "Edit Pengajuan" : "Buat Pengajuan Budget"}</h2>
          <p class="helper">${isRevision ? "Perbarui data dan lampiran, lalu kirim revisi kembali ke approver yang meminta revisi." : "Pengajuan dapat disimpan sebagai Draft atau langsung Submitted ke approval berjenjang."}</p>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Nomor Request</label>
          <input name="number" value="${number}" readonly />
        </div>
        <div class="field">
          <label>Tanggal</label>
          <input type="date" name="date" value="${request?.date || today()}" required />
        </div>
        <div class="field">
          <label>Nama Requester</label>
          <select name="requesterId" required ${user.role !== "Admin" ? "disabled" : ""}>
            ${requesterOptions
              .map((item) => `<option value="${item.id}" ${item.id === (request?.requesterId || user.id) ? "selected" : ""}>${item.name}</option>`)
              .join("")}
          </select>
        </div>
        <div class="field">
          <label>Departemen</label>
          ${renderSelectOrInput("department", state.departments, request?.department)}
        </div>
        <div class="field">
          <label>Kategori Budget</label>
          ${renderSelectOrInput("category", state.categories, request?.category)}
        </div>
        <div class="field">
          <label>Nominal Budget</label>
          <input type="number" name="amount" min="0" value="${request?.amount || ""}" placeholder="0" required />
        </div>
        <div class="field full">
          <label>Judul Pengajuan</label>
          <input name="title" value="${escapeHtml(request?.title || "")}" placeholder="Contoh: Operasional Program Bulanan" required />
        </div>
        <div class="field full">
          <label>Deskripsi</label>
          <textarea name="description" placeholder="Tuliskan kebutuhan dan konteks pengajuan" required>${escapeHtml(request?.description || "")}</textarea>
        </div>
        <div class="field full">
          <label>Lampiran</label>
          <input type="file" name="attachment" />
          <p class="helper">${request?.attachmentName ? `Lampiran saat ini: ${escapeHtml(request.attachmentName)}. Pilih file baru untuk mengganti.` : "Lampiran akan tersimpan di browser dan dapat dilihat dari Detail."}</p>
        </div>
        <div class="field full">
          <label>Catatan Approval</label>
          <textarea name="approvalNote" placeholder="Opsional">${escapeHtml(request?.approvalNote || "")}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn ghost" type="button" onclick="setPage('history')">Batal</button>
        <div class="row-actions">
          ${isRevision ? "" : `<button class="btn ghost" name="intent" value="Draft" type="submit">Simpan Draft</button>`}
          <button class="btn primary" name="intent" value="Submitted" type="submit">${isRevision ? "Kirim Revisi" : "Submit"}</button>
        </div>
      </div>
    </form>
  `;
}

function renderSelectOrInput(name, values, current) {
  if (!values.length) {
    return `<input name="${name}" value="${escapeHtml(current || "")}" placeholder="Isi ${name === "department" ? "departemen" : "kategori"}" required />`;
  }
  return `
    <select name="${name}" required>
      <option value="">Pilih</option>
      ${values.map((value) => `<option ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
    </select>
  `;
}

async function saveRequest(event) {
  const form = event.target;
  const submitter = event.submitter?.value || "Draft";
  const data = new FormData(form);
  const active = currentUser();
  const requester = USERS.find((user) => user.id === (data.get("requesterId") || active.id));
  const file = form.attachment.files[0];
  const existing = state.requests.find((item) => item.id === state.editingId);
  const status = submitter === "Submitted" ? "Pending Approval" : existing?.status === "Revision" ? "Revision" : "Draft";
  const attachment = (await readFileAsDataUrl(file)) || existing?.attachment || null;
  const isRevisionResubmit = existing?.status === "Revision" && status === "Pending Approval";
  const request = {
    id: existing?.id || crypto.randomUUID(),
    number: data.get("number"),
    date: data.get("date"),
    requesterId: requester.id,
    requesterName: requester.name,
    department: data.get("department"),
    category: data.get("category"),
    title: data.get("title"),
    description: data.get("description"),
    amount: Number(data.get("amount")),
    attachment,
    attachmentName: attachment?.name || existing?.attachmentName || "",
    approvalNote: data.get("approvalNote"),
    status,
    currentLevel: status === "Pending Approval" ? existing?.currentLevel || 1 : existing?.currentLevel || 1,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [
      ...(existing?.history || []),
      {
        date: new Date().toISOString(),
        actor: active.name,
        action: isRevisionResubmit ? "Revision resubmitted" : existing ? `Updated as ${status}` : `Created as ${status}`,
        comment: data.get("approvalNote") || "-"
      }
    ]
  };

  if (existing) {
    if (!["Draft", "Revision"].includes(existing.status) && !canAdmin(active)) {
      showToast("Hanya Draft atau Revision yang dapat diedit.");
      return;
    }
    state.requests = state.requests.map((item) => (item.id === existing.id ? request : item));
  } else {
    state.requests.push(request);
  }

  if (status === "Pending Approval") {
    const approverName = USERS.find((u) => u.id === approvalStep(request))?.name;
    notify(isRevisionResubmit ? `${request.number} revisi dikirim kembali ke approval ${approverName}.` : `${request.number} dikirim ke approval ${approverName}.`, request.id);
  }
  state.editingId = null;
  state.page = "history";
  saveState();
  render();
}

function renderApproval(user) {
  if (!canApprove(user)) return emptyState("Akses approval tidak tersedia", "Role Anda tidak memiliki antrean approval.");
  const queue = state.requests.filter((request) => request.status === "Pending Approval" && approvalStep(request) === user.id);
  return `
    <div class="section-title">
      <div>
        <h2>Daftar Pengajuan yang Perlu Disetujui</h2>
        <p class="helper">${queue.length} pengajuan menunggu keputusan Anda.</p>
      </div>
    </div>
    ${queue.length ? renderTable(queue, { approval: true }) : emptyState("Tidak ada pending approval", "Semua pengajuan untuk level Anda sudah diproses.")}
  `;
}

function renderHistory(user) {
  const rows = filteredRequests(user);
  return `
    <div class="table-tools">
      <div class="filters">
        <input placeholder="Cari request, requester, departemen..." value="${escapeHtml(state.filters.q)}" oninput="state.filters.q=this.value; saveState(); render()" />
        <select onchange="state.filters.status=this.value; saveState(); render()">
          <option value="All">Semua Status</option>
          ${STATUS.map((status) => `<option ${state.filters.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
      <div class="row-actions">
        <button class="btn ghost" onclick="exportExcel()">Export Excel</button>
        <button class="btn ghost" onclick="window.print()">Export PDF</button>
      </div>
    </div>
    ${rows.length ? renderTable(rows, { history: true }) : emptyState("Belum ada histori", "Data pengajuan masih kosong atau tidak sesuai filter.")}
  `;
}

function renderTable(rows, options = {}) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>No. Request</th>
            <th>Tanggal</th>
            <th>Requester</th>
            <th>Departemen</th>
            <th>Kategori</th>
            <th>Judul</th>
            <th>Nominal</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (request) => `
                <tr>
                  <td><strong>${escapeHtml(request.number)}</strong></td>
                  <td>${escapeHtml(request.date)}</td>
                  <td>${escapeHtml(request.requesterName)}</td>
                  <td>${escapeHtml(request.department)}</td>
                  <td>${escapeHtml(request.category)}</td>
                  <td>${escapeHtml(request.title)}<br>${renderAttachmentLine(request)}</td>
                  <td>${formatMoney(request.amount)}</td>
                  <td><span class="badge ${statusClass(request.status)}">${escapeHtml(request.status)}</span></td>
                  <td>${renderActions(request, options)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderActions(request, options) {
  const user = currentUser();
  if (options.approval) {
    return `
      <div class="row-actions">
        <button class="btn ghost small-btn" onclick="viewDetail('${request.id}')">Detail</button>
        <button class="btn success small-btn" onclick="openDecision('${request.id}', 'approve')">Approve</button>
        <button class="btn danger small-btn" onclick="openDecision('${request.id}', 'reject')">Reject</button>
        <button class="btn warn small-btn" onclick="openDecision('${request.id}', 'revision')">Request Revision</button>
      </div>
    `;
  }

  const editable = (request.requesterId === user.id || canAdmin(user)) && ["Draft", "Revision"].includes(request.status);
  return `
    <div class="row-actions">
      <button class="btn ghost small-btn" onclick="viewDetail('${request.id}')">Detail</button>
      ${editable ? `<button class="btn ghost small-btn" onclick="state.editingId='${request.id}'; state.page='request'; render()">Edit</button>` : ""}
      ${canAdmin(user) ? `<button class="btn danger small-btn" onclick="deleteRequest('${request.id}')">Hapus</button>` : ""}
    </div>
  `;
}

function openDecision(id, decision) {
  state.modal = { id, decision };
  render();
}

function renderModal() {
  if (!state.modal) return "";
  const request = state.requests.find((item) => item.id === state.modal.id);
  if (!request) return "";
  if (state.modal.detail) return renderDetailModal(request);
  const labels = { approve: "Approve", reject: "Reject", revision: "Request Revision" };
  return `
    <div class="modal-backdrop">
      <form class="modal" onsubmit="event.preventDefault(); decideRequest(event)">
        <h3>${labels[state.modal.decision]} · ${escapeHtml(request.number)}</h3>
        <p class="helper">${escapeHtml(request.title)} oleh ${escapeHtml(request.requesterName)}</p>
        <div class="field">
          <label>Komentar Keputusan</label>
          <textarea name="comment" required placeholder="Tambahkan komentar untuk requester"></textarea>
        </div>
        <div class="form-actions">
          <button class="btn ghost" type="button" onclick="state.modal=null; render()">Batal</button>
          <button class="btn primary" type="submit">Simpan Keputusan</button>
        </div>
      </form>
    </div>
  `;
}

function decideRequest(event) {
  const request = state.requests.find((item) => item.id === state.modal.id);
  const user = currentUser();
  const comment = new FormData(event.target).get("comment");
  let message = "";

  if (state.modal.decision === "approve") {
    if (request.currentLevel >= APPROVERS.length) {
      request.status = "Approved";
      message = `${request.number} telah Approved.`;
    } else {
      request.currentLevel += 1;
      request.status = "Pending Approval";
      message = `${request.number} disetujui ${user.name} dan diteruskan ke ${USERS.find((item) => item.id === approvalStep(request)).name}.`;
    }
  }

  if (state.modal.decision === "reject") {
    request.status = "Rejected";
    message = `${request.number} ditolak oleh ${user.name}.`;
  }

  if (state.modal.decision === "revision") {
    request.status = "Revision";
    message = `${request.number} membutuhkan revisi dari ${user.name}.`;
  }

  request.updatedAt = new Date().toISOString();
  request.history.push({
    date: new Date().toISOString(),
    actor: user.name,
    action: state.modal.decision,
    comment
  });
  state.modal = null;
  notify(message, request.id);
  saveState();
  render();
}

function viewDetail(id) {
  const request = state.requests.find((item) => item.id === id);
  if (!request) return;
  state.modal = { detail: true, id };
  render();
}

function renderAttachmentLine(request) {
  const attachment = attachmentOf(request);
  if (!attachment) return `<small>Tanpa lampiran</small>`;
  return `<small>${escapeHtml(attachment.name)}${attachment.size ? ` · ${formatBytes(attachment.size)}` : ""}</small>`;
}

function renderDetailModal(request) {
  const attachment = attachmentOf(request);
  const activeApprover = request.status === "Pending Approval" ? USERS.find((user) => user.id === approvalStep(request)) : null;
  const progress = Math.min(request.currentLevel || 1, APPROVERS.length);
  return `
    <div class="modal-backdrop">
      <div class="modal detail-modal">
        <div class="detail-hero">
          <div class="detail-hero-top">
            <span class="detail-kicker">Detail Pengajuan</span>
            <button class="detail-close" type="button" onclick="state.modal=null; render()" aria-label="Tutup">x</button>
          </div>
          <div class="detail-hero-main">
            <div>
              <h3>${escapeHtml(request.title)}</h3>
              <p>${escapeHtml(request.number)} · ${escapeHtml(request.requesterName)}</p>
            </div>
            <span class="badge ${statusClass(request.status)}">${escapeHtml(request.status)}</span>
          </div>
          <div class="detail-hero-stats">
            <div>
              <small>Nominal</small>
              <strong>${formatMoney(request.amount)}</strong>
            </div>
            <div>
              <small>Approval Level</small>
              <strong>${progress}/${APPROVERS.length}</strong>
            </div>
            <div>
              <small>PIC Berikutnya</small>
              <strong>${escapeHtml(activeApprover?.name || "-")}</strong>
            </div>
          </div>
        </div>

        <div class="detail-body">
          <div class="detail-grid">
            ${detailItem("Tanggal", request.date)}
            ${detailItem("Requester", request.requesterName)}
            ${detailItem("Departemen", request.department)}
            ${detailItem("Kategori Budget", request.category)}
            ${detailItem("Dibuat", new Date(request.createdAt).toLocaleDateString("id-ID"))}
            ${detailItem("Update Terakhir", new Date(request.updatedAt).toLocaleDateString("id-ID"))}
          </div>

          <div class="detail-section">
            <div class="detail-section-title">
              <span>Deskripsi</span>
            </div>
            <p>${escapeHtml(request.description)}</p>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">
              <span>Lampiran</span>
            </div>
            ${
              attachment
                ? `<div class="attachment-box">
                    <div class="attachment-icon">DOC</div>
                    <div class="attachment-info">
                      <strong>${escapeHtml(attachment.name)}</strong>
                      <small>${escapeHtml(attachment.type || "File lampiran")}${attachment.size ? ` · ${formatBytes(attachment.size)}` : ""}</small>
                    </div>
                    <div class="row-actions">
                      <button class="btn ghost small-btn" type="button" onclick="openAttachment('${request.id}')">Lihat</button>
                      <button class="btn primary small-btn" type="button" onclick="downloadAttachment('${request.id}')">Unduh</button>
                    </div>
                  </div>`
                : `<div class="attachment-empty">Tidak ada lampiran pada request ini.</div>`
            }
          </div>

          <div class="detail-section">
            <div class="detail-section-title">
              <span>Histori Approval</span>
            </div>
            <div class="approval-steps">
              ${request.history
                .map(
                  (item) => `
                    <div class="approval-step">
                      <div class="approval-dot"></div>
                      <div>
                        <strong>${escapeHtml(item.actor)}</strong>
                        <span>${escapeHtml(item.action)}</span>
                        <small>${new Date(item.date).toLocaleString("id-ID")} · ${escapeHtml(item.comment || "-")}</small>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function detailItem(label, value) {
  return `<div class="detail-item"><small>${label}</small><strong>${escapeHtml(value || "-")}</strong></div>`;
}

function openAttachment(id) {
  const attachment = attachmentOf(state.requests.find((request) => request.id === id) || {});
  if (!attachment?.dataUrl) {
    showToast("Lampiran lama hanya menyimpan nama file. Unggah ulang file agar bisa dilihat.");
    return;
  }
  const opened = window.open(attachment.dataUrl, "_blank");
  if (!opened) showToast("Browser memblokir tab baru. Gunakan tombol Unduh.");
}

function downloadAttachment(id) {
  const attachment = attachmentOf(state.requests.find((request) => request.id === id) || {});
  if (!attachment?.dataUrl) {
    showToast("Lampiran belum memiliki data file untuk diunduh.");
    return;
  }
  const link = document.createElement("a");
  link.href = attachment.dataUrl;
  link.download = attachment.name || "lampiran";
  link.click();
}

function renderAdmin() {
  return `
    <div class="section-title">
      <div>
        <h2>Master Data</h2>
        <p class="helper">Kelola user referensi, departemen, dan kategori budget. Data request tetap kosong sampai dibuat.</p>
      </div>
      <button class="btn danger" onclick="resetDemoData()">Kosongkan Data</button>
    </div>
    <div class="admin-grid">
      <div class="panel">
        <div class="panel-title"><h2>User</h2></div>
        <div class="list">
          ${USERS.map((user) => `<div class="list-item"><span>${escapeHtml(user.name)}<br><small>${escapeHtml(user.title)} · ${escapeHtml(user.role)}</small></span></div>`).join("")}
        </div>
      </div>
      ${renderMasterPanel("Departemen", "departments")}
      ${renderMasterPanel("Kategori Budget", "categories")}
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="panel-title"><h2>Seluruh Data Pengajuan</h2></div>
      ${state.requests.length ? renderTable(state.requests, { history: true }) : emptyState("Belum ada pengajuan", "Admin akan melihat semua data setelah request dibuat.")}
    </div>
  `;
}

function renderMasterPanel(title, key) {
  return `
    <div class="panel">
      <div class="panel-title"><h2>${title}</h2></div>
      <form onsubmit="event.preventDefault(); addMaster('${key}', this.value.value); this.reset();">
        <div class="field">
          <label>Nama ${title}</label>
          <input name="value" placeholder="Tambah ${title.toLowerCase()}" required />
        </div>
        <button class="btn primary" type="submit" style="margin-top:12px">Tambah</button>
      </form>
      <div class="list">
        ${state[key].length ? state[key].map((value) => `<div class="list-item"><span>${escapeHtml(value)}</span><button class="btn ghost small-btn" onclick="removeMaster('${key}', '${escapeHtml(value)}')">Hapus</button></div>`).join("") : `<p class="helper">Belum ada data.</p>`}
      </div>
    </div>
  `;
}

function addMaster(key, value) {
  const clean = value.trim();
  if (!clean || state[key].includes(clean)) return;
  state[key].push(clean);
  saveState();
  render();
}

function removeMaster(key, value) {
  state[key] = state[key].filter((item) => item !== value);
  saveState();
  render();
}

function renderNotifications() {
  return `
    <div class="section-title">
      <div>
        <h2>Notifikasi Status</h2>
        <p class="helper">Notifikasi muncul ketika status atau level approval berubah.</p>
      </div>
      <button class="btn ghost" onclick="state.notifications=[]; saveState(); render()">Bersihkan</button>
    </div>
    <div class="notification-list">
      ${state.notifications.length
        ? state.notifications
            .map(
              (item) => `
                <div class="notification">
                  <strong>${escapeHtml(item.message)}</strong>
                  <small>${new Date(item.date).toLocaleString("id-ID")}</small>
                </div>
              `
            )
            .join("")
        : emptyState("Belum ada notifikasi", "Notifikasi akan tampil saat status pengajuan berubah.")}
    </div>
  `;
}

function emptyState(title, description) {
  return `<div class="empty"><div><strong>${title}</strong><span>${description}</span></div></div>`;
}

function exportExcel() {
  const rows = filteredRequests(currentUser());
  const headers = ["No Request", "Tanggal", "Requester", "Departemen", "Kategori", "Judul", "Nominal", "Status", "Tanggal Update"];
  const csv = [
    headers.join(","),
    ...rows.map((request) =>
      [
        request.number,
        request.date,
        request.requesterName,
        request.department,
        request.category,
        request.title,
        request.amount,
        request.status,
        request.updatedAt
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `bibo-obi-sowi-budget-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

render();