// グローバル変数
var $;

function kifPlayer(args){
    
    if(kifPlayer.引数確認(args) === false){
        return;
    }
    
    // コントローラを表示する
    viewControl();
    
    $ = kifPlayer.SilverState(kifPlayer, kifPlayer.KIF解析(args.kif));
    
    if(args.myname && $.後手名.indexOf(args.myname) === 0){
        args.reverse = true;
    }

    $.手数   = kifPlayer.手数正規化(args.start, $.総手数);
    $.全局面 = kifPlayer.全局面構築($.全指し手, $.初期局面);
    $.data   = {'reverse': args.reverse};
    $.args   = args;
    
    局面描画($);

    return $.$kifPlayer;
}

kifPlayer.スタートアップ = function (event){
    var el = document.querySelectorAll("[type='kif']");
    for(var i = 0; i < el.length; i++){
        kifPlayer({
            el: el[i],
            kif: el[i].textContent,
            start: el[i].getAttribute("start"),
            reverse: el[i].hasAttribute("reverse"),
            comment: el[i].getAttribute("comment"),
            myname: el[i].getAttribute("myname"),
        });
    }
};

kifPlayer.引数確認 = function (args){
    args.kif = args.kif || '';
    args.kif = args.kif.trim();

    if(args.kif.match(/^https?:/) || args.kif.match(/\.kifu?$/i)){
        kifPlayer.引数確認.ファイル取得(args);
        return false;
   }

    if(typeof args.el === 'string'){
        args.el = document.querySelector(args.el);
    }

    args.start   = Number(args.start || 0);
    args.reverse = Boolean(args.reverse);
    args.myname  = String(args.myname);
};

kifPlayer.引数確認.ファイル取得 = function (args){
    var 文字コード = (args.kif.match(/\.kifu$/)) ? 'UTF-8' : 'Shift_JIS';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', args.kif);
    xhr.timeout    = 60 * 1000;
    xhr.onloadend  = loadend;
    xhr.overrideMimeType('text/plain; charset=' + 文字コード);
    xhr.send();

    function loadend(event){
        args.kif = xhr.responseText;
        kifPlayer(args);
    }
};

kifPlayer.手数正規化 = function(手数, 総手数){
    if(!手数 || !総手数){
        return 0;
    }
    if(手数 < 0){
        手数 = 総手数 + 手数 + 1;
    }
    if(手数 > 総手数){
        return 総手数;
    }
    return 手数;
};

kifPlayer.全局面構築 = function(指し手一覧, 初期局面){
    var 全局面 = [];

    for(var i = 0; i < 指し手一覧.length; i++){
        全局面[i] = [初期局面];
        for(var j = 1; j < 指し手一覧[i].length; j++){
            全局面[i].push( kifPlayer.全局面構築.各局面(指し手一覧[i][j], 全局面[i][j-1]) );
        }
    }

    return 全局面;
};

kifPlayer.全局面構築.各局面 = function(指し手, 前局面){
    // 指し手 = {'手数','手番','手','駒','前X','前Y','後X','後Y','成り'};
    
    var 局面 = kifPlayer.オブジェクトコピー(前局面);
    var 手番 = (指し手.手番 === '▲') ? '先手' : '後手';
    var 駒   = 指し手.駒;

    var 成変換 = {'歩':'と', '香':'杏', '桂':'圭', '銀':'全', '角':'馬', '飛':'龍'};
    var 逆変換 = {'と':'歩', '杏':'香', '圭':'桂', '全':'銀', '馬':'角', '龍':'飛'};

    if(指し手.手 === 'パス'){
        return 局面;
    }
    
    if(指し手.手 === '投了'){
        return 局面;
    }

    if(指し手.前X !== 0){ //駒を移動する場合
        局面.駒[指し手.前Y][指し手.前X] = null;

        //駒が成る場合
        if(指し手.成り){
            駒 = (駒 in 成変換) ? 成変換[駒] : 駒;
        }

        //駒を取る場合
        if(局面.駒[指し手.後Y][指し手.後X]){
            var 取った駒 = 局面.駒[指し手.後Y][指し手.後X].replace('_', '');
            取った駒 = (取った駒 in 逆変換) ? 逆変換[取った駒] : 取った駒;
            局面[手番+'の持駒'][取った駒]++;
        }
    }
    else{ //駒を打つ場合
        局面[手番+'の持駒'][駒]--;
    }

    if(手番 === '後手'){
        駒 += '_';
    }

    局面.駒[指し手.後Y][指し手.後X] = 駒;

    return 局面;
};

