// ============================================================
// dashboard.js — ตรรกะหลักของแผงควบคุม (Admin/Staff)
// Admin : สร้าง/ลบ/เผยแพร่กิจกรรม + จัดการบทบาท + ทุกอย่างของ Staff
// Staff : ตั้งค่ารูปแบบ, นำเข้ารายชื่อ, สร้าง PNG
// ============================================================

let currentUser = null, currentRole = null;
let currentActivity = null;   // { id, ...data }
let tpl = defaultTemplate();
let participants = [];

// ---------- 1) Auth guard + role ----------
auth.onAuthStateChanged(async (user) => {
  if (!user) return location.href = "login.html";
  const doc = await db.collection("users").doc(user.uid).get();
  const role = doc.exists ? doc.data().role : null;
  if (role !== "admin" && role !== "staff") {
    await auth.signOut();
    return location.href = "login.html";
  }
  currentUser = user; currentRole = role;
  document.getElementById("userEmail").textContent = user.email;
  const badge = document.getElementById("roleBadge");
  badge.textContent = role === "admin" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่";
  badge.classList.remove("hidden");
  if (role === "admin") document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
  loadActivities();
});

document.getElementById("logoutBtn").onclick = async () => {
  await auth.signOut(); location.href = "login.html";
};

// ---------- 2) กิจกรรม ----------
async function loadActivities() {
  const list = document.getElementById("activityList");
  list.innerHTML = "";
  const snap = await db.collection("activities").orderBy("createdAt", "desc").get();
  if (snap.empty) list.innerHTML = `<li class="text-gray-400 text-sm">ยังไม่มีกิจกรรม</li>`;
  snap.forEach(doc => {
    const li = document.createElement("li");
    const active = currentActivity && currentActivity.id === doc.id;
    li.innerHTML = `
      <button class="w-full text-left px-3 py-2 rounded-lg transition ${active ? "bg-navy text-white" : "hover:bg-parchment"}">
        ${doc.data().name}
        ${doc.data().published ? '<span class="text-xs text-navy"> ●</span>' : ""}
      </button>`;
    li.querySelector("button").onclick = () => openActivity({ id: doc.id, ...doc.data() });
    list.appendChild(li);
  });
}

