const conditionBoard = document.getElementById('condition-board');
const coordLog = document.getElementById('coord-log');
const kanjiNums = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

// const addedRecords = new Set(); // 重複チェック用
// const searchConditions = [];     // 検索用（addedRecordsで重複がなければ格納）

for (let row = 0; row < 9; row++) {
  for (let col = 0; col < 9; col++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.x = 9 - col;
    cell.dataset.y = row + 1;
    cell.dataset.c = 1 + (9 * row) + col;

    cell.addEventListener('dragover', e => e.preventDefault());

    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      const textPiece = e.dataTransfer.getData('text/piece');
      const textSfen = e.dataTransfer.getData('text/sfen');
      const isRotated = e.dataTransfer.getData('rotated') === 'true';

      if (textPiece) {
        const newPiece = document.createElement('div');
        newPiece.className = 'piece';
        if (isRotated) newPiece.classList.add('rotate-180');
        newPiece.textContent = textPiece;
        newPiece.setAttribute('draggable', true);
        newPiece.setAttribute('data-piece', textPiece);
        newPiece.setAttribute('data-sfen', textSfen);

        newPiece.addEventListener('dragstart', (ev) => {
          ev.dataTransfer.setData('text/piece', ev.target.dataset.piece);
          ev.dataTransfer.setData('text/sfen', ev.target.dataset.sfen);
          ev.dataTransfer.setData('rotated', ev.target.classList.contains('rotate-180'));
          setTimeout(() => {
            if (ev.target.parentNode.classList.contains('cell')) {
              ev.target.remove();
            }
          }, 0);
        });

        cell.innerHTML = '';
        cell.appendChild(newPiece);
      }
    });

    conditionBoard.appendChild(cell);
  }
}

document.querySelectorAll('.piece').forEach(piece => {
  piece.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/piece', e.target.dataset.piece);
    e.dataTransfer.setData('text/sfen', e.target.dataset.sfen);
    e.dataTransfer.setData('rotated', e.target.classList.contains('rotate-180'));
    e.dataTransfer.effectAllowed = "copy";
  });
});

async function searchKifGames() {
  const searchConditions = [];
  // const searchConditions = [
  //   { c: "68", sfen: "R" },
  //   { c: "11", sfen: "r" },
  //   { c: "38", sfen: "p" }
  // ];

  document.querySelectorAll("#condition-board .piece").forEach(piece => {
    const parent = piece.closest(".cell");
    if (parent) {
      searchConditions.push({
        c: parent.getAttribute("data-c"),
        sfen: piece.getAttribute("data-sfen"),
      });
    }
  });

  try {
    const response = await fetch("http://localhost:3000/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(searchConditions)
    });

    if (!response.ok) {
      throw new Error(`サーバーエラー: ${response.status}`);
    }

    const result = await response.json();
    if (result.length === 0) {
      resultLog.textContent = "一致する棋譜は見つかりませんでした。";
      return;
    }

    const tbody = document.getElementById("result-body");
    tbody.innerHTML = ""; // 前回の結果をクリア
    var winCount = 0;
    var senteWinCount = 0;
    var senteCount = 0;

    result.forEach(linkObj => {
      const tr = document.createElement("tr");

      // 手数
      const tdTe = document.createElement("td");
      tdTe.textContent = linkObj.te;
      tr.appendChild(tdTe);

      // 勝敗
      const tdResult = document.createElement("td");
      tdResult.textContent = linkObj.is_win ? "⭕️" : "✖︎";
      tr.appendChild(tdResult);
      winCount += linkObj.is_win ? 1 : 0;

      // 先手/後手
      const tdSengo = document.createElement("td");
      console.log(linkObj.is_sente);
      tdSengo.textContent = linkObj.is_sente ? "先手" : "後手";
      tr.appendChild(tdSengo);
      senteCount += linkObj.is_sente ? 1 : 0;
      if (linkObj.is_sente && linkObj.is_win) {
        senteWinCount++;
      }

      // 対局開始日時
      const tdDate = document.createElement("td");
      tdDate.textContent = linkObj.started_at.substring(0, 10);
      tr.appendChild(tdDate);

      // リンク
      const tdLink = document.createElement("td");
      const a = document.createElement("a");
      a.href = linkObj.link;
      a.textContent = linkObj.link.split('/').pop();
      a.target = "_blank";
      tdLink.appendChild(a);
      tr.appendChild(tdLink);

      // 行を tbody に追加
      tbody.appendChild(tr);

    });

    // 結果ログに勝率を表示
    const resultLog = document.getElementById("result-log");
    const totalGames = result.length;
    const winRate = totalGames > 0 ? (winCount / totalGames * 100).toFixed(2) : 0;

    // 検索結果: {totalGames} 件
    // {winCount}勝 {totalGames - winCount}敗 (勝率: {winRate}%)
    // 改行を有効にする

    resultLog.textContent = `検索結果: ${totalGames} 件
全て： ${winCount}勝 ${totalGames - winCount}敗 (勝率: ${winRate}%)
先手： ${senteWinCount}勝 ${senteCount - senteWinCount}敗 (勝率: ${(senteCount > 0 ? (senteWinCount / senteCount * 100).toFixed(2) : 0)}%)
後手： ${winCount - senteWinCount}勝 ${totalGames - senteCount - (winCount - senteWinCount)}敗 (勝率: ${(totalGames - senteCount > 0 ? ((winCount - senteWinCount) / (totalGames - senteCount) * 100).toFixed(2) : 0)}%)`
      ;

  } catch (error) {
    console.error("検索リクエスト失敗:", error);
    // const resultLog = document.getElementById("result-log");
    // resultLog.textContent = "エラーが発生しました: " + error.message;
  }

}

["01", "02", "03"].forEach(function (id) {
  document.getElementById("kif-input-" + id).addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      const bytes = new Uint8Array(arrayBuffer);
      const detectedEncoding = Encoding.detect(bytes); // 文字コード自動判別
      const decodedText = Encoding.convert(bytes, {
        to: "UNICODE", // UTF-16（JavaScript内部文字列）
        from: detectedEncoding,
        type: "string"
      });

      embedKifuInIframe(decodedText, id);
    };

    reader.readAsArrayBuffer(file); // バイナリとして読み込む
  });
});


function embedKifuInIframe(kifText, boardId) {
  const iframe = document.getElementById("preview-board-" + boardId);

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8" />
      <title>棋譜ビューア</title>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
      <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
      integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
      <link href="KifPlayer/css/shogistyle.css" rel="stylesheet">
    </head>
    <body>
      <data class="shogiboard" id="kif" value="ryu3001">
        <svg id="board" xmlns="http://www.w3.org/2000/svg" width="450" height="570" viewBox="0, 0, 450, 570"></svg>
        <script type="kif">${kifText}</script>
      </data>
      <script src="https://code.jquery.com/jquery-3.2.1.min.js"></script>
      <script src="./KifPlayer/js/kifPlayer.js"></script>
      <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/snap.svg/0.4.1/snap.svg.js"></script>
    </body>
    </html>
  `;

  iframe.srcdoc = html;
}