kifPlayer.KIF解析 = function(kif){
    var 解析結果 = {};
    var 一次解析 = {局面図:[], 解析:[]};

    kif = kif.split(/\r?\n/);

    for(var i = 0; i < kif.length; i++){
        kif[i] = kif[i].trim();
        if(kif[i].indexOf('#') === 0){
            continue;
        }
        else if(kif[i].indexOf('|') === 0){
            一次解析.局面図.push(kif[i]);
        }
        else if(kif[i].indexOf('：') > -1){
            var info = kif[i].split('：'); //手抜き
            一次解析[info[0]] = info[1];
        }
        else if(kif[i].indexOf('**Engines') === 0){
            一次解析.解析済み = true;
        }
        else if(kif[i] === "後手番" || kif[i] === "上手番"){
            一次解析.開始手番 = "後手";
        }
        else if(kif[i] === "先手番" || kif[i] === "下手番"){
            一次解析.開始手番 = "先手";
        }
        else if(kif[i].match(/手数＝\d/)){
            一次解析.最終手 = kif[i];
        }
        else if(kif[i].match(/^[1\*]/)){
            一次解析.指し手 = kif.slice(i);
            break;
        }
    }

    解析結果.先手名   = 一次解析.先手 || 一次解析.下手 || '';
    解析結果.後手名   = 一次解析.後手 || 一次解析.上手 || '';
    解析結果.開始手番 = kifPlayer.KIF解析.開始手番(一次解析.開始手番, 一次解析.手合割);
    解析結果.最終手   = kifPlayer.KIF解析.最終手(一次解析.最終手);
    解析結果.手合割   = kifPlayer.KIF解析.手合割(一次解析.手合割);
    解析結果.評価値   = (一次解析.解析済み)  ?  kifPlayer.KIF解析.評価値(一次解析.指し手)  :  [];
    解析結果.読み筋   = (一次解析.解析済み)  ?  kifPlayer.KIF解析.読み筋(一次解析.指し手)  :  ['-'];
    解析結果.初期局面 = {
        '駒'        : kifPlayer.KIF解析.局面図(一次解析.局面図, 解析結果.手合割),
        '先手の持駒': kifPlayer.KIF解析.持駒(一次解析.先手の持駒 || 一次解析.下手の持駒),
        '後手の持駒': kifPlayer.KIF解析.持駒(一次解析.後手の持駒 || 一次解析.上手の持駒),
    };
    解析結果.全指し手 = kifPlayer.KIF解析.指し手(一次解析.指し手, 解析結果.開始手番);
    解析結果.総手数   = 解析結果.全指し手[0].length - 1;
    解析結果.変化     = 0;

    return 解析結果;
};

kifPlayer.KIF解析.開始手番 = function (kif開始手番, kif手合割){
    if(kif開始手番){
        return kif開始手番;
    }
    if(kif手合割 && kif手合割 !== "平手"){
        return "後手";
    }
    return "先手";
};

