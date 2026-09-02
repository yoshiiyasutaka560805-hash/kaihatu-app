# インスタに上げるまでの手順

素材は完成している。ここから先は**すべて手作業**（Instagram はこの開発環境から接続できないため、
アップロード自体を代行することはできない）。

| 順 | やること | 所要 | 誰が |
|---|---|---|---|
| 0 | 素材を手元に落とす | 5分 | 貴社 |
| 1 | **プロフィールを整える** | 15分 | 貴社 |
| 2 | Canva カルーセルを書き出す | 5分 | 貴社 |
| 3 | 投稿する（3本） | 各5分 | 貴社 |
| 4 | LINE導線を自分でテストする | 3分 | 貴社 |

**1を飛ばさないこと。** 3投稿すべてが「プロフィールのリンクから」で終わるので、
リンクが未設定のまま投稿すると導線が切れたまま拡散します。

---

## 0. 素材を手元に落とす

このリポジトリは**公開設定**なので、ログインなしで直接ダウンロードできます。
スマホのブラウザで開けばそのまま端末に保存できます。

**まとめてほしい場合は `make_pack.py` で1つのzipにできます。**
投稿順のフォルダに素材と `投稿文.txt` を入れた形で出るので、PCならこちらが早いです。

```
python3 make_pack.py lienet-instagram-pack.zip
```

個別に落とす場合は以下から。**スマホのブラウザで開けばそのまま端末に保存できます。**

| 投稿 | ファイル |
|---|---|
| ① サービス紹介リール | [15s.mp4](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/lienet_reel_15s.mp4) ／ [cover_service.jpg](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/cover_service.jpg) |
| ③ サービス紹介カルーセル | [service_01](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_service_01.png) ／ [service_02](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_service_02.png) ／ [service_03](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_service_03.png) ／ [service_04](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_service_04.png) ／ [service_05](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_service_05.png) |
| ② 人手不足リール | [staffing.mp4](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/lienet_reel_staffing.mp4) ／ [cover_staffing.jpg](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/cover_staffing.jpg) |
| ④ 名言リール | [meigen.mp4](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/lienet_reel_meigen.mp4) ／ [cover_meigen.jpg](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/cover_meigen.jpg) |
| ⑤ 落ち込んだ日カルーセル | [ochikomi_01](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ochikomi_01.png) ／ [ochikomi_02](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ochikomi_02.png) ／ [ochikomi_03](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ochikomi_03.png) ／ [ochikomi_04](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ochikomi_04.png) ／ [ochikomi_05](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ochikomi_05.png) ／ [ochikomi_06](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ochikomi_06.png) |
| ⑦ 職場の雰囲気リール | [kankei.mp4](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/lienet_reel_kankei.mp4) ／ [cover_kankei.jpg](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/cover_kankei.jpg) |
| ⑥ 人間関係カルーセル | [ningen_01](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_01.png) ／ [ningen_02](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_02.png) ／ [ningen_03](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_03.png) ／ [ningen_04](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_04.png) ／ [ningen_05](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_05.png) ／ [ningen_06](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_06.png) ／ [ningen_07](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_07.png) ／ [ningen_08](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_08.png) ／ [ningen_09](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/raw/refs/heads/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/carousel_ningen_09.png) |

