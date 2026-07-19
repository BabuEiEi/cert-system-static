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
    titleBold: false, titleItalic: false,
    nameSize: 88,
    nameColor: "#1B2A4A",
    nameBold: true, nameItalic: false,
    bodyText: "ได้ผ่านการอบรมเชิงปฏิบัติการ",
    activityLine: "",          // ข้อความชื่อกิจกรรมที่จะวาดจริง (กำหนดเองได้)
    activitySize: 46,
    activityColor: "#1B2A4A",
    activityBold: true, activityItalic: false,
    dateLine: "ให้ไว้ ณ วันที่ ....",
    bodySize: 40,
    bodyColor: "#23272F",
    bodyBold: false, bodyItalic: false,
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


// วาดข้อความหลายบรรทัด: แยกด้วย \n และตัดบรรทัดอัตโนมัติเมื่อยาวเกิน maxWidth
// คืนค่า y ของบรรทัดถัดไป
function drawLines(ctx, text, cx, y, size, lineGap, maxWidth) {
  const paragraphs = String(text || "").split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) { y += size + lineGap; continue; }
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, y);
        y += size + lineGap;
        line = w;
      } else line = test;
    }
    ctx.fillText(line, cx, y);
    y += size + lineGap;
  }
  return y;
}

// สร้าง font string ตามสไตล์ (หนา/เอียง)
function fontStr(size, family, bold, italic, normalWeight = 400) {
  return `${italic ? "italic " : ""}${bold ? 700 : normalWeight} ${size}px "${family}"`;
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

  // 4) หัวเรื่อง (รองรับหลายบรรทัด: กด Enter ในช่องกรอก)
  ctx.fillStyle = tpl.titleColor;
  ctx.font = fontStr(tpl.titleSize, family, tpl.titleBold, tpl.titleItalic, 500);
  y = drawLines(ctx, tpl.titleText, cx, y + 40, tpl.titleSize, 14, CERT_W - 300);

  // 5) ชื่อผู้รับ
  ctx.fillStyle = tpl.nameColor;
  ctx.font = fontStr(tpl.nameSize, family, tpl.nameBold !== false, tpl.nameItalic);
  ctx.fillText(personName, cx, y + tpl.nameSize);

  // เส้นใต้ชื่อ
  ctx.strokeStyle = tpl.borderColor || "#C9A227";
  ctx.lineWidth = 3;
  const nameW = Math.max(ctx.measureText(personName).width + 120, 500);
  ctx.beginPath();
  ctx.moveTo(cx - nameW / 2, y + 30 + tpl.nameSize);
  ctx.lineTo(cx + nameW / 2, y + 30 + tpl.nameSize);
  ctx.stroke();

  // 6) เนื้อหา (ทุกส่วนรองรับหลายบรรทัด + ตัดบรรทัดอัตโนมัติ)
  ctx.fillStyle = tpl.bodyColor;
  ctx.font = fontStr(tpl.bodySize, family, tpl.bodyBold, tpl.bodyItalic);
  let by = y + 110 + tpl.nameSize;
  by = drawLines(ctx, tpl.bodyText, cx, by, tpl.bodySize, 12, CERT_W - 300);
  if (tpl.activityLine) {
    const aSize = tpl.activitySize || (tpl.bodySize + 6);
    ctx.fillStyle = tpl.activityColor || tpl.bodyColor;
    ctx.font = fontStr(aSize, family, tpl.activityBold !== false, tpl.activityItalic, 600);
    by = drawLines(ctx, tpl.activityLine, cx, by + 8, aSize, 14, CERT_W - 340);
  }
  ctx.fillStyle = tpl.bodyColor;
  ctx.font = fontStr(tpl.bodySize - 4, family, tpl.bodyBold, tpl.bodyItalic);
  drawLines(ctx, tpl.dateLine, cx, by + 14, tpl.bodySize - 4, 12, CERT_W - 300);

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

  // 8) เลขที่เกียรติบัตร (มุมขวาบน)
  if (certNo) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#6B7280";
    ctx.font = `400 26px "Sarabun"`;
    ctx.fillText("เลขที่ " + certNo, CERT_W - 100, 130);
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