kifPlayer.KIF解析.最終手 = function(最終手){
    if(!最終手){
        return;
    }
    var 解析   = 最終手.match(/([１２３４５６７８９])(.)/);
    var 全数字 = {'１':'1', '２':'2', '３':'3', '４':'4', '５':'5', '６':'6', '７':'7', '８':'8', '９':'9'};
    var 漢数字 = {'一':'1', '二':'2', '三':'3', '四':'4', '五':'5', '六':'6', '七':'7', '八':'8', '九':'9'};

    return 全数字[解析[1]] + 漢数字[解析[2]];
};

kifPlayer.KIF解析.手合割 = function(kif手合割){
    var 手合割 = ["香落ち", "右香落ち", "角落ち", "飛車落ち", "飛香落ち", "二枚落ち", "三枚落ち", "四枚落ち", "五枚落ち", "左五枚落ち", "六枚落ち", "八枚落ち", "十枚落ち", "その他"];
    return (手合割.indexOf(kif手合割) >= 0)  ?  kif手合割  :  null; // "平手"はnullになる
};

kifPlayer.KIF解析.局面図 = function(kif局面図, 手合割){
    if(kif局面図.length !== 9){
        return (手合割)  ?  kifPlayer.KIF解析.局面図.手合割(手合割)  :  kifPlayer.KIF解析.局面図.平手();
    }

    var 局面 = kifPlayer.KIF解析.局面図.駒無し();
    var 先手 = true;
    var x    = 10;
    var 変換 = {'王':'玉', '竜':'龍'};

    for(var y = 0; y < 9; y++){
        x = 10;
        var str = kif局面図[y];
        for(var i = 1; i < str.length; i++){
            if(str[i] === ' '){
                先手 = true;
                x -= 1;
                continue;
            }
            else if(str[i] === 'v'){
                先手 = false;
                x -= 1;
                continue;
            }
            else if(str[i] === '|'){
                break;
            }
            else if(str[i] === '・'){
                continue;
            }
            
            var 駒 = str[i];
            駒 = (駒 in 変換) ? 変換[駒] : 駒;

            局面[y+1][x] = (先手) ?  駒 : 駒 + '_';
        }
    }

    return 局面;
};

kifPlayer.KIF解析.局面図.平手 = function(){
    return {
        '1': {'9': '香_', '8': '桂_', '7': '銀_', '6': '金_', '5': '玉_', '4': '金_', '3': '銀_', '2': '桂_', '1': '香_'},
        '2': {'9': null, '8': '飛_', '7': null, '6': null, '5': null, '4': null, '3': null, '2': '角_', '1': null},
        '3': {'9': '歩_', '8': '歩_', '7': '歩_', '6': '歩_', '5': '歩_', '4': '歩_', '3': '歩_', '2': '歩_', '1': '歩_'},
        '4': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '5': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '6': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '7': {'9': '歩', '8': '歩', '7': '歩', '6': '歩', '5': '歩', '4': '歩', '3': '歩', '2': '歩', '1': '歩'},
        '8': {'9': null, '8': '角', '7': null, '6': null, '5': null, '4': null, '3': null, '2': '飛', '1': null},
        '9': {'9': '香', '8': '桂', '7': '銀', '6': '金', '5': '玉', '4': '金', '3': '銀', '2': '桂', '1': '香'},
    };
};

kifPlayer.KIF解析.局面図.駒無し = function() {
    return {
        '1': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '2': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '3': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '4': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '5': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '6': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '7': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '8': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
        '9': {'9': null, '8': null, '7': null, '6': null, '5': null, '4': null, '3': null, '2': null, '1': null},
    };
};

