// ============================================================
// cert-engine.js — เครื่องมือวาดเกียรติบัตรลง <canvas> แล้ว export เป็น PNG
// ใช้ร่วมกันทั้งหน้า dashboard (ออกแบบ) และหน้า index (ดาวน์โหลด)
// ขนาดมาตรฐาน A4 แนวนอน 300dpi ≈ 3508 × 2480 → ใช้ 1754 × 1240 (150dpi พอสำหรับพิมพ์ทั่วไป)
// ============================================================

const CERT_W = 1754;
const CERT_H = 1240;

// template ค่าเริ่มต้น — โครงสร้างเดียวกับที่บันทึกลง Firestore
function defaultTemplate() {
  return {
    bgColor: "#FDFBF5",
    bgImageUrl: "",            // ถ้ามี จะวาดทับ bgColor
    borderColor: "#C9A227",
    showBorder: true,
    logoUrl: "",
    logoSize: 160,
    fontFamily: "Sarabun",     // Sarabun | Trirong | Chonburi | Mitr | Pridi
    titleText: "เกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า",
    titleSize: 44,
    titleColor: "#1B2A4A",
    nameSize: 88,
    nameColor: "#1B2A4A",
    bodyText: "ได้ผ่านการอบรมเชิงปฏิบัติการ",
    activityLine: "",          // ชื่อกิจกรรม (เติมอัตโนมัติจากกิจกรรม)
    dateLine: "ให้ไว้ ณ วันที่ ....",
    bodySize: 40,
    bodyColor: "#23272F",
    signatures: [
      // { imageUrl, name, position }
    ]
  };
}

// โหลดรูปแบบ Promise (รองรับ CORS ผ่าน crossOrigin=anonymous)
function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ: " + url));
    img.src = url;
  });
}

/**
 * วาดเกียรติบัตรลง canvas
 * @param {HTMLCanvasElement} canvas
 * @param {object} tpl  template
 * @param {string} personName ชื่อผู้รับ
 * @param {string} certNo เลขที่เกียรติบัตร (แสดงมุมล่างซ้าย, ว่างได้)
 */
async function renderCertificate(canvas, tpl, personName, certNo = "") {
  canvas.width = CERT_W;
  canvas.height = CERT_H;
  const ctx = canvas.getContext("2d");
  await document.fonts.ready;

  // 1) พื้นหลัง
  ctx.fillStyle = tpl.bgColor || "#FFFFFF";
  ctx.fillRect(0, 0, CERT_W, CERT_H);

  if (tpl.bgImageUrl) {
    try {
      const bg = await loadImage(tpl.bgImageUrl);
      if (bg) ctx.drawImage(bg, 0, 0, CERT_W, CERT_H);
    } catch (e) { console.warn(e.message); }
  }

  // 2) กรอบเส้นคู่ (สไตล์ทางการ)
  if (tpl.showBorder) {
    ctx.strokeStyle = tpl.borderColor || "#C9A227";
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, CERT_W - 80, CERT_H - 80);
    ctx.lineWidth = 2;
    ctx.strokeRect(58, 58, CERT_W - 116, CERT_H - 116);
  }

  const cx = CERT_W / 2;
  const family = tpl.fontFamily || "Sarabun";
  ctx.textAlign = "center";

  // 3) โลโก้
  let y = 150;
  if (tpl.logoUrl) {
    try {
      const logo = await loadImage(tpl.logoUrl);
      if (logo) {
        const s = tpl.logoSize || 160;
        const w = s, h = s * (logo.height / logo.width);
        ctx.drawImage(logo, cx - w / 2, 110, w, h);
        y = 110 + h + 70;
      }
    } catch (e) { console.warn(e.message); }
  }

  // 4) หัวเรื่อง
  ctx.fillStyle = tpl.titleColor;
  ctx.font = `500 ${tpl.titleSize}px "${family}"`;
  ctx.fillText(tpl.titleText, cx, y + 40);

  // 5) ชื่อผู้รับ
  ctx.fillStyle = tpl.nameColor;
  ctx.font = `700 ${tpl.nameSize}px "${family}"`;
  ctx.fillText(personName, cx, y + 60 + tpl.nameSize);

  // เส้นใต้ชื่อ
  ctx.strokeStyle = tpl.borderColor || "#C9A227";
  ctx.lineWidth = 3;
  const nameW = Math.max(ctx.measureText(personName).width + 120, 500);
  ctx.beginPath();
  ctx.moveTo(cx - nameW / 2, y + 90 + tpl.nameSize);
  ctx.lineTo(cx + nameW / 2, y + 90 + tpl.nameSize);
  ctx.stroke();

  // 6) เนื้อหา
  ctx.fillStyle = tpl.bodyColor;
  ctx.font = `400 ${tpl.bodySize}px "${family}"`;
  let by = y + 170 + tpl.nameSize;
  ctx.fillText(tpl.bodyText, cx, by);
  if (tpl.activityLine) {
    ctx.font = `600 ${tpl.bodySize + 6}px "${family}"`;
    ctx.fillText(tpl.activityLine, cx, by + tpl.bodySize + 30);
    by += tpl.bodySize + 30;
  }
  ctx.font = `400 ${tpl.bodySize - 4}px "${family}"`;
  ctx.fillText(tpl.dateLine, cx, by + tpl.bodySize + 26);

  // 7) ลายเซ็น (รองรับ 1–3 คน จัดระยะอัตโนมัติ)
  const sigs = (tpl.signatures || []).slice(0, 3);
  if (sigs.length) {
    const slotW = (CERT_W - 300) / sigs.length;
    for (let i = 0; i < sigs.length; i++) {
      const sx = 150 + slotW * i + slotW / 2;
      const sy = CERT_H - 300;
      try {
        const im = await loadImage(sigs[i].imageUrl);
        if (im) {
          const w = 260, h = 260 * (im.height / im.width);
          ctx.drawImage(im, sx - w / 2, sy, w, Math.min(h, 130));
        }
      } catch (e) { console.warn(e.message); }
      ctx.fillStyle = tpl.bodyColor;
      ctx.font = `500 32px "${family}"`;
      ctx.fillText("(" + (sigs[i].name || "") + ")", sx, sy + 175);
      ctx.font = `400 28px "${family}"`;
      ctx.fillText(sigs[i].position || "", sx, sy + 215);
    }
  }

  // 8) เลขที่เกียรติบัตร
  if (certNo) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#6B7280";
    ctx.font = `400 24px "Sarabun"`;
    ctx.fillText("เลขที่ " + certNo, 80, CERT_H - 80);
    ctx.textAlign = "center";
  }
}

// ดาวน์โหลด canvas เป็น PNG
function downloadCanvasPNG(canvas, filename) {
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith(".png") ? filename : filename + ".png";
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}