document.getElementById("addActivityBtn").onclick = async () => {
  const { value: name } = await Swal.fire({
    title: "สร้างกิจกรรมใหม่",
    input: "text",
    inputLabel: "ชื่อกิจกรรม / หลักสูตรอบรม",
    inputPlaceholder: "เช่น อบรมเชิงปฏิบัติการการใช้ AI เพื่อการศึกษา",
    showCancelButton: true, confirmButtonText: "สร้าง", cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1B2A4A"
  });
  if (!name) return;
  const ref = await db.collection("activities").add({
    name, published: false,
    template: defaultTemplate(),
    createdBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await loadActivities();
  openActivity({ id: ref.id, name, published: false, template: defaultTemplate() });
};

document.getElementById("deleteActivityBtn").onclick = async () => {
  if (!currentActivity) return;
  const c = await Swal.fire({
    icon: "warning", title: "ลบกิจกรรมนี้?", text: "รายชื่อและรูปแบบทั้งหมดจะถูกลบถาวร",
    showCancelButton: true, confirmButtonText: "ลบ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#DC2626"
  });
  if (!c.isConfirmed) return;
  const parts = await db.collection("activities").doc(currentActivity.id).collection("participants").get();
  const batch = db.batch();
  parts.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection("activities").doc(currentActivity.id));
  await batch.commit();
  currentActivity = null;
  document.getElementById("workspace").classList.add("hidden");
  document.getElementById("emptyState").classList.remove("hidden");
  loadActivities();
};

document.getElementById("publishToggle").onchange = async (e) => {
  if (!currentActivity) return;
  await db.collection("activities").doc(currentActivity.id).update({ published: e.target.checked });
  currentActivity.published = e.target.checked;
  loadActivities();
};

async function openActivity(act) {
  currentActivity = act;
  tpl = { ...defaultTemplate(), ...(act.template || {}) };
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("workspace").classList.remove("hidden");
  document.getElementById("wsActivityName").textContent = act.name;
  document.getElementById("publishToggle").checked = !!act.published;
  fillForm();
  await loadParticipants();
  document.getElementById("wsActivityMeta").textContent = `ผู้เข้าอบรม ${participants.length} คน`;
  loadActivities();
  preview();
}

// ---------- 3) ฟอร์ม template ----------
const F = id => document.getElementById(id);

function fillForm() {
  F("bgColor").value = tpl.bgColor;
  F("borderColor").value = tpl.borderColor;
  F("bgImageUrl").value = tpl.bgImageUrl || "";
  F("fontFamily").value = tpl.fontFamily;
  F("logoUrl").value = tpl.logoUrl || "";
  F("titleText").value = tpl.titleText;
  F("bodyText").value = tpl.bodyText;
  F("dateLine").value = tpl.dateLine;
  F("activityText").value = tpl.activityText || "";
  // ตารางจัดรูปแบบตัวอักษร
  F("titleSize").value = tpl.titleSize;       F("titleColor").value = tpl.titleColor;
  F("titleBold").checked = !!tpl.titleBold;   F("titleItalic").checked = !!tpl.titleItalic;
  F("nameSize").value = tpl.nameSize;         F("nameColor").value = tpl.nameColor;
  F("nameBold").checked = tpl.nameBold !== false; F("nameItalic").checked = !!tpl.nameItalic;
  F("bodySize").value = tpl.bodySize;         F("bodyColor").value = tpl.bodyColor;
  F("bodyBold").checked = !!tpl.bodyBold;     F("bodyItalic").checked = !!tpl.bodyItalic;
  F("activitySize").value = tpl.activitySize || 46; F("activityColor").value = tpl.activityColor || "#1B2A4A";
  F("activityBold").checked = tpl.activityBold !== false; F("activityItalic").checked = !!tpl.activityItalic;
  renderSigList();
}

function readForm() {
  tpl.bgColor = F("bgColor").value;
  tpl.borderColor = F("borderColor").value;
  tpl.bgImageUrl = F("bgImageUrl").value.trim();
  tpl.fontFamily = F("fontFamily").value;
  tpl.logoUrl = F("logoUrl").value.trim();
  tpl.titleText = F("titleText").value;
  tpl.bodyText = F("bodyText").value;
  tpl.dateLine = F("dateLine").value;
  // ชื่อกิจกรรมบนเกียรติบัตร: กำหนดเองได้ / เว้นว่าง = ใช้ชื่อกิจกรรมของระบบ
  tpl.activityText = F("activityText").value;
  tpl.activityLine = tpl.activityText.trim() || (currentActivity ? currentActivity.name : "");
  // ตารางจัดรูปแบบตัวอักษร
  tpl.titleSize = parseInt(F("titleSize").value) || 44;   tpl.titleColor = F("titleColor").value;
  tpl.titleBold = F("titleBold").checked;                 tpl.titleItalic = F("titleItalic").checked;
  tpl.nameSize = parseInt(F("nameSize").value) || 88;     tpl.nameColor = F("nameColor").value;
  tpl.nameBold = F("nameBold").checked;                   tpl.nameItalic = F("nameItalic").checked;
  tpl.bodySize = parseInt(F("bodySize").value) || 40;     tpl.bodyColor = F("bodyColor").value;
  tpl.bodyBold = F("bodyBold").checked;                   tpl.bodyItalic = F("bodyItalic").checked;
  tpl.activitySize = parseInt(F("activitySize").value) || 46; tpl.activityColor = F("activityColor").value;
  tpl.activityBold = F("activityBold").checked;           tpl.activityItalic = F("activityItalic").checked;
}

function renderSigList() {
  const wrap = F("sigList");
  wrap.innerHTML = "";
  (tpl.signatures || []).forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "grid grid-cols-12 gap-2 items-center";
    div.innerHTML = `
      <input class="col-span-4 border border-line rounded px-2 py-1.5 text-sm" placeholder="URL รูปลายเซ็น" value="${s.imageUrl || ""}" data-k="imageUrl">
      <input class="col-span-4 border border-line rounded px-2 py-1.5 text-sm" placeholder="ชื่อผู้ลงนาม" value="${s.name || ""}" data-k="name">
      <input class="col-span-3 border border-line rounded px-2 py-1.5 text-sm" placeholder="ตำแหน่ง" value="${s.position || ""}" data-k="position">
      <button class="col-span-1 text-red-500 hover:text-red-700 text-lg" title="ลบ">×</button>`;
    div.querySelectorAll("input").forEach(inp => inp.oninput = () => { tpl.signatures[i][inp.dataset.k] = inp.value; });
    div.querySelector("button").onclick = () => { tpl.signatures.splice(i, 1); renderSigList(); };
    wrap.appendChild(div);
  });
}