kifPlayer.KIF解析.局面図.手合割 = function(手合割) {
    var 局面 = kifPlayer.KIF解析.局面図.平手();

    if(手合割 === "香落ち"){
        局面[1][1] = null;
    }
    else if(手合割 === "右香落ち"){
        局面[1][9] = null;
    }
    else if(手合割 === "角落ち"){
        局面[2][2] = null;
    }
    else if(手合割 === "飛車落ち"){
        局面[2][8] = null;
    }
    else if(手合割 === "飛香落ち"){
        局面[1][1] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "二枚落ち"){
        局面[2][2] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "三枚落ち"){
        局面[1][1] = null;
        局面[2][2] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "四枚落ち"){
        局面[1][1] = null;
        局面[1][9] = null;
        局面[2][2] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "五枚落ち"){
        局面[1][1] = null;
        局面[1][2] = null;
        局面[1][9] = null;
        局面[2][2] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "左五枚落ち"){
        局面[1][1] = null;
        局面[1][8] = null;
        局面[1][9] = null;
        局面[2][2] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "六枚落ち"){
        局面[1][1] = null;
        局面[1][2] = null;
        局面[1][8] = null;
        局面[1][9] = null;
        局面[2][2] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "八枚落ち"){
        局面[1][1] = null;
        局面[1][2] = null;
        局面[1][3] = null;
        局面[1][7] = null;
        局面[1][8] = null;
        局面[1][9] = null;
        局面[2][2] = null;
        局面[2][8] = null;
    }
    else if(手合割 === "十枚落ち"){
        局面[1][1] = null;
        局面[1][2] = null;
        局面[1][3] = null;
        局面[1][4] = null;
        局面[1][6] = null;
        局面[1][7] = null;
        局面[1][8] = null;
        局面[1][9] = null;
        局面[2][2] = null;
        局面[2][8] = null;
    }

    return 局面;
};

kifPlayer.KIF解析.持駒 = function(kif持駒){
    var 持駒 = {'歩': 0, '香': 0, '桂': 0, '銀': 0, '金': 0, '飛': 0, '角': 0};

    if(kif持駒 === undefined || kif持駒.match('なし')){
        return 持駒;
    }

    var 漢数字 = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '十一':11, '十二':12, '十三':13, '十四':14, '十五':15, '十六':16, '十七':17, '十八':18};
    var str    = kif持駒.split(/\s/);

    for(var i = 0; i < str.length; i++){
        var 駒 = str[i][0];
        var 数 = str[i][1];

        if(駒 in 持駒){
            持駒[駒] = (数) ? 漢数字[数] : 1;
        }
    }

    return 持駒;
};

kifPlayer.KIF解析.指し手 = function (kif, 開始手番){
    var 全指し手 = [[{手数:0, コメント:''}]];
    var 手数     = 0;
    var 変化     = 0;

    全指し手.変化手数 = [];
    if(!kif){
        return 全指し手;
    }

    for(var i = 0; i < kif.length; i++){
        kif[i] = kif[i].trim();

        if(kif[i].indexOf('*') === 0 && 全指し手[変化][手数]){ //指し手コメント
            全指し手[変化][手数].コメント += kif[i].replace(/^\*/, '') + '\n';
        }
        else if(kif[i].match(/^\d/)){
            手数++;
            kifPlayer.KIF解析.指し手.現在の手(全指し手[変化], kif[i], 手数, 開始手番);
        }
        else if(kif[i].indexOf('変化：') === 0){
            手数 = Number(kif[i].match(/変化：(\d+)/)[1]);
            全指し手.push(全指し手[0].slice(0, 手数));
            全指し手.変化手数.push(手数);
            手数--;
            変化++;
        }
    }
    
    return 全指し手;
};

