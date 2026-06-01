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
//  ログ解析（完全版）
// ===============================
function parseAllLogs(rawText) {
  const lines = rawText.split('\n').map(l => l.trim());
  const allReports = [];

  let currentDate = null;

  const dateLineRegex = /^(\d{4})[./](\d{1,2})[./](\d{1,2})/;
  const timeRegex = /(\d+)\s*時間(?:\s*(\d+)\s*分)?|(\d+)\s*分/;

  // 「学校あり」多言語対応
  const schoolRegex = /(学校あり|学校アリ|ｶﾞｯｺｳｱﾘ|ガッコウアリ)/;

  const examRegex = /受験生/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 日付行
    const d = line.match(dateLineRegex);
    if (d) {
      const y = d[1];
      const m = d[2].padStart(2, "0");
      const day = d[3].padStart(2, "0");
      currentDate = `${y}-${m}-${day}`;
      continue;
    }

    // 勉強時間報告 → ブロック開始
    if (line.includes("勉強時間報告")) {
      if (!currentDate) continue;

      // 名前は前の行（時刻付き）
      const nameLine = lines[i - 1] || "";
      const name = nameLine.replace(/^\d{1,2}:\d{2}\s*/, "").trim();

      // ブロック（次の3行をまとめて解析）
      const block = [
        line,
        lines[i + 1] || "",
        lines[i + 2] || "",
        lines[i + 3] || ""
      ].join(" ");

      // 時間
      let minutes = 0;
      const t = block.match(timeRegex);
      if (t) {
        if (t[1]) {
          // 3時間20分
          const h = Number(t[1]);
          const m = t[2] ? Number(t[2]) : 0;
          minutes = h * 60 + m;
        } else if (t[3]) {
          // 3分
          minutes = Number(t[3]);
        }
      }
      if (minutes === 0) continue;

      // 属性
      const school = schoolRegex.test(block); // 学校なしは無視
      const exam = examRegex.test(block);

      // 日付 + 時刻（名前行の時刻を使う）
      const timeMatch = nameLine.match(/^(\d{1,2}):(\d{2})/);
      let msgDate = new Date(`${currentDate}T00:00:00`);
      if (timeMatch) {
        msgDate.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
      }

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
    text += `今月合計 (${monthH}h)\n`;
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
      text += `今月合計 (${monthH}h)\n`;
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
      text += `今月合計 (${monthH}h)\n`;
    });
  }

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
