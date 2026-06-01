// Apple風のボタン → 隠れた fileInput をクリック
document.getElementById('fileBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

// ファイル名表示
document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('fileName').textContent = file ? file.name : "";
});

// ファイル読み込み
document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    document.getElementById('logInput').value = event.target.result;
  };
  reader.readAsText(file, 'UTF-8');
});


// ===============================
//  全角 → 半角変換
// ===============================
function toHalfWidth(str) {
  return str.replace(/[！-～]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  }).replace(/　/g, " ");
}


// ===============================
//  時間解析（半角・全角・半対応）
// ===============================
function parseMinutes(text) {
  text = toHalfWidth(text);

  // 3時間半 → 3時間30分
  const halfMatch = text.match(/(\d+)時間半/);
  if (halfMatch) {
    return Number(halfMatch[1]) * 60 + 30;
  }

  // 3時間20分
  const hm = text.match(/(\d+)時間\s*(\d+)分/);
  if (hm) {
    return Number(hm[1]) * 60 + Number(hm[2]);
  }

  // 3時間
  const h = text.match(/(\d+)時間/);
  if (h) {
    return Number(h[1]) * 60;
  }

  // 20分
  const m = text.match(/(\d+)分/);
  if (m) {
    return Number(m[1]);
  }

  return 0;
}


// ===============================
//  ログ解析（1行完結型 + 複数行型）
// ===============================
function parseAllLogs(rawText) {
  const lines = rawText.split('\n').map(l => l.trim());
  const allReports = [];

  let currentDate = null;

  const dateLineRegex = /^(\d{4})[./](\d{1,2})[./](\d{1,2})/;
  const schoolRegex = /(学校あり|学校アリ|ｶﾞｯｺｳｱﾘ|ガッコウアリ)/;
  const examRegex = /受験生/;

  for (let i = 0; i < lines.length; i++) {
    let line = toHalfWidth(lines[i]);

    // 日付行
    const d = line.match(dateLineRegex);
    if (d) {
      const y = d[1];
      const m = d[2].padStart(2, "0");
      const day = d[3].padStart(2, "0");
      currentDate = `${y}-${m}-${day}`;
      continue;
    }

    // 勉強時間報告を含む行
    if (line.includes("勉強時間報告")) {
      if (!currentDate) continue;

      // 時刻
      const timeMatch = line.match(/^(\d{1,2}):(\d{2})/);
      if (!timeMatch) continue;

      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);

      // 時刻削除
      let afterTime = line.replace(/^\d{1,2}:\d{2}\s*/, "");

      // 名前は「勉強時間報告」の前まで（最初の単語）
      const beforeReport = afterTime.split("勉強時間報告")[0].trim();
      const name = beforeReport.split(" ")[0];

      if (!name || /時間|分/.test(name)) continue;

      // ブロック（次の3行も含める）
      const block = [
        line,
        lines[i + 1] || "",
        lines[i + 2] || "",
        lines[i + 3] || ""
      ].map(toHalfWidth).join(" ");

      // 時間
      const minutes = parseMinutes(block);
      if (minutes === 0) continue;

      // 属性
      const school = schoolRegex.test(block);
      const exam = examRegex.test(block);

      // 日付 + 時刻
      let msgDate = new Date(`${currentDate}T00:00:00`);
      msgDate.setHours(hour, minute, 0, 0);

      allReports.push({
        name,
        minutes,
        date: msgDate,
        school,
        exam
      });
    }
  }

  return allReports;
}


// ===============================
//  日付範囲
// ===============================
function getDailyRange(targetDateStr) {
  const start = new Date(`${targetDateStr}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(6, 0, 0, 0);
  return { start, end };
}

function getMonthlyRanges(targetDateStr) {
  const target = new Date(`${targetDateStr}T00:00:00`);
  const year = target.getFullYear();
  const month = target.getMonth();

  const ranges = [];

  for (let day = 1; day <= target.getDate(); day++) {
    const d = new Date(year, month, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    ranges.push(getDailyRange(`${yyyy}-${mm}-${dd}`));
  }

  return ranges;
}


// ===============================
//  ランキング生成
// ===============================
document.getElementById('calcBtn').addEventListener('click', () => {
  const raw = document.getElementById('logInput').value;
  const targetDateStr = document.getElementById('targetDate').value;

  if (!raw.trim()) {
    alert('ログを入力するか、ファイルを読み込んでください');
    return;
  }
  if (!targetDateStr) {
    alert('対象日を選択してください');
    return;
  }

  const allReports = parseAllLogs(raw);

  const { start, end } = getDailyRange(targetDateStr);

  const latestToday = {};
  allReports.forEach(r => {
    if (r.date >= start && r.date <= end) {
      latestToday[r.name] = r;
    }
  });

  const todayEntries = Object.values(latestToday).sort((a, b) => b.minutes - a.minutes);

  const monthlyRanges = getMonthlyRanges(targetDateStr);

  const monthlyTotals = {};

  monthlyRanges.forEach(range => {
    const daily = {};

    allReports.forEach(r => {
      if (r.date >= range.start && r.date <= range.end) {
        daily[r.name] = r;
      }
    });

    for (const name in daily) {
      if (!latestToday[name]) continue;

      monthlyTotals[name] = (monthlyTotals[name] || 0) + daily[name].minutes;
    }
  });

  const d = new Date(targetDateStr);
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

  let text = "";

  // 総合ランキング
  text += `総合ランキング ${dateLabel}\n`;
  todayEntries.forEach((r, i) => {
    const h = Math.floor(r.minutes / 60);
    const m = r.minutes % 60;
    const monthH = Math.floor((monthlyTotals[r.name] || 0) / 60);

    text += `${i + 1}位 ${r.name}：${h}時間${m}分\n`;
    text += `　(${monthH}h)\n`;
  });

  text += "\n";

  // 学校ありランキング
  const school = todayEntries.filter(r => r.school);
  if (school.length > 0) {
    text += "学校ありランキング\n";
    school.forEach((r, i) => {
      const h = Math.floor(r.minutes / 60);
      const m = r.minutes % 60;
      const monthH = Math.floor((monthlyTotals[r.name] || 0) / 60);

      text += `${i + 1}位 ${r.name}：${h}時間${m}分\n`;
      text += `　(${monthH}h)\n`;
    });
    text += "\n";
  }

  // 受験生ランキング
  const exam = todayEntries.filter(r => r.exam);
  if (exam.length > 0) {
    text += "受験生ランキング\n";
    exam.forEach((r, i) => {
      const h = Math.floor(r.minutes / 60);
      const m = r.minutes % 60;
      const monthH = Math.floor((monthlyTotals[r.name] || 0) / 60);

      text += `${i + 1}位 ${r.name}：${h}時間${m}分\n`;
      text += `　(${monthH}h)\n`;
    });
  }

  text += "\n※括弧内は今月の合計勉強時間です";

  document.getElementById('resultText').textContent = text;
});


// ===============================
//  コピー機能
// ===============================
document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('resultText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const msg = document.getElementById('copyMsg');
    msg.style.display = "inline";
    setTimeout(() => msg.style.display = "none", 1500);
  });
});


// ===============================
//  ページ読み込み時に日付を「昨日」に設定
// ===============================
window.addEventListener("load", () => {
  const d = new Date();
  d.setDate(d.getDate() - 1); // 昨日にする

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const target = document.getElementById("targetDate");
  if (target) {
    target.value = `${yyyy}-${mm}-${dd}`;
  }
});
