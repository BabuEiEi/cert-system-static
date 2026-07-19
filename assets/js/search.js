// ============================================================
// search.js — ค้นหารายชื่อจาก Firestore แล้วดาวน์โหลด PNG แบบ client-side
// โครงสร้างข้อมูล: activities/{aid} + activities/{aid}/participants/{pid}
// ============================================================

const activitySelect = document.getElementById("activitySelect");
const resultsEl = document.getElementById("results");
let activitiesCache = {};

// โหลดรายการกิจกรรมที่เผยแพร่แล้ว
async function loadActivities() {
  const snap = await db.collection("activities")
    .where("published", "==", true)
    .orderBy("createdAt", "desc").get();
  snap.forEach(doc => {
    activitiesCache[doc.id] = { id: doc.id, ...doc.data() };
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    activitySelect.appendChild(opt);
  });
}

// ค้นหา: เลือกกิจกรรม → ค้นใน subcollection / ทุกกิจกรรม → collectionGroup
async function search() {
  const q = document.getElementById("nameInput").value.trim();
  if (!q) return Swal.fire({ icon: "warning", title: "กรุณากรอกชื่อ–นามสกุล", confirmButtonColor: "#1B2A4A" });

  Swal.fire({ title: "กำลังค้นหา...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  const aid = activitySelect.value;
  let rows = [];

  try {
    if (aid) {
      const snap = await db.collection("activities").doc(aid)
        .collection("participants").where("name", "==", q).get();
      snap.forEach(d => rows.push({ aid, pid: d.id, ...d.data() }));
    } else {
      const snap = await db.collectionGroup("participants").where("name", "==", q).get();
      for (const d of snap.docs) {
        const parentId = d.ref.parent.parent.id;
        if (!activitiesCache[parentId]) continue; // แสดงเฉพาะกิจกรรมที่เผยแพร่
        rows.push({ aid: parentId, pid: d.id, ...d.data() });
      }
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
        <span class="text-sm">โปรดตรวจสอบการสะกดชื่อให้ตรงกับที่ลงทะเบียนไว้ทุกตัวอักษร</span>
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
        <p class="text-sm text-gray-600">${act.name || "-"} ${r.certNo ? "· เลขที่ " + r.certNo : ""}</p>
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