kifPlayer.KIF解析.指し手.現在の手 = function(全指し手, kif, 手数, 開始手番){
    var 全数字   = {'１':1, '２':2, '３':3, '４':4, '５':5, '６':6, '７':7, '８':8, '９':9};
    var 漢数字   = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9};
    var 終局表記 = ['中断', '投了', '持将棋', '千日手', '詰み', '切れ負け', '反則勝ち', '反則負け', '入玉勝ち'];

    var 手番     = (開始手番 === '先手' && 手数 % 2 === 1) ? '▲' : '△';
    var 現在の手 = kif.split(/ +/)[1] || '';
    var 解析     = 現在の手.match(/([１-９同])([一二三四五六七八九　])([^\(]+)(\((\d)(\d)\))?/);

    if(解析){
        全指し手.push({
            '手数': 手数,
            '手番': 手番,
            '手'  : 解析[0],
            '駒'  : 解析[3].replace(/[打成]$/, '').replace('成銀', '全').replace('成桂', '圭').replace('成香', '杏').replace('王', '玉').replace('竜', '龍'),
            '前X' : Number(解析[5] || 0),
            '前Y' : Number(解析[6] || 0),
            '後X' : (解析[1] === '同') ? 全指し手[手数-1].後X : 全数字[解析[1]],
            '後Y' : (解析[1] === '同') ? 全指し手[手数-1].後Y : 漢数字[解析[2]],
            '成り': /成$/.test(解析[3]),
            'コメント': '',
        });
    }
    else if(現在の手 === 'パス'){
        全指し手.push({'手数':手数, '手番':手番, '手':'パス', '駒':'', '前X':0, '前Y':0, '後X':0, '後Y':0, '成り':false, 'コメント':''});
    }
    else if(現在の手 === '投了'){
        全指し手.push({'手数':手数, '手番':手番, '手':'投了', '駒':'', '前X':0, '前Y':0, '後X':0, '後Y':0, '成り':false, 'コメント':''});
    }
    else if(終局表記.indexOf(現在の手) >= 0){
        全指し手.勝敗 = kifPlayer.KIF解析.指し手.勝敗(現在の手, 手番);
    }
};

kifPlayer.KIF解析.指し手.勝敗 = function (理由, 手番){
    var 結果 = {'勝者':'', '敗者':'', '理由':理由, '表記':''};

    if(理由 === '投了' || 理由 === '詰み' || 理由 === '切れ負け' || 理由 === '反則負け'){
        結果.勝者 = (手番 === '▲') ? '△' : '▲';
        結果.敗者 = (手番 === '▲') ? '▲' : '△';
        結果.表記 = 結果.敗者 + 理由 + 'で' + 結果.勝者 + 'の勝ち';
    }
    else if(理由 === '反則勝ち' || 理由 === '入玉勝ち'){
        結果.勝者 = (手番 === '▲') ? '▲' : '△';
        結果.敗者 = (手番 === '▲') ? '△' : '▲';
        結果.表記 = 結果.勝者 + 理由;
    }
    else if(理由 === '持将棋' || 理由 === '千日手'){
        結果.勝者 = 結果.敗者 = '引き分け';
        結果.表記 = 理由 + 'で引き分け';
    }
    else if(理由 === '中断'){
        結果.表記 = 理由;
    }

    return 結果;
};

kifPlayer.KIF解析.評価値 = function (kif指し手){
    var 評価値 = [];

    for(var i = 0; i < kif指し手.length; i++){
        if(kif指し手[i].indexOf('**解析 0 ') !== 0){
            continue;
        }
        評価値.push(kif指し手[i].match(/評価値 (\S+)/)[1].replace(/↓|↑/, ''));
    }

    return 評価値;
};

kifPlayer.KIF解析.読み筋 = function (kif指し手){
    var 全読み筋 = ['-'];

    for(var i = 0; i < kif指し手.length; i++){
        if(kif指し手[i].indexOf('**解析 0 ') !== 0){
            continue;
        }
    }

    return 全読み筋;
};

kifPlayer.SilverState = function(app, $){
    $ = $ || {};

    //プロパティ登録
    for(var name in app){
    	
        if(name.indexOf('$') !== 0){
            continue;
        }
        
        var pos = name.lastIndexOf('_');
        if(pos === -1){
            $[name] = (typeof app[name] === 'function') ? app[name].bind($) : app[name];
        }
        else{
            var $id  = name.substring(0, pos);
            var prop = name.substring(pos+1);

            if(!($id in $)){
                $[$id] = {};
            }
            $[$id][prop] = (typeof app[name] === 'function')  ?  app[name].bind($)  :  app[name];
        }
    }

    return $;
};

