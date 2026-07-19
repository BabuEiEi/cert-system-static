// ============================================================
// search.js — ค้นหารายชื่อจาก Firestore แล้วดาวน์โหลด PNG แบบ client-side
// โครงสร้างข้อมูล: activities/{aid} + activities/{aid}/participants/{pid}
// ============================================================

const activityInput = document.getElementById("activityInput");
const activityDropdown = document.getElementById("activityDropdown");
const resultsEl = document.getElementById("results");
let activitiesCache = {};
let selectedActivityId = "";   // "" = ทุกกิจกรรม

// โหลดรายการกิจกรรมที่เผยแพร่แล้ว
// หมายเหตุ: ไม่ใช้ orderBy ร่วมกับ where เพื่อเลี่ยง composite index — เรียงลำดับฝั่ง client แทน
async function loadActivities() {
  const snap = await db.collection("activities")
    .where("published", "==", true).get();
  const acts = [];
  snap.forEach(doc => acts.push({ id: doc.id, ...doc.data() }));
  acts.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  acts.forEach(act => { activitiesCache[act.id] = act; });
}

// ---------- combobox ค้นหา/เลือกกิจกรรม ----------
const ALL_LABEL = "— ทุกกิจกรรม —";

function renderActivityDropdown(keyword = "") {
  const kw = keyword.trim().toLowerCase();
  const acts = Object.values(activitiesCache)
    .filter(a => !kw || (a.name || "").toLowerCase().includes(kw));
  activityDropdown.innerHTML = "";

  // ตัวเลือก "ทุกกิจกรรม"
  const all = document.createElement("div");
  all.className = "px-3 py-2.5 cursor-pointer hover:bg-parchment text-sm" + (selectedActivityId === "" ? " font-semibold text-navy" : "");
  all.textContent = ALL_LABEL;
  // ใช้ mousedown + preventDefault กัน input เสีย focus ก่อนคลิกทำงาน
  all.addEventListener("mousedown", e => { e.preventDefault(); selectActivity("", ""); });
  activityDropdown.appendChild(all);

  if (!acts.length && kw) {
    const empty = document.createElement("div");
    empty.className = "px-3 py-2.5 text-sm text-gray-400";
    empty.textContent = "ไม่พบกิจกรรมที่ค้นหา";
    activityDropdown.appendChild(empty);
  }
  acts.forEach(a => {
    const item = document.createElement("div");
    item.className = "px-3 py-2.5 cursor-pointer hover:bg-parchment text-sm border-t border-line" + (selectedActivityId === a.id ? " font-semibold text-navy bg-parchment" : "");
    item.textContent = a.name || "-";
    item.addEventListener("mousedown", e => { e.preventDefault(); selectActivity(a.id, a.name); });
    activityDropdown.appendChild(item);
  });
  activityDropdown.classList.remove("hidden");
}

function selectActivity(id, name) {
  selectedActivityId = id;
  // เลือก "ทุกกิจกรรม" → แสดงข้อความให้เห็นชัดว่าเลือกแล้ว
  activityInput.value = id ? name : ALL_LABEL;
  activityDropdown.classList.add("hidden");
  activityInput.blur();
}

activityInput.addEventListener("focus", () => {
  activityInput.select();                 // คลิกแล้วเลือกข้อความเดิมทั้งหมด พิมพ์ทับได้ทันที
  renderActivityDropdown("");             // แสดงรายการทั้งหมดเมื่อเปิด
});
activityInput.addEventListener("input", () => {
  selectedActivityId = "";           // พิมพ์ใหม่ = ยกเลิกตัวที่เลือกไว้
  renderActivityDropdown(activityInput.value);
});
activityInput.addEventListener("blur", () => setTimeout(() => activityDropdown.classList.add("hidden"), 150));

// ค้นหา: ดึงรายชื่อจากกิจกรรมที่เผยแพร่ แล้วกรองฝั่ง client
// → รองรับค้นหาบางส่วนของชื่อ เช่น "สมชาย" หรือ "ขยันยิ่ง"
// → ไม่ใช้ collectionGroup เพราะติดข้อจำกัด security rules แบบ nested
const participantsCache = {};   // aid → [participants]

async function getParticipants(aid) {
  if (participantsCache[aid]) return participantsCache[aid];
  const snap = await db.collection("activities").doc(aid).collection("participants").get();
  const arr = [];
  snap.forEach(d => arr.push({ aid, pid: d.id, ...d.data() }));
  participantsCache[aid] = arr;
  return arr;
}

async function search() {
  const q = document.getElementById("nameInput").value.trim();
  if (!q) return Swal.fire({ icon: "warning", title: "กรุณากรอกชื่อ–นามสกุล", confirmButtonColor: "#1B2A4A" });

  Swal.fire({ title: "กำลังค้นหา...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  const aids = selectedActivityId ? [selectedActivityId] : Object.keys(activitiesCache);
  let rows = [];

  try {
    for (const aid of aids) {
      const parts = await getParticipants(aid);
      rows.push(...parts.filter(p => (p.name || "").includes(q)));
    }
    Swal.close();
    renderResults(rows, q);
  } catch (e) {
    Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: e.message, confirmButtonColor: "#1B2A4A" });
  }
}

function renderResults(rows, q) {
  resultsEl.innerHTML = "";
  if (!rows.length) {
    resultsEl.innerHTML = `
      <div class="bg-white border border-line rounded-xl p-8 text-center text-gray-500">
        ไม่พบเกียรติบัตรของ "<span class="font-medium text-ink">${q}</span>"<br>
        <span class="text-sm">ลองค้นหาด้วยชื่อหรือนามสกุลเพียงบางส่วน หรือตรวจสอบการสะกด</span>
      </div>`;
    return;
  }
  rows.forEach(r => {
    const act = activitiesCache[r.aid] || {};
    const card = document.createElement("div");
    card.className = "bg-white border border-line rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between";
    card.innerHTML = `
      <div>
        <p class="font-semibold text-navy">${r.name}</p>
        <p class="text-sm text-gray-600">${act.name || "-"} ${r.certNo ? "· เลขที่ " + formatCertNo(act.template || {}, r.certNo) : ""}</p>
      </div>
      <button class="dl-btn bg-navy text-white font-medium px-5 py-2.5 rounded-lg hover:bg-navy-deep transition">
        ดาวน์โหลด PNG
      </button>`;
    card.querySelector(".dl-btn").onclick = () => downloadCert(r, act);
    resultsEl.appendChild(card);
  });
}

async function downloadCert(row, act) {
  Swal.fire({ title: "กำลังสร้างเกียรติบัตร...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  try {
    const tpl = { ...defaultTemplate(), ...(act.template || {}) };
    tpl.activityLine = tpl.activityLine || act.name || "";
    const canvas = document.getElementById("certCanvas");
    await renderCertificate(canvas, tpl, row.name, row.certNo || "");
    downloadCanvasPNG(canvas, `เกียรติบัตร-${row.name}`);
    Swal.fire({ icon: "success", title: "ดาวน์โหลดสำเร็จ", timer: 1600, showConfirmButton: false });
  } catch (e) {
    Swal.fire({ icon: "error", title: "สร้างไฟล์ไม่สำเร็จ", text: e.message, confirmButtonColor: "#1B2A4A" });
  }
}

document.getElementById("searchBtn").onclick = search;
document.getElementById("nameInput").addEventListener("keydown", e => { if (e.key === "Enter") search(); });
loadActivities();