F("addSigBtn").onclick = () => {
  tpl.signatures = tpl.signatures || [];
  if (tpl.signatures.length >= 3) return Swal.fire({ icon: "info", title: "ใส่ลายเซ็นได้สูงสุด 3 คน", confirmButtonColor: "#1B2A4A" });
  tpl.signatures.push({ imageUrl: "", name: "", position: "" });
  renderSigList();
};

async function preview() {
  readForm();
  await renderCertificate(F("previewCanvas"), tpl, "นางสาวตัวอย่าง นามสมมุติ", "001/2569");
}
F("previewBtn").onclick = preview;

F("saveTplBtn").onclick = async () => {
  if (!currentActivity) return;
  readForm();
  await db.collection("activities").doc(currentActivity.id).update({ template: tpl });
  currentActivity.template = tpl;
  preview();
  Swal.fire({ icon: "success", title: "บันทึกรูปแบบแล้ว", timer: 1400, showConfirmButton: false });
};

// ---------- 4) รายชื่อผู้เข้าอบรม ----------
async function loadParticipants() {
  participants = [];
  const snap = await db.collection("activities").doc(currentActivity.id)
    .collection("participants").orderBy("certNo").get();
  snap.forEach(d => participants.push({ id: d.id, ...d.data() }));
  renderParticipants();
}

function renderParticipants() {
  const ul = F("participantList");
  ul.innerHTML = participants.length ? "" : `<li class="py-2 text-gray-400">ยังไม่มีรายชื่อ</li>`;
  F("pCount").textContent = participants.length;
  participants.forEach(p => {
    const li = document.createElement("li");
    li.className = "py-2 flex items-center justify-between";
    li.innerHTML = `
      <span>${p.certNo ? `<span class="text-gray-400 text-xs mr-2">${p.certNo}</span>` : ""}${p.name}</span>
      <span class="flex gap-2">
        <button class="one text-navy hover:underline text-xs">PNG</button>
        <button class="del text-red-500 hover:underline text-xs">ลบ</button>
      </span>`;
    li.querySelector(".one").onclick = () => genOne(p);
    li.querySelector(".del").onclick = async () => {
      await db.collection("activities").doc(currentActivity.id).collection("participants").doc(p.id).delete();
      loadParticipants();
    };
    ul.appendChild(li);
  });
}