kifPlayer.オブジェクトコピー = function(from){
    var to = Array.isArray(from) ? [] : {};
    for(var key in from){
        to[key] = (from[key] instanceof Object)  ?  kifPlayer.オブジェクトコピー(from[key])  :  from[key];
    }
    return to;
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', kifPlayer.スタートアップ);
} else {
	kifPlayer.スタートアップ();
}

function 局面描画($) {
    
    var 手数   = $.手数;
    var 局面   = $.全局面[$.変化][手数];
    var 指し手 = $.全指し手[$.変化][手数];
    var 反転   = $.data.reverse;
    var 先手   = (反転) ? '後手' : '先手';
    var 後手   = (反転) ? '先手' : '後手';
    
    var 指し手文言;
    if (指し手.手数 == 0) {
        指し手文言 = '開始局面';
    } else {
        指し手文言 = 指し手.手数 + '手目  ' + 指し手.手番 + 指し手.手;
    }
    
    //将棋盤クリア
    var piece = Snap('#board');
    piece.clear();
    
    //将棋盤描画
    将棋盤描画($.先手名, $.後手名, $.評価値[手数], 反転, 指し手.手);
    
    piece.g().text(25, 550, 指し手文言 ).attr({
            fontSize: 17,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            textAnchor: "centsr",
        });
        	
    player = {
        black: {
            koma: piece.g().transform("translate(25, 520)"),
            capture: new Array(),
        },
        white: {
            koma: piece.g().transform("translate(25, 73)"),
            capture: new Array(),
        },
    };
    
    //先手持駒配置
    var 先手持駒 = '';
    for(var 駒 in 局面.先手の持駒){
        if (局面.先手の持駒[駒] != 0) {
            if (先手持駒 != '') {
                先手持駒 += ' ';
            }
            先手持駒 += 駒 + 局面.先手の持駒[駒];
        }
    }
    if (先手持駒 == '') {
        先手持駒 = 'なし';
    }
    
    //後手持駒配置
    var 後手持駒 = '';
    for(var 駒 in 局面.後手の持駒){
        if (局面.後手の持駒[駒] != 0) {
            if (後手持駒 != '') {
                後手持駒 += ' ';
            }
            後手持駒 += 駒 + 局面.後手の持駒[駒];
        }
    }
    if (後手持駒 == '') {
        後手持駒 = 'なし';
    }
    
    var 上持駒 = 後手持駒;
    var 下持駒 = 先手持駒;
    if (反転) {
        上持駒 = 先手持駒;
        下持駒 = 後手持駒;
    }
    
    // 持ち駒情報表示
    var size =21;
    player.black.koma.text(0, 0, 下持駒).attr({
            fontSize: size,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            textAnchor: "left",
        });
        
    player.white.koma.text(0, 0, 上持駒).attr({
            fontSize: size,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            textAnchor: "left",
        });
        
    //駒配置 -start-
    for(var y in 局面.駒){
        for(var x in 局面.駒[y]){
            if(局面.駒[y][x]){
                var 指し手黒表示 = false;
                if ((x == 指し手.後X) && (y == 指し手.後Y)) {
                    指し手黒表示 = true;
                }
                駒描画(局面.駒[y][x], x, y, 指し手黒表示, 反転);
            }
        }
    }
    //駒配置 -end-
    
}

