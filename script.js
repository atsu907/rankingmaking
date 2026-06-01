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

// ログ解析（全期間）
function parseAllLogs(rawText) {
  const lines = rawText.split('\n').map(l => l.trim());

  let currentLogDate = null;
  const allReports = [];

  // ★ スラッシュ & ピリオド & 1桁対応
  const dateLineRegex = /^(\d{4})[./](\d{1,2})[./](\d{1,2})/;
  const timeRegex = /(\d+)\s*時間(?:\s*(\d+)\s*分)?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 日付行
    const d = line.match(dateLineRegex);
    if (d) {
      const y = d[1];
      const m = d[2].padStart(2, "0");
      const day = d[3].padStart(2, "0");
      currentLogDate = `${y}-${m}-${day}`;
      continue;
    }
    if (!currentLogDate) continue;

    // 勉強時間報告
    const m = line.match(/^(\d{1,2}):(\d{2})\s+(.+?)\s+勉強時間報告/);
    if (!m) continue;

    const hour = Number(m[1]);
    const minute = Number(m[2]);
    const name = m[3].trim();

    let msgDate = new Date(`${currentLogDate}T00:00:00`);
    msgDate.setHours(hour, minute, 0, 0);

    const hasSchool = line.includes("学校あり");
    const hasExam = line.includes("受験生");

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const h = Number(timeMatch[1]);
      const m2 = timeMatch[2] ? Number(timeMatch[2]) : 0;
      const total = h * 60 + m2;

      allReports.push({
        name,
        minutes: total,
        date: msgDate,
        school: hasSchool,
        exam: hasExam
      });
    }
  }

  return allReports;
}

// 指定日の日次範囲
function getDailyRange(targetDateStr) {
  const start = new Date(`${targetDateStr}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(6, 0, 0, 0);
  return { start, end };
}

// 月初〜当日までの全日次期間
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

// ボタン押下
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

  // 当日の日次範囲
  const { start, end } = getDailyRange(targetDateStr);

  // 当日報告（最新のみ）
  const latestToday = {};
  allReports.forEach(r => {
    if (r.date >= start && r.date <= end) {
      latestToday[r.name] = r;
    }
  });

  const todayEntries = Object.values(latestToday).sort((a, b) => b.minutes - a.minutes);

  // 月次範囲
  const monthlyRanges = getMonthlyRanges(targetDateStr);

  // 月次合計（1日1回だけ）
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

  // 日付フォーマット（6/24）
  const d = new Date(targetDateStr);
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;

  // 表示テキスト
  let text = "";

  // 総合ランキング
  text += `総合ランキング ${dateLabel}\n`;
  todayEntries.forEach((r, i) => {
    const h = Math.floor(r.minutes / 60);
    const m = r.minutes % 60;
    const monthH = Math.floor((monthlyTotals[r.name] || 0) / 60);

    text += `${i + 1}位 ${r.name}：${h}時間${m}分\n`;
    text += `今月合計 ${monthH}h\n`;
  });

  text += "\n";

  // 学校あり
  const school = todayEntries.filter(r => r.school);
  if (school.length > 0) {
    text += "学校ありランキング\n";
    school.forEach((r, i) => {
      const h = Math.floor(r.minutes / 60);
      const m = r.minutes % 60;
      const monthH = Math.floor((monthlyTotals[r.name] || 0) / 60);

      text += `${i + 1}位 ${r.name}：${h}時間${m}分\n`;
      text += `今月合計 ${monthH}h\n`;
    });
    text += "\n";
  }

  // 受験生
  const exam = todayEntries.filter(r => r.exam);
  if (exam.length > 0) {
    text += "受験生ランキング\n";
    exam.forEach((r, i) => {
      const h = Math.floor(r.minutes / 60);
      const m = r.minutes % 60;
      const monthH = Math.floor((monthlyTotals[r.name] || 0) / 60);

      text += `${i + 1}位 ${r.name}：${h}時間${m}分\n`;
      text += `今月合計 ${monthH}h\n`;
    });
  }

  document.getElementById('resultText').textContent = text;
});

// コピー機能
document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('resultText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const msg = document.getElementById('copyMsg');
    msg.style.display = "inline";
    setTimeout(() => msg.style.display = "none", 1500);
  });
});