F("importNamesBtn").onclick = async () => {
  const lines = F("namesInput").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!lines.length) return Swal.fire({ icon: "warning", title: "วางรายชื่อก่อนนำเข้า", confirmButtonColor: "#1B2A4A" });
  Swal.fire({ title: "กำลังนำเข้า...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  const col = db.collection("activities").doc(currentActivity.id).collection("participants");
  const year = (F("certYear").value.trim() || String(new Date().getFullYear() + 543));
  const startVal = parseInt(F("certStart").value);
  let no = Number.isFinite(startVal) && startVal > 0 ? startVal - 1 : participants.length;
  const batch = db.batch();
  lines.forEach(name => {
    no++;
    batch.set(col.doc(), { name, certNo: `${String(no).padStart(3, "0")}/${year}` });
  });
  await batch.commit();
  F("namesInput").value = "";
  await loadParticipants();
  Swal.fire({ icon: "success", title: `นำเข้าแล้ว ${lines.length} รายชื่อ`, timer: 1600, showConfirmButton: false });
};

// ---------- 5) สร้าง PNG ----------
async function genOne(p) {
  readForm();
  const canvas = F("genCanvas");
  await renderCertificate(canvas, tpl, p.name, p.certNo || "");
  downloadCanvasPNG(canvas, `เกียรติบัตร-${p.name}`);
}

F("genAllBtn").onclick = async () => {
  if (!participants.length) return Swal.fire({ icon: "info", title: "ยังไม่มีรายชื่อ", confirmButtonColor: "#1B2A4A" });
  readForm();
  const zip = new JSZip();
  const canvas = F("genCanvas");
  for (let i = 0; i < participants.length; i++) {
    Swal.fire({ title: `กำลังสร้าง ${i + 1}/${participants.length}`, didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    await renderCertificate(canvas, tpl, participants[i].name, participants[i].certNo || "");
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    zip.file(`เกียรติบัตร-${participants[i].name}.png`, blob);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = `${currentActivity.name}-เกียรติบัตร.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  Swal.fire({ icon: "success", title: "สร้างครบทุกรายชื่อแล้ว", timer: 1800, showConfirmButton: false });
};

// ---------- 6) เพิ่มผู้ใช้งานใหม่ (Admin) — ไม่ต้องเข้า Firebase Console ----------
// ใช้ secondary app instance เพื่อสร้างบัญชีโดยไม่ทำให้ session ของ admin ที่ล็อกอินอยู่หลุด
document.getElementById("addUserBtn").onclick = async () => {
  const { value: form } = await Swal.fire({
    title: "เพิ่มผู้ใช้งานใหม่",
    html: `
      <div class="text-left space-y-3">
        <div>
          <label class="text-sm font-medium block mb-1">อีเมล</label>
          <input id="swal-email" type="email" class="swal2-input m-0 w-full" placeholder="staff@example.com">
        </div>
        <div>
          <label class="text-sm font-medium block mb-1">รหัสผ่านเริ่มต้น</label>
          <input id="swal-pass" type="text" class="swal2-input m-0 w-full" placeholder="อย่างน้อย 6 ตัวอักษร">
        </div>
        <div>
          <label class="text-sm font-medium block mb-1">บทบาท</label>
          <select id="swal-role" class="swal2-select m-0 w-full">
            <option value="staff" selected>Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>`,
    confirmButtonText: "สร้างบัญชี", showCancelButton: true, cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#1B2A4A",
    preConfirm: () => {
      const email = document.getElementById("swal-email").value.trim();
      const pass = document.getElementById("swal-pass").value;
      const role = document.getElementById("swal-role").value;
      if (!email || !pass || pass.length < 6) {
        Swal.showValidationMessage("กรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร");
        return false;
      }
      return { email, pass, role };
    }
  });
  if (!form) return;

  Swal.fire({ title: "กำลังสร้างบัญชี...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });

  // สร้าง Firebase app instance ที่สอง เพื่อไม่ให้ auth session ของ admin ปัจจุบันหลุด
  const secondaryName = "Secondary-" + Date.now();
  const secondaryApp = firebase.initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = secondaryApp.auth();

  try {
    const cred = await secondaryAuth.createUserWithEmailAndPassword(form.email, form.pass);
    await db.collection("users").doc(cred.user.uid).set({
      email: form.email,
      role: form.role,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await secondaryAuth.signOut();
    await secondaryApp.delete();
    Swal.fire({
      icon: "success", title: "สร้างบัญชีสำเร็จ",
      html: `บัญชี <b>${form.email}</b> พร้อมใช้งานในบทบาท <b>${form.role === "admin" ? "Admin" : "Staff"}</b> แล้ว<br>
             <span class="text-sm text-gray-500">แจ้งอีเมลและรหัสผ่านนี้ให้ผู้ใช้เปลี่ยนรหัสผ่านเองในภายหลัง</span>`,
      confirmButtonColor: "#1B2A4A"
    });
  } catch (e) {
    let msg = e.message;
    if (e.code === "auth/email-already-in-use") msg = "อีเมลนี้มีบัญชีอยู่แล้วในระบบ ใช้ปุ่ม 'จัดการบทบาทที่มีอยู่' แทน";
    if (e.code === "auth/weak-password") msg = "รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 6 ตัวอักษร";
    Swal.fire({ icon: "error", title: "สร้างบัญชีไม่สำเร็จ", text: msg, confirmButtonColor: "#1B2A4A" });
    try { await secondaryApp.delete(); } catch (_) {}
  }
};

// ---------- 7) จัดการบทบาท (Admin) ----------
document.getElementById("manageUsersBtn").onclick = async () => {
  const snap = await db.collection("users").get();
  let rows = "";
  snap.forEach(d => {
    const u = d.data();
    rows += `
      <div class="flex items-center justify-between gap-2 py-2 border-b border-gray-100 text-left">
        <span class="text-sm">${u.email || d.id}</span>
        <select data-uid="${d.id}" class="role-sel border rounded px-2 py-1 text-sm">
          <option value="user"  ${u.role === "user" ? "selected" : ""}>User</option>
          <option value="staff" ${u.role === "staff" ? "selected" : ""}>Staff</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </div>`;
  });
  await Swal.fire({
    title: "จัดการบทบาทผู้ใช้",
    html: `<div class="max-h-72 overflow-y-auto">${rows || "ยังไม่มีผู้ใช้ใน collection users"}</div>`,
    confirmButtonText: "บันทึก", confirmButtonColor: "#1B2A4A", showCancelButton: true, cancelButtonText: "ปิด",
    preConfirm: async () => {
      const sels = Swal.getHtmlContainer().querySelectorAll(".role-sel");
      for (const s of sels) await db.collection("users").doc(s.dataset.uid).update({ role: s.value });
    }
  });
};