function 駒描画(駒, x, y, 指し手黒表示, 反転){
    
    //筋を反転
    x = 10 - x;
    
    if(反転){
        x = 10 - x;
        y = 10 - y;
        駒 = (駒.match('_'))  ?  駒.replace('_', '')  :  駒 + '_';
    }

    var piece = Snap("#board").g();
    var 文字 = 駒;
    if (駒.match('_')) {
        文字 = 駒.replace('_', '');
    }
    
    var 筋 = (40 * x) - 40 + 42;
    var 段 = (40 * y) - 40 + 114;
    
    if (指し手黒表示) {
        piece.g().rect(筋 - 20, 段 - 16, 40, 40).attr({
            fill: "#111111",
            });
    }
    
    var masu;
    if (駒.match('_')) {
    	//後手
    	masu = piece.g().transform(`translate(${筋}, ${段 + 8}) scale(-1, -1)`);
    } else {
    	//先手
    	masu = piece.g().transform(`translate(${筋}, ${段})`);
    }
    
    if (指し手黒表示) {
        //差し手
        masu.text(0, 0, 文字).attr({
                textAnchor: "middle",
                fill: "#FFFFFF",
                dy: 16,
                fontSize: 31,
                fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            });
    } else {
        //差し手以外
        masu.text(0, 0, 文字).attr({
                textAnchor: "middle",
                fill: "#000000",
                dy: 16,
                fontSize: 31,
                fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            });
    }
}

// 以下、出力されたJSONを読み込むところ
function 将棋盤描画(先手名, 後手名, 評価値, 反転, 指し手) {

    var board = Snap("#board").g();
    //外枠色のみ
    board.rect(10, 78, 395, 390).attr({
        "touch-action": "manipulation",
        fill: "#FFE084",
    });
    //外枠色のみ
    board.rect(22, 37 + 60, 360, 360).attr({
        id:'ban',
        fill: "#FFE084",
        stroke: "#000000",
        strokeWidth: 3,
    });
    
    if (先手名 == '') {
        先手名 = '先手'
    }
    if (後手名 == '') {
        後手名 = '後手'
    }
    
    var 上名称 = '△' + 後手名;
    var 下名称 = '▲' + 先手名;
    if (反転) {
        上名称 = '▲' + 先手名;
        下名称 = '△' + 後手名;
    }
    
    var size = 22;
    board.text(20, 43, 上名称).attr({
            fontSize: size,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            textAnchor: "left",
        });
    board.text(20, 490, 下名称).attr({
            fontSize: size,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            textAnchor: "left",
        });
    
    //評価値を表示
    var 評価値文言 = '評価値  -';
    if ((指し手 !== undefined) && (指し手 !== '投了') && (評価値 !== undefined)) {
        var 情勢 = '';
        if (評価値.match('詰')) {
            情勢 = '勝勢';
        } else {
            var 評価値数値;
            評価値数値 = 評価値.replace('-', '');
            if ((0 <= 評価値数値) && (評価値数値 <= 300)) {
                情勢 = '互角';
            } else if ((301 <= 評価値数値) && (評価値数値 <= 800)) {
                情勢 = '有利';
            } else if ((801 <= 評価値数値) && (評価値数値 <= 1500)) {
                情勢 = '優勢';
            } else if (1501 <= 評価値数値) {
                情勢 = '勝勢';
            } else {
                情勢 = '';
            }
        }
        
        var 先手後手;
        if (評価値.match('-')) {
            先手後手 = '△後手';
        } else {
            先手後手 = '▲先手';
        }
        if (情勢 == '互角') {
            先手後手 = '';
        }
        評価値文言 = '評価値  ' + 先手後手 + 情勢 + '(' + 評価値 + ')';
    }
    
    var 評価値文言サイズ = 17;

    board.text(225, 550, 評価値文言).attr({
            fontSize: 評価値文言サイズ,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            textAnchor: "left",
        });
        
    // 将棋盤を表示
    var text_n = new Array("１", "２", "３", "４", "５", "６", "７", "８", "９");
    var text_k = new Array("一", "二", "三", "四", "五", "六", "七", "八", "九");
    if (反転) {
        text_n = new Array("９", "８", "７", "６", "５", "４", "３", "２", "１");
        text_k = new Array("九", "八", "七", "六", "五", "四", "三", "二", "一");
    }
    for (var i = 0; i <= 8; i++) {
    	//筋
        board.text(362 - 40 * i, 93, text_n[i]).attr({
            fontSize: 14,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            "font-weight": "bold",
            textAnchor: "middle",
        });
        //段
        board.text(393, 120 + 40 * i, text_k[i]).attr({
            fontSize: 14,
            fontFamily: "游明朝, YuMincho, ヒラギノ明朝 ProN W3, Hiragino Mincho ProN, ＭＳ Ｐ明朝, MS Mincho, serif",
            "font-weight": "bold",
            textAnchor: "middle",
        });
    }
    for (var i = 1; i <= 8; i++) {
    	//縦線
        board.line(22 + 40 * i, 97.5, 22 + 40 * i, 360 + 97.5).attr({
            strokeWidth: 1,
            stroke: "#000000"
        });
        //横線
        board.line(22, 97.5 + 40 * i, 380 , 97.5 + 40 * i).attr({
            strokeWidth: 1,
            stroke: "#000000"
        });
    }
    
}

