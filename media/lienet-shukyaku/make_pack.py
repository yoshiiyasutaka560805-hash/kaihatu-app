"""投稿用パックを作る（投稿順のフォルダに、素材と投稿文を入れたzip）

  python3 make_pack.py [出力先zip]

投稿文は captions.md の各見出し直後のコードブロックから取る。
文言を直す場所を captions.md 一箇所にしておきたいので、ここには書かない。
"""
import glob, os, re, sys, zipfile

OUT = sys.argv[1] if len(sys.argv) > 1 else "lienet-instagram-pack.zip"

# (投稿番号, フォルダ名, 素材のglob) を投稿順に並べる。順番の根拠は captions.md の「投稿の順番」。
ORDER = [
    ("①", "01_サービス紹介リール",       ["lienet_reel_15s.mp4", "cover_service.jpg"]),
    ("③", "02_サービス紹介カルーセル",   ["carousel_service_*.png"]),
    ("②", "03_人手不足リール",           ["lienet_reel_staffing.mp4", "cover_staffing.jpg"]),
    ("④", "04_名言リール",               ["lienet_reel_meigen.mp4", "cover_meigen.jpg"]),
    ("⑤", "05_落ち込んだ日カルーセル",   ["carousel_ochikomi_*.png"]),
    ("⑦", "06_職場の雰囲気リール",       ["lienet_reel_kankei.mp4", "cover_kankei.jpg"]),
    ("⑥", "07_人間関係カルーセル",       ["carousel_ningen_*.png"]),
]

def captions():
    """captions.md から 投稿番号 -> (見出し, 投稿文) を取る"""
    md = open("captions.md", encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"^## ([①-⑦]) (.+?)$", md, re.M):
        body = md[m.end():]
        fence = re.search(r"```\n(.*?)\n```", body, re.S)
        if fence:
            out[m.group(1)] = (m.group(2).strip(), fence.group(1))
    return out

CAP = captions()
missing = [n for n, _, _ in ORDER if n not in CAP]
if missing:
    sys.exit(f"captions.md に投稿文が見つかりません: {' '.join(missing)}")

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    lines = ["Lienet Instagram 投稿パック", "", "▼ 先にプロフィールを整えてください",
             "  ・プロフィールのリンク: https://line.me/R/ti/p/@724ricln",
             "  ・名前欄: Lienet｜東京の介護転職  ← ここは検索対象です",
             "  ・プロアカウントに切り替え（でないとインサイトが見られません）",
             "", "▼ 投稿の順番（1日1本、間隔をあけて）"]
    for n, folder, pats in ORDER:
        head, text = CAP[n]
        files = sorted(f for p in pats for f in glob.glob(p))
        if not files:
            sys.exit(f"{folder}: 素材が見つかりません {pats}")
        for f in files:
            z.write(f, f"{folder}/{f}")
        z.writestr(f"{folder}/投稿文.txt", text + "\n")
        kind = "カルーセル" if "carousel" in files[0] else "リール"
        lines.append(f"  {folder}/  {kind} {len(files)}点  （{head.split('—')[0].strip()}）")
        print(f"{folder}: {len(files)}点 + 投稿文.txt")
    lines += ["", "▼ 各フォルダの中身",
              "  ・動画 or 画像 … そのままアップロードしてください",
              "  ・cover_*.jpg … リールのカバー画像（投稿時に「カバーを編集」で指定）",
              "  ・投稿文.txt  … 全文コピーして貼ってください。末尾のハッシュタグ5個も含みます",
              "",
              "▼ カルーセルは番号順に選んでください（選んだ順に並びます）",
              "▼ リールに Instagram の音源を足さないでください（音楽は動画に入っています）",
              "",
              "▼ 投稿後、別の端末でプロフィール→リンク→友だち追加まで通してください",
              "   ここが切れていると投稿が無駄になります",
              ""]
    z.writestr("はじめに.txt", "\n".join(lines))

print(f"\n{OUT}  {os.path.getsize(OUT)/1e6:.1f} MB")