投稿文の全文は [captions.md](https://github.com/yoshiiyasutaka560805-hash/kaihatu-app/blob/claude/15sec-video-creation-f02oz6/media/lienet-shukyaku/captions.md) にあります。

> 公開リポジトリなので、置いてあるもの（住所・許可番号・LINEのURL）はすべて誰でも見られます。
> いずれも公開情報なので問題はありませんが、非公開にしたい素材はここに置かないでください。

---

## 1. プロフィールを整える（先にやる）

### プロアカウントに切り替える

個人アカウントのままだと**インサイト（保存数・プロフィールアクセス数）が一切見られません。**
反応を見て次の投稿を決められなくなるので、先に切り替えます。

設定 → アカウントの種類とツール → プロアカウントに切り替える → カテゴリ「人材紹介」など

### 名前欄（ここが検索対象）

```
Lienet｜東京の介護転職
```

ユーザーネーム（`lienet441`）とは別に、**名前欄は検索にかかります。**
社名だけにすると「東京 介護 転職」で探している人に当たりません。

### ウェブサイト

```
https://line.me/R/ti/p/@724ricln
```

### 自己紹介文（150字以内）

```
東京の介護のお仕事をご紹介しています
求人票に載らないことまでお伝えします
ご相談・ご紹介は無料／求職者の方から手数料はいただきません
有料職業紹介事業許可 13-ユ-318908
▼ LINEでご相談
```

許可番号は入れてください。**有料職業紹介事業者であることの表示は、信頼の面でも実務の面でも必要です。**

---

## 2. カルーセルを用意する

**リポジトリの `carousel_*.png` を使うなら、この工程は不要です。** 落として選ぶだけで、
QRは埋め込み済み（デコードして確認済み）。以下はCanva版を使う場合の手順です。

デザイン: 「Lienet 求職者向けカルーセル」（5ページ）

1. **5ページ目の枠に `qr_line.png` をドラッグ**
2. 「LINEのQRをここに入れます」という**案内テキストを削除**（消し忘れが一番多い）
3. 右上の共有 → ダウンロード → **PNG**、ページは全5ページを選択
4. 1080×1350 で出ていることを確認

---

## 3. 投稿する

### 3-A. PCのブラウザから（おすすめ）

**動画とキャプションが PC にあるなら、こちらが速いです。**
長い投稿文をスマホで打ち直さずコピペできるのが一番の理由。

`instagram.com` にログイン → 左メニューの「作成」 → ファイルを選択

画面の名称は変わることがあるので、違っていたら近い項目を選んでください。

### 3-B. スマホから

ファイルを Google Drive か iCloud に上げ、端末のカメラロールに保存してから
Instagram の「＋」→ リール／投稿 で選択します。

**リールは音声付きで保存されているか確認してください。** クラウド経由で音声が落ちることはありませんが、
保存後に一度再生して音が出るか見ておくと安全です。

### 各投稿の設定

| 項目 | どうする | なぜ |
|---|---|---|
| **音楽** | **Instagram の音源は足さない** | 動画に焼き込み済み。足すと二重になる |
| カバー | `cover_service.jpg` / `cover_staffing.jpg` を指定、または1.5〜2秒付近のコマ | タイトルが出ているコマ。グリッドで内容が伝わる |
| キャプション | `captions.md` からコピペ | 1行目が検索対象 |
| ハッシュタグ | 5個。**6個以上入れない** | 6個目以降はリンクにならないか、エラーになる |
| 「フィードにも表示」 | オン | プロフィールのグリッドに残る |
| 場所を追加 | 東京都、または港区 | エリアの露出が増える |
| コメント | オンのまま | 質問がそのまま相談の入口になる |
| 代替テキスト（詳細設定） | カルーセルのみ、各ページの文字を入れる | 画像内の文字は検索対象にならないため |

### 音楽についてのトレードオフ

音源を焼き込んでいるので、**Instagram の楽曲ページ経由の流入は取れません。**
そのぶん、スマホのスピーカーで聞こえるように音域を作り直してあります（当初のBGMは
エネルギーの89%が300Hz以下にあり、スマホでは実質無音でした）。
楽曲経由の露出を狙うなら、Instagram の音源を選び直して**動画を無音で書き出す**必要があります。
その場合は言ってください、無音版を出します。

---

## 4. LINE導線を自分でテストする（必ず）

**ここが切れていると、投稿の努力が全部無駄になります。**

自分のアカウント以外（家族の端末など）から、

1. プロフィールを開く
2. リンクをタップ
3. LINE が開き、友だち追加まで進める

を通してください。あわせて**カルーセル5ページ目のQRをカメラで読み取り**、同じ場所に飛ぶか確認します。
QRは生成後にデコードして `https://line.me/R/ti/p/@724ricln` を指すことを確認済みですが、
Canva に貼って書き出したあとに読めるかは実機で見ないと分かりません。

---

## 5. 投稿の順番

| 順 | 投稿 | ハッシュタグ |
|---|---|---|
| 1 | ① サービス紹介リール | `#介護転職 #介護士の転職 #転職したい #東京介護求人 #Lienet` |
| 2 | ③ カルーセル | `#介護士の転職 #転職したい #介護の悩み #東京介護求人 #Lienet` |
| 3 | ② 人手不足リール | `#介護の悩み #夜勤明け #介護転職 #東京介護求人 #Lienet` |

②を最後に回すのは、**これが最もリーチを取るから**です。
先に2本置いておかないと、いちばん届いた回の訪問者が空のプロフィールを見て離脱します。

**1日1本、間隔をあけて**出してください。3本同時に出すと互いにリーチを食い合います。

投稿したら**それぞれストーリーズにもシェア**してください。既存のフォロワーに届き、
プロフィールへのアクセスが増えます。

---

## 6. 投稿後に見る数字

インサイトで見るのは3つだけです。

| 数字 | 何が分かるか |
|---|---|
| **保存数** | 内容が役に立ったか。介護の求職者は「あとで見返す」ので、ここが一番効く |
| **プロフィールへのアクセス** | 興味を持たれたか。**集客の直前の段階なので最重要** |
| リーチのうち「フォロワー以外」の割合 | 新規に届いたか |

**いいね数は見なくていいです。** 相談につながる指標ではありません。

3〜4本出したら、`topic-priority.md` のテーマ順を**自社の実測値で並べ直してください。**
あの順番は「介護職が何に不満か」の統計で並べたもので、
「Instagram でどのテーマが伸びるか」の統計ではありません。実測に置き換えるのが正しい使い方です。

---

## 投稿する時間帯（これは推測です）

**根拠となるデータを持っていません。** 一般に言われる「平日20〜21時」が介護職に当てはまるかは、
シフト勤務が多いぶん怪しいと考えています。候補は、

- 夜勤明けの午前 9〜11時
- 休憩時間 12〜13時
- 退勤後 21〜23時

**3本を別の時間帯に出して、インサイトで確かめるのが一番早いです。**
1本目9〜11時、2本目12〜13時、3本目21〜23時、というように。

---

## つまずきやすいところ

| 症状 | 原因 |
|---|---|
| ハッシュタグが黒い文字のままリンクにならない | 6個以上入れている |
| カルーセルの順番が違う | 選択した順に並ぶ。1枚ずつ順番に選ぶ |
| 5ページ目に案内文が残っている | Canva で消し忘れ。書き出し前に確認 |
| 音が出ない | 端末のマナーモード。リールは無音で始まることがある |
| 動画がぼやける | アップロード時の再圧縮。1080×1920で出しているので元素材の問題ではない |

---

## 投稿前に確定させること（貴社判断）

1. **地名タグの表記** — `#東京介護求人` / `#介護求人東京` / `#東京介護転職` の件数をアプリで見比べ、
   最多の1つに統一。3投稿すべて同じ語に置換すること
2. **「ご相談・ご紹介は無料です／求職者の方から手数料はいただきません」** が実際の運用と合っているか
   （3投稿すべてに入っています）
3. **②の3つの質問**（夜勤人数・有給・募集人数）が、貴社が実際に求職者へ助言している内容と合っているか
4. **介護職限定の文言**で問題ないか（事業内容は人材紹介全般）