// コントロールボタン作成
function viewControl() {
    $(".shogiboard").append('<ul class="center-block">');
    $('ul').append('<li class="material-icons ctlbtn" onclick="first()">first_page</li>');
    $('ul').append('<li class="material-icons ctlbtn" onclick="prev()">chevron_left</li>');
    $('ul').append('<li class="material-icons ctlbtn" onclick="next()">chevron_right</li>');
    $('ul').append('<li class="material-icons ctlbtn" onclick="last()">last_page</li>');
    $('ul').append('<li class="material-icons ctlbtn " onclick="reverse()">autorenew</li>');
    $('ul').wrap('<div class="control" />');
}

var isDo = false;
$(document).on('touchend', '#board', function(event) {
    if (isDo) {
        event.preventDefault();
    } else {

        isDo = true;

        var ele = document.querySelector('#board');
        var eleBan = document.querySelector('#ban');
        var rect = ele.getBoundingClientRect();
        var rectBan = eleBan.getBoundingClientRect();
    
        if ((rectBan.y <= event.clientY) && (event.clientY <= rectBan.y + rectBan.height)) {
            if ((rectBan.x <= event.clientY) && (event.clientX <= rectBan.x + rectBan.width)) {
                if (event.clientX - rectBan.left < rectBan.width / 2) {
                    //1手戻るアイコンクリック関数
                    prev();
                } else {
                    //1手進むアイコンクリック関数
                    next();
                }
            }
        }

        isDo = false;
    }
});

//盤クリック関数
$(document).on('click', '#board', function (event) {
    
    var ele = document.querySelector('#board');
    var eleBan = document.querySelector('#ban');
    var rect = ele.getBoundingClientRect();
    var rectBan = eleBan.getBoundingClientRect();
    
    if ((rectBan.y <= event.clientY) && (event.clientY <= rectBan.y + rectBan.height)) {
        if ((rectBan.x <= event.clientY) && (event.clientX <= rectBan.x + rectBan.width)) {
            if (event.clientX - rectBan.left < rectBan.width / 2) {
                //1手戻るアイコンクリック関数
                prev();
            } else {
                //1手進むアイコンクリック関数
                next();
            }
        }
    }
    
});

//開始局面アイコンクリック関数
function first() {
    $.手数 = 0;
    局面描画($);
}

//1手戻るアイコンクリック関数
function prev() {
    if ($.手数 > 0){
        $.手数--;
        局面描画($);
    }
}

//1手進むアイコンクリック関数
function next() {
    if($.手数 < $.総手数){
        $.手数++;
        局面描画($);
    }
}

//最終局面アイコンクリック関数
function last() {
    $.手数 = $.総手数;
    局面描画($);
}

//反転アイコンクリック関数
function reverse() {
    $.data.reverse = !$.data.reverse;
    局面描画($);
}
