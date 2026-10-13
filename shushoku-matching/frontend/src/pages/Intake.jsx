import React, { useEffect, useState } from 'react';
import { post } from '../api/client';

// 求職者本人が事務所のPC・タブレットで入力する受付フォーム（サイドメニューなし・多言語）
// ・送信内容は承認待ちの下書きになり、担当者が確認して登録する（POST /intake）
// ・送るキーは backend/routes/intake.js の INTAKE_FIELDS に限る。選択肢の値は日本語で送る
// ・本籍・宗教・家族の職業など、職業紹介に不要な情報は聞かない

const LANGS = [
  { code: 'ja', label: '日本語' },
  { code: 'easy_ja', label: 'やさしい にほんご' },
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'ne', label: 'नेपाली' },
  { code: 'my', label: 'မြန်မာ' },
  { code: 'zh', label: '中文' },
];
const IDX = { ja: 0, easy_ja: 1, en: 2, vi: 3, id: 4, ne: 5, my: 6, zh: 7 };
const HTML_LANG = { ja: 'ja', easy_ja: 'ja', en: 'en', vi: 'vi', id: 'id', ne: 'ne', my: 'my', zh: 'zh-Hans' };

// 文言辞書：[ja, easy_ja, en, vi, id, ne, my, zh]
const T = {
  title: ['求職申込 受付フォーム', 'しごとの もうしこみ', 'Job Application Form', 'Phiếu đăng ký tìm việc', 'Formulir Pendaftaran Pencari Kerja', 'रोजगार आवेदन फारम', 'အလုပ်လျှောက်လွှာ ဖောင်', '求职登记表'],
  langPick: ['言語を選んでください', 'ことばを えらんで ください', 'Choose your language', 'Chọn ngôn ngữ', 'Pilih bahasa', 'भाषा छान्नुहोस्', 'ဘာသာစကား ရွေးပါ', '请选择语言'],
  intro: [
    '分かる範囲で入力してください。分からない項目は空欄でかまいません（後で担当者が確認します）。「*」は必須です。',
    'わかる ところだけ かいて ください。わからない ところは かかなくても いいです。「*」は かならず かいて ください。',
    'Please fill in what you can. You may leave items blank if you are not sure — a staff member will check with you later. Items marked * are required.',
    'Vui lòng điền những gì bạn biết. Có thể để trống mục bạn không rõ — nhân viên sẽ xác nhận lại sau. Mục có dấu * là bắt buộc.',
    'Silakan isi sebisanya. Bagian yang tidak Anda ketahui boleh dikosongkan — petugas akan memeriksanya nanti. Bagian bertanda * wajib diisi.',
    'थाहा भएसम्म भर्नुहोस्। थाहा नभएको ठाउँ खाली छोड्न सक्नुहुन्छ — पछि कर्मचारीले सोध्नुहुनेछ। * चिन्ह भएको अनिवार्य हो।',
    'သိသလောက် ဖြည့်ပါ။ မသိသော အကွက်များကို ကွက်လပ်ထားခဲ့နိုင်ပါသည် — နောက်မှ ဝန်ထမ်းက စစ်ဆေးပါမည်။ * ပါသော အကွက်များကို မဖြစ်မနေ ဖြည့်ရပါမည်။',
    '请尽量填写。不清楚的项目可以空着，稍后由工作人员确认。带 * 的为必填项。',
  ],
  s_basic: ['基本情報', 'あなたの こと', 'Basic information', 'Thông tin cơ bản', 'Informasi dasar', 'आधारभूत जानकारी', 'အခြေခံ အချက်အလက်', '基本信息'],
  s_area: ['住まい・通勤', 'すんでいる ところ・かよいかた', 'Residence and commuting', 'Nơi ở và đi lại', 'Tempat tinggal dan perjalanan kerja', 'बसोबास र आवतजावत', 'နေထိုင်ရာနှင့် အလုပ်သွားလာမှု', '住址与通勤'],
  s_job: ['希望の仕事', 'したい しごと', 'Desired job', 'Công việc mong muốn', 'Pekerjaan yang diinginkan', 'चाहेको काम', 'လုပ်ချင်သော အလုပ်', '希望的工作'],
  s_time: ['働ける日・時間', 'はたらける ひ・じかん', 'Available days and hours', 'Ngày và giờ có thể làm', 'Hari dan jam kerja', 'काम गर्न सकिने दिन र समय', 'အလုပ်လုပ်နိုင်သော ရက်နှင့် အချိန်', '可工作的日期与时间'],
  s_skill: ['資格・経験', 'しかく・けいけん', 'Qualifications and experience', 'Bằng cấp và kinh nghiệm', 'Kualifikasi dan pengalaman', 'योग्यता र अनुभव', 'အရည်အချင်းနှင့် အတွေ့အကြုံ', '资格与经验'],
  s_foreign: ['国籍・在留資格・日本語', 'こくせき・ざいりゅう しかく・にほんご', 'Nationality, residence status and Japanese', 'Quốc tịch, tư cách lưu trú và tiếng Nhật', 'Kewarganegaraan, status izin tinggal dan bahasa Jepang', 'राष्ट्रियता, बसोबास अनुमति र जापानी भाषा', 'နိုင်ငံသား၊ နေထိုင်ခွင့်နှင့် ဂျပန်ဘာသာ', '国籍・在留资格・日语'],
  s_consent: ['個人情報の取扱い', 'じょうほうの つかいかた', 'Handling of personal information', 'Xử lý thông tin cá nhân', 'Penanganan informasi pribadi', 'व्यक्तिगत जानकारीको प्रयोग', 'ကိုယ်ရေးအချက်အလက် ကိုင်တွယ်ပုံ', '个人信息的处理'],

  name: ['氏名', 'なまえ', 'Full name', 'Họ và tên', 'Nama lengkap', 'पूरा नाम', 'အမည်', '姓名'],
  name_hint: ['外国籍の方は在留カードと同じ表記で', 'がいこくの ひとは ざいりゅうカードと おなじ かきかた', 'As shown on your residence card or passport', 'Ghi giống thẻ lưu trú hoặc hộ chiếu', 'Sesuai kartu izin tinggal atau paspor', 'निवास कार्ड वा राहदानीमा जस्तै', 'နေထိုင်ခွင့်ကတ် သို့မဟုတ် ပတ်စ်ပို့တွင် ပါသည့်အတိုင်း', '与在留卡或护照上的写法一致'],
  kana: ['フリガナ（読み方）', 'なまえの よみかた（カタカナ）', 'How to read your name (in katakana, if you can)', 'Cách đọc tên (bằng katakana nếu được)', 'Cara baca nama (dalam katakana, jika bisa)', 'नामको उच्चारण (सके काताकानामा)', 'အမည် အသံထွက် (ဖြစ်နိုင်လျှင် ခါတခါနဖြင့်)', '姓名读音（如可以请用片假名）'],
  phone: ['電話番号', 'でんわ ばんごう', 'Phone number', 'Số điện thoại', 'Nomor telepon', 'फोन नम्बर', 'ဖုန်းနံပါတ်', '电话号码'],
  email: ['メールアドレス', 'メール', 'Email address', 'Địa chỉ email', 'Alamat email', 'इमेल ठेगाना', 'အီးမေးလ် လိပ်စာ', '电子邮箱'],
  address: ['住所', 'じゅうしょ', 'Address', 'Địa chỉ', 'Alamat', 'ठेगाना', 'လိပ်စာ', '住址'],
  birth: ['生年月日', 'うまれた ひ', 'Date of birth', 'Ngày sinh', 'Tanggal lahir', 'जन्म मिति', 'မွေးသက္ကရာဇ်', '出生日期'],

  pref: ['都道府県', 'すんでいる けん（とどうふけん）', 'Prefecture', 'Tỉnh (todofuken)', 'Prefektur', 'प्रिफेक्चर', 'ခရိုင် (Prefecture)', '都道府县'],
  city: ['市区町村', 'すんでいる まち（し・く・ちょう・そん）', 'City / ward / town', 'Thành phố / quận / thị trấn', 'Kota / distrik', 'सहर / वडा / नगर', 'မြို့ / ရပ်ကွက်', '市区町村'],
  station: ['最寄り駅', 'ちかくの えき', 'Nearest station', 'Ga gần nhất', 'Stasiun terdekat', 'नजिकको स्टेसन', 'အနီးဆုံး ဘူတာ', '最近的车站'],
  transport: ['通勤手段（複数可）', 'かよいかた（いくつでも）', 'How you will commute (choose all that apply)', 'Phương tiện đi làm (có thể chọn nhiều)', 'Cara pergi kerja (boleh pilih lebih dari satu)', 'आवतजावतको साधन (एकभन्दा बढी छान्न सकिन्छ)', 'သွားလာမည့်နည်း (တစ်ခုထက်ပို ရွေးနိုင်)', '通勤方式（可多选）'],
  commute: ['通勤時間の上限（片道）', 'かよう じかん（いちばん ながくて）', 'Maximum commuting time (one way)', 'Thời gian đi làm tối đa (một chiều)', 'Waktu perjalanan maksimal (sekali jalan)', 'अधिकतम आवतजावत समय (एकतर्फी)', 'အများဆုံး သွားလာချိန် (တစ်ကြောင်း)', '最长通勤时间（单程）'],
  minutes: ['分以内', 'ぷん まで', 'minutes or less', 'phút trở xuống', 'menit atau kurang', 'मिनेटभित्र', 'မိနစ်အတွင်း', '分钟以内'],

  jobs: ['希望の仕事（複数可）', 'したい しごと（いくつでも）', 'Desired job (choose all that apply)', 'Công việc mong muốn (có thể chọn nhiều)', 'Pekerjaan yang diinginkan (boleh pilih lebih dari satu)', 'चाहेको काम (एकभन्दा बढी छान्न सकिन्छ)', 'လုပ်ချင်သော အလုပ် (တစ်ခုထက်ပို ရွေးနိုင်)', '希望的工作（可多选）'],
  facility: ['希望の施設（複数可）', 'はたらきたい ところ（いくつでも）', 'Preferred type of workplace (choose all that apply)', 'Loại nơi làm việc mong muốn (có thể chọn nhiều)', 'Jenis tempat kerja yang diinginkan (boleh pilih lebih dari satu)', 'चाहेको कार्यस्थलको प्रकार (एकभन्दा बढी छान्न सकिन्छ)', 'လုပ်ချင်သော လုပ်ငန်းခွင် အမျိုးအစား (တစ်ခုထက်ပို ရွေးနိုင်)', '希望的工作机构（可多选）'],
  employment: ['雇用形態（複数可）', 'はたらきかた（いくつでも）', 'Employment type (choose all that apply)', 'Hình thức làm việc (có thể chọn nhiều)', 'Jenis pekerjaan (boleh pilih lebih dari satu)', 'रोजगारीको प्रकार (एकभन्दा बढी छान्न सकिन्छ)', 'အလုပ်အကိုင် အမျိုးအစား (တစ်ခုထက်ပို ရွေးနိုင်)', '雇佣形式（可多选）'],
  wage: ['希望の賃金（最低）', 'ほしい きゅうりょう（いちばん ひくくて）', 'Desired minimum pay', 'Mức lương mong muốn tối thiểu', 'Gaji minimum yang diinginkan', 'चाहेको न्यूनतम तलब', 'လိုချင်သော အနည်းဆုံး လစာ', '希望的最低工资'],
  wage_type: ['給与の形態', 'きゅうりょうの かたち', 'Pay type', 'Hình thức lương', 'Jenis gaji', 'तलबको प्रकार', 'လစာ အမျိုးအစား', '工资形式'],
  monthly: ['月給', 'げっきゅう（1かげつ）', 'Monthly', 'Theo tháng', 'Bulanan', 'मासिक', 'လစဉ်', '月薪'],
  hourly: ['時給', 'じきゅう（1じかん）', 'Hourly', 'Theo giờ', 'Per jam', 'प्रतिघण्टा', 'တစ်နာရီ', '时薪'],
  amount: ['金額（円）', 'いくら（えん）', 'Amount (yen)', 'Số tiền (yên)', 'Jumlah (yen)', 'रकम (येन)', 'ပမာဏ (ယန်း)', '金额（日元）'],

  hours: ['働ける時間帯', 'はたらける じかん', 'Hours you can work', 'Khung giờ có thể làm', 'Jam yang bisa bekerja', 'काम गर्न सकिने समय', 'အလုပ်လုပ်နိုင်သော အချိန်', '可工作时间段'],
  from_t: ['開始', 'から', 'From', 'Từ', 'Dari', 'देखि', 'မှ', '从'],
  to_t: ['終了', 'まで', 'To', 'Đến', 'Sampai', 'सम्म', 'အထိ', '到'],
  shift: ['夜勤・交替制の勤務はできますか', 'よるの しごと（やきん）は できますか', 'Can you work night shifts or rotating shifts?', 'Bạn có thể làm ca đêm hoặc làm theo ca không?', 'Apakah Anda bisa bekerja shift malam atau bergilir?', 'के तपाईं राति वा पालो (सिफ्ट) मा काम गर्न सक्नुहुन्छ?', 'ညဆိုင်း သို့မဟုတ် အလှည့်ကျဆိုင်းဖြင့် လုပ်နိုင်ပါသလား။', '能否上夜班或轮班？'],
  night_max: ['夜勤は月に何回まで', 'やきんは 1かげつに なんかい まで', 'Maximum night shifts per month', 'Số ca đêm tối đa mỗi tháng', 'Maksimal shift malam per bulan', 'महिनामा बढीमा कति पटक राति सिफ्ट', 'တစ်လလျှင် အများဆုံး ညဆိုင်း အကြိမ်ရေ', '每月最多夜班次数'],
  times: ['回', 'かい', 'times', 'lần', 'kali', 'पटक', 'ကြိမ်', '次'],
  days: ['1週間に働ける日数', '1しゅうかんに はたらける ひ', 'Days per week you can work', 'Số ngày có thể làm mỗi tuần', 'Jumlah hari kerja per minggu', 'हप्तामा काम गर्न सकिने दिन', 'တစ်ပတ်လျှင် လုပ်နိုင်သော ရက်', '每周可工作天数'],
  day_unit: ['日', 'にち', 'days', 'ngày', 'hari', 'दिन', 'ရက်', '天'],
  start: ['働き始められる日', 'はたらき はじめられる ひ', 'Date you can start work', 'Ngày có thể bắt đầu làm', 'Tanggal bisa mulai bekerja', 'काम सुरु गर्न सकिने मिति', 'အလုပ်စတင်နိုင်သော နေ့', '可开始工作的日期'],

  licenses: ['持っている資格・免許（複数可）', 'もっている しかく（いくつでも）', 'Qualifications and licenses you have (choose all that apply)', 'Bằng cấp, chứng chỉ đang có (có thể chọn nhiều)', 'Kualifikasi dan lisensi yang dimiliki (boleh pilih lebih dari satu)', 'तपाईंसँग भएका योग्यता र लाइसेन्स (एकभन्दा बढी छान्न सकिन्छ)', 'ရှိသော အရည်အချင်းနှင့် လိုင်စင် (တစ်ခုထက်ပို ရွေးနိုင်)', '持有的资格・执照（可多选）'],
  lic_other: ['その他の資格', 'ほかの しかく', 'Other qualifications', 'Bằng cấp khác', 'Kualifikasi lainnya', 'अन्य योग्यता', 'အခြား အရည်အချင်း', '其他资格'],
  exp_years: ['介護・医療・福祉の仕事の経験年数', 'かいご などの しごとを した ねんすう', 'Years of experience in care, medical or welfare work', 'Số năm kinh nghiệm trong lĩnh vực chăm sóc, y tế, phúc lợi', 'Lama pengalaman di bidang perawatan, medis, atau kesejahteraan', 'हेरचाह, स्वास्थ्य वा कल्याण क्षेत्रमा कामको अनुभव', 'စောင့်ရှောက်မှု၊ ဆေးဘက်၊ လူမှုဖူလုံရေး လုပ်ငန်း အတွေ့အကြုံ', '护理・医疗・福利工作经验年数'],
  years: ['年', 'ねん', 'years', 'năm', 'tahun', 'वर्ष', 'နှစ်', '年'],
  exp_note: ['仕事の経験の内容', 'どんな しごとを しましたか', 'Your work experience', 'Nội dung kinh nghiệm làm việc', 'Uraian pengalaman kerja', 'कामको अनुभवको विवरण', 'အလုပ်အတွေ့အကြုံ အကြောင်း', '工作经验内容'],
  exp_hint: [
    '仕事の経験だけを書いてください（例：特養で3年、食事・入浴の介助）',
    'しごとの ことだけ かいて ください（れい：とくようで 3ねん）',
    'Write only about your work experience (e.g., 3 years at a nursing home, helping with meals and bathing)',
    'Chỉ ghi về kinh nghiệm làm việc (ví dụ: 3 năm ở viện dưỡng lão, hỗ trợ ăn uống và tắm)',
    'Tulis hanya tentang pengalaman kerja (contoh: 3 tahun di panti jompo, membantu makan dan mandi)',
    'कामको अनुभव मात्र लेख्नुहोस् (उदाहरण: नर्सिङ होममा ३ वर्ष, खाना र नुहाउन सहयोग)',
    'အလုပ်အတွေ့အကြုံကိုသာ ရေးပါ (ဥပမာ - သက်ကြီးဂေဟာတွင် ၃ နှစ်၊ အစားအသောက်နှင့် ရေချိုးရာတွင် ကူညီခြင်း)',
    '只需填写工作经验（例：在养老院工作3年，协助用餐和洗浴）',
  ],

  foreign: ['日本以外の国籍ですか', 'にほん いがいの くにの ひと ですか', 'Are you a foreign national (not Japanese)?', 'Bạn có quốc tịch nước ngoài (không phải Nhật Bản) không?', 'Apakah Anda warga negara asing (bukan Jepang)?', 'के तपाईं विदेशी नागरिक (जापानी नभएको) हुनुहुन्छ?', 'နိုင်ငံခြားသား (ဂျပန်နိုင်ငံသား မဟုတ်သူ) ဖြစ်ပါသလား။', '您是外国国籍（非日本国籍）吗？'],
  visa: ['在留資格', 'ざいりゅう しかく', 'Status of residence (visa)', 'Tư cách lưu trú (visa)', 'Status izin tinggal (visa)', 'बसोबास अनुमतिको प्रकार (भिसा)', 'နေထိုင်ခွင့် အမျိုးအစား (ဗီဇာ)', '在留资格（签证）'],
  visa_hint: ['在留カードに記載されています', 'ざいりゅうカードに かいて あります', 'It is written on your residence card', 'Được ghi trên thẻ lưu trú', 'Tertulis di kartu izin tinggal (residence card)', 'निवास कार्डमा लेखिएको छ', 'နေထိုင်ခွင့်ကတ်တွင် ရေးထားပါသည်', '写在在留卡上'],
  expiry: ['在留期間の満了日', 'ざいりゅう きげん（いつまで）', 'Expiration date of your period of stay', 'Ngày hết hạn lưu trú', 'Tanggal berakhir izin tinggal', 'बसोबास अनुमति सकिने मिति', 'နေထိုင်ခွင့် သက်တမ်းကုန်ဆုံးရက်', '在留期限（到期日）'],
  jlpt: ['日本語能力試験（JLPT）', 'にほんごの しけん（JLPT）', 'Japanese-Language Proficiency Test (JLPT)', 'Kỳ thi năng lực tiếng Nhật (JLPT)', 'Ujian Kemampuan Bahasa Jepang (JLPT)', 'जापानी भाषा दक्षता परीक्षा (JLPT)', 'ဂျပန်ဘာသာ စွမ်းရည်စာမေးပွဲ (JLPT)', '日语能力考试（JLPT）'],
  none: ['なし', 'ない', 'None', 'Không có', 'Tidak ada', 'छैन', 'မရှိ', '无'],
  care_jp: ['介護日本語評価試験に合格していますか', 'かいご にほんご ひょうか しけんに ごうかく しましたか', 'Have you passed the Nursing Care Japanese Language Evaluation Test?', 'Bạn đã đỗ Kỳ thi đánh giá tiếng Nhật điều dưỡng chưa?', 'Apakah Anda sudah lulus Ujian Evaluasi Bahasa Jepang untuk Perawatan?', 'के तपाईंले हेरचाह जापानी भाषा मूल्याङ्कन परीक्षा पास गर्नुभएको छ?', 'သူနာပြုစောင့်ရှောက်မှု ဂျပန်ဘာသာ အကဲဖြတ်စာမေးပွဲ အောင်ပြီးပါသလား။', '是否已通过护理日语评价考试？'],
  skill: ['介護技能評価試験に合格していますか', 'かいご ぎのう ひょうか しけんに ごうかく しましたか', 'Have you passed the Nursing Care Skills Evaluation Test?', 'Bạn đã đỗ Kỳ thi đánh giá kỹ năng điều dưỡng chưa?', 'Apakah Anda sudah lulus Ujian Evaluasi Keterampilan Perawatan?', 'के तपाईंले हेरचाह सीप मूल्याङ्कन परीक्षा पास गर्नुभएको छ?', 'သူနာပြုစောင့်ရှောက်မှု ကျွမ်းကျင်မှု အကဲဖြတ်စာမေးပွဲ အောင်ပြီးပါသလား။', '是否已通过护理技能评价考试？'],

  yes: ['はい', 'はい', 'Yes', 'Có', 'Ya', 'हो', 'ဟုတ်ကဲ့', '是'],
  no: ['いいえ', 'いいえ', 'No', 'Không', 'Tidak', 'होइन', 'မဟုတ်ပါ', '否'],
  choose: ['選んでください', 'えらんで ください', 'Please select', 'Vui lòng chọn', 'Silakan pilih', 'छान्नुहोस्', 'ရွေးပါ', '请选择'],

  consent_text: [
    '株式会社リアネット（有料職業紹介事業者）は、ご記入いただいた個人情報を、職業紹介（求人の紹介、応募・面接の連絡、就職後のフォロー）のために利用します。求人者（介護施設等）へ紹介するときは、紹介に必要な範囲でのみ提供します。法令に基づく場合を除き、ご本人の同意なく他の目的に利用したり、第三者に提供したりしません。記録は法令に従って保存し、保存期間が過ぎた後に削除します。',
    'リアネットは、あなたの じょうほう（なまえ・れんらくさき など）を、しごとを しょうかいする ために つかいます。はたらく ところ（しせつ）に しょうかいする ときは、ひつような じょうほうだけ わたします。ほかの ことには つかいません。ほかの ひとにも わたしません（ほうりつで きまっている ときを のぞきます）。きまった きかんが すぎたら けします。',
    'Rianet Co., Ltd. (a licensed private employment agency) will use the personal information you enter for job placement services (introducing job openings, contacting you about applications and interviews, and follow-up after you start work). When introducing you to an employer (such as a care facility), we will share only the information needed for the introduction. Except where required by law, we will not use your information for other purposes or give it to third parties without your consent. Records are kept as required by law and deleted after the retention period.',
    'Công ty Rianet (doanh nghiệp giới thiệu việc làm có phí được cấp phép) sẽ sử dụng thông tin cá nhân bạn nhập vào cho mục đích giới thiệu việc làm (giới thiệu việc làm, liên lạc về ứng tuyển và phỏng vấn, hỗ trợ sau khi bắt đầu làm việc). Khi giới thiệu bạn cho nhà tuyển dụng (như cơ sở chăm sóc), chúng tôi chỉ cung cấp những thông tin cần thiết cho việc giới thiệu. Trừ trường hợp theo quy định của pháp luật, chúng tôi sẽ không sử dụng cho mục đích khác hoặc cung cấp cho bên thứ ba khi chưa có sự đồng ý của bạn. Hồ sơ được lưu trữ theo quy định của pháp luật và sẽ bị xóa sau khi hết thời hạn lưu trữ.',
    'Rianet Co., Ltd. (agen penempatan kerja berbayar yang berizin) akan menggunakan informasi pribadi yang Anda isi untuk layanan penempatan kerja (memperkenalkan lowongan, menghubungi Anda terkait lamaran dan wawancara, serta tindak lanjut setelah mulai bekerja). Saat memperkenalkan Anda kepada pemberi kerja (seperti fasilitas perawatan), kami hanya memberikan informasi yang diperlukan untuk perkenalan tersebut. Kecuali diwajibkan oleh hukum, kami tidak akan menggunakannya untuk tujuan lain atau memberikannya kepada pihak ketiga tanpa persetujuan Anda. Data disimpan sesuai ketentuan hukum dan dihapus setelah masa penyimpanan berakhir.',
    'Rianet Co., Ltd. (इजाजतप्राप्त सशुल्क रोजगार सेवा प्रदायक) ले तपाईंले भर्नुभएको व्यक्तिगत जानकारी रोजगार सेवा (कामको परिचय, आवेदन र अन्तर्वार्ताबारे सम्पर्क, काम सुरु गरेपछिको सहयोग) का लागि प्रयोग गर्नेछ। रोजगारदाता (हेरचाह केन्द्र आदि) लाई परिचय गराउँदा परिचयका लागि आवश्यक जानकारी मात्र दिइनेछ। कानुनले तोकेको अवस्थाबाहेक, तपाईंको सहमतिबिना अन्य उद्देश्यमा प्रयोग गरिने वा तेस्रो पक्षलाई दिइने छैन। अभिलेख कानुनअनुसार राखिन्छ र राख्ने अवधि सकिएपछि मेटाइन्छ।',
    'Rianet Co., Ltd. (လိုင်စင်ရ အခကြေးငွေယူ အလုပ်အကိုင်ရှာဖွေရေး လုပ်ငန်း) သည် သင်ဖြည့်သွင်းသော ကိုယ်ရေးအချက်အလက်များကို အလုပ်အကိုင် မိတ်ဆက်ပေးခြင်း (အလုပ်ခေါ်စာများ မိတ်ဆက်ခြင်း၊ လျှောက်ထားမှုနှင့် အင်တာဗျူးအတွက် ဆက်သွယ်ခြင်း၊ အလုပ်စတင်ပြီးနောက် ကူညီခြင်း) အတွက် အသုံးပြုပါမည်။ အလုပ်ရှင် (စောင့်ရှောက်ရေးဌာန စသည်) ထံ မိတ်ဆက်ပေးသည့်အခါ မိတ်ဆက်ရန် လိုအပ်သော အချက်အလက်များကိုသာ ပေးပါမည်။ ဥပဒေအရ လိုအပ်သည့်အခါမှအပ သင့်သဘောတူညီချက်မရှိဘဲ အခြားရည်ရွယ်ချက်များအတွက် အသုံးမပြုပါ၊ တတိယပုဂ္ဂိုလ်ထံ မပေးပါ။ မှတ်တမ်းများကို ဥပဒေအတိုင်း သိမ်းဆည်းပြီး သိမ်းဆည်းချိန် ကုန်ဆုံးပါက ဖျက်ပစ်ပါမည်။',
    '株式会社リアネット（有偿职业介绍机构）将把您填写的个人信息用于职业介绍（介绍招聘信息、联系应聘和面试事宜、入职后的跟进）。向招聘方（护理机构等）介绍您时，仅在介绍所需的范围内提供信息。除法律规定的情况外，未经您同意，不会用于其他目的，也不会提供给第三方。记录将依法保存，保存期满后删除。',
  ],
  consent_check: ['上記の個人情報の取扱いに同意します', 'わかりました。どうい します', 'I agree to the handling of my personal information described above.', 'Tôi đồng ý với việc xử lý thông tin cá nhân như trên.', 'Saya menyetujui penanganan informasi pribadi saya seperti di atas.', 'म माथि उल्लेखित व्यक्तिगत जानकारीको प्रयोगमा सहमत छु।', 'အထက်ပါ ကိုယ်ရေးအချက်အလက် ကိုင်တွယ်ပုံကို သဘောတူပါသည်။', '我同意上述个人信息的处理方式。'],
  ai_title: ['AIの利用（任意）', 'AI（コンピューター）を つかうこと（えらばなくても いいです）', 'Use of AI (optional)', 'Sử dụng AI (không bắt buộc)', 'Penggunaan AI (opsional)', 'AI को प्रयोग (ऐच्छिक)', 'AI အသုံးပြုခြင်း (မဖြစ်မနေ မဟုတ်ပါ)', 'AI的使用（可选）'],
  ai_check: [
    '氏名・連絡先を除いた情報（希望条件・資格・経験など）を外部のAIサービスで分析し、求人の提案に利用することに同意します。同意しなくても職業紹介は受けられます。',
    'なまえ・でんわ・メール・じゅうしょ いがいの じょうほう（きぼう・しかく・けいけん）を、AI（コンピューター）で しらべて、あなたに あう しごとを さがす ために つかいます。どうい しなくても、しごとの しょうかいは うけられます。',
    'I agree that information other than my name and contact details (job preferences, qualifications, experience, etc.) may be analyzed using an external AI service to suggest suitable jobs. You can still receive job placement services if you do not agree.',
    'Tôi đồng ý để thông tin của tôi, ngoại trừ họ tên và thông tin liên lạc (nguyện vọng, bằng cấp, kinh nghiệm, v.v.), được phân tích bằng dịch vụ AI bên ngoài nhằm đề xuất công việc phù hợp. Nếu không đồng ý, bạn vẫn được giới thiệu việc làm.',
    'Saya setuju informasi saya selain nama dan kontak (keinginan kerja, kualifikasi, pengalaman, dll.) dianalisis menggunakan layanan AI eksternal untuk menyarankan lowongan yang sesuai. Jika tidak setuju, Anda tetap dapat menerima layanan penempatan kerja.',
    'मेरो नाम र सम्पर्क विवरणबाहेकको जानकारी (इच्छा, योग्यता, अनुभव आदि) उपयुक्त काम सुझाउन बाह्य AI सेवाद्वारा विश्लेषण गर्न म सहमत छु। सहमति नदिए पनि तपाईंले रोजगार सेवा पाउन सक्नुहुन्छ।',
    'ကျွန်ုပ်၏ အမည်နှင့် ဆက်သွယ်ရန် အချက်အလက်များမှလွဲ၍ အခြားအချက်အလက်များ (လိုချင်သော အခြေအနေ၊ အရည်အချင်း၊ အတွေ့အကြုံ စသည်) ကို သင့်လျော်သော အလုပ်များ အကြံပြုရန် ပြင်ပ AI ဝန်ဆောင်မှုဖြင့် ခွဲခြမ်းစိတ်ဖြာခြင်းကို သဘောတူပါသည်။ သဘောမတူလည်း အလုပ်မိတ်ဆက်ပေးခြင်း ဝန်ဆောင်မှုကို ရယူနိုင်ပါသည်။',
    '我同意将除姓名和联系方式以外的信息（希望条件、资格、经验等）通过外部AI服务进行分析，用于推荐合适的工作。即使不同意，也可以接受职业介绍服务。',
  ],

  submit: ['送信する', 'おくる', 'Submit', 'Gửi', 'Kirim', 'पठाउनुहोस्', 'ပေးပို့မည်', '提交'],
  sending: ['送信中…', 'おくって います…', 'Sending…', 'Đang gửi…', 'Mengirim…', 'पठाउँदै…', 'ပေးပို့နေသည်…', '正在提交…'],
  err_name: ['氏名を入力してください', 'なまえを かいて ください', 'Please enter your full name.', 'Vui lòng nhập họ và tên.', 'Silakan isi nama lengkap.', 'कृपया पूरा नाम लेख्नुहोस्।', 'အမည် ဖြည့်ပါ။', '请填写姓名。'],
  err_consent: ['個人情報の取扱いへの同意にチェックしてください', '「どうい します」に チェックを して ください', 'Please check the box to agree to the handling of personal information.', 'Vui lòng đánh dấu đồng ý với việc xử lý thông tin cá nhân.', 'Silakan centang persetujuan penanganan informasi pribadi.', 'कृपया व्यक्तिगत जानकारी प्रयोगको सहमतिमा चिन्ह लगाउनुहोस्।', 'ကိုယ်ရေးအချက်အလက် ကိုင်တွယ်ပုံကို သဘောတူကြောင်း အမှန်ခြစ်ပါ။', '请勾选同意个人信息的处理方式。'],
  err_send: ['送信できませんでした。担当者に声をかけてください。', 'おくれません でした。たんとうしゃに こえを かけて ください。', 'Could not submit. Please ask a staff member for help.', 'Không gửi được. Vui lòng nhờ nhân viên hỗ trợ.', 'Gagal mengirim. Silakan minta bantuan petugas.', 'पठाउन सकिएन। कृपया कर्मचारीलाई सोध्नुहोस्।', 'ပေးပို့၍ မရပါ။ ဝန်ထမ်းထံ အကူအညီ တောင်းပါ။', '提交失败。请向工作人员求助。'],
  done: ['受付しました。担当者がお呼びします。', 'うけつけ しました。たんとうしゃが よびます。すわって まって ください。', 'Your form has been received. A staff member will call you shortly.', 'Đã tiếp nhận. Nhân viên phụ trách sẽ gọi bạn.', 'Formulir Anda sudah diterima. Petugas akan memanggil Anda.', 'तपाईंको फारम प्राप्त भयो। जिम्मेवार कर्मचारीले तपाईंलाई बोलाउनुहुनेछ।', 'လက်ခံရရှိပါပြီ။ တာဝန်ခံ ဝန်ထမ်းက ခေါ်ပါလိမ့်မည်။', '已受理。工作人员稍后会叫您。'],
  reset_in: ['{n}秒後に最初の画面に戻ります', '{n}びょうで はじめの がめんに もどります', 'Returning to the start screen in {n} seconds', 'Sẽ quay lại màn hình đầu sau {n} giây', 'Kembali ke layar awal dalam {n} detik', '{n} सेकेन्डमा सुरुको स्क्रिनमा फर्किन्छ', '{n} စက္ကန့်အတွင်း အစ စာမျက်နှာသို့ ပြန်သွားပါမည်', '{n}秒后返回初始画面'],
  back: ['最初に戻る', 'はじめに もどる', 'Back to start', 'Quay lại từ đầu', 'Kembali ke awal', 'सुरुमा फर्कनुहोस्', 'အစသို့ ပြန်သွားရန်', '返回首页'],
};

// 選択肢：v は送信する値（日本語）、l は表示 [ja, easy_ja, en, vi, id, ne, my, zh]
const TRANSPORT = [
  { v: '電車', l: ['電車', 'でんしゃ', 'Train', 'Tàu điện', 'Kereta', 'रेल', 'ရထား', '电车'] },
  { v: 'バス', l: ['バス', 'バス', 'Bus', 'Xe buýt', 'Bus', 'बस', 'ဘတ်စ်ကား', '公交车'] },
  { v: '自転車', l: ['自転車', 'じてんしゃ', 'Bicycle', 'Xe đạp', 'Sepeda', 'साइकल', 'စက်ဘီး', '自行车'] },
  { v: '徒歩', l: ['徒歩', 'あるく', 'Walking', 'Đi bộ', 'Jalan kaki', 'पैदल', 'လမ်းလျှောက်', '步行'] },
  { v: '車', l: ['車', 'くるま', 'Car', 'Ô tô', 'Mobil', 'कार', 'ကား', '汽车'] },
  { v: 'バイク', l: ['バイク', 'バイク', 'Motorbike', 'Xe máy', 'Sepeda motor', 'मोटरसाइकल', 'ဆိုင်ကယ်', '摩托车'] },
];
const JOB_KINDS = [
  { v: '介護職', l: ['介護職', 'かいご', 'Care worker', 'Nhân viên chăm sóc (kaigo)', 'Pekerja perawatan (kaigo)', 'हेरचाहकर्मी (कागो)', 'စောင့်ရှောက်မှု ဝန်ထမ်း (ကိုင်ဂို)', '护理员'] },
  { v: '看護職', l: ['看護職（看護師・准看護師）', 'かんごし', 'Nurse', 'Y tá', 'Perawat (nurse)', 'नर्स', 'သူနာပြု', '护士'] },
  { v: '調理', l: ['調理', 'りょうり', 'Cooking / kitchen', 'Nấu ăn', 'Memasak / dapur', 'खाना पकाउने', 'ချက်ပြုတ်ခြင်း', '烹饪'] },
  { v: '送迎', l: ['送迎（運転）', 'くるまの うんてん（そうげい）', 'Driver (pick-up and drop-off)', 'Lái xe đưa đón', 'Sopir antar-jemput', 'ड्राइभर (ल्याउने-पुर्‍याउने)', 'ကြိုပို့ ယာဉ်မောင်း', '接送司机'] },
  { v: '事務', l: ['事務', 'じむ', 'Office work', 'Công việc văn phòng', 'Pekerjaan kantor', 'कार्यालयको काम', 'ရုံးလုပ်ငန်း', '办公室事务'] },
  { v: 'その他', l: ['その他', 'そのほか', 'Other', 'Khác', 'Lainnya', 'अन्य', 'အခြား', '其他'] },
];
const FACILITIES = [
  { v: '特養', l: ['特別養護老人ホーム（特養）', 'とくべつ ようご ろうじんホーム', 'Special nursing home for the elderly', 'Viện dưỡng lão đặc biệt', 'Panti jompo khusus', 'विशेष वृद्ध नर्सिङ होम', 'အထူး သက်ကြီးရွယ်အို စောင့်ရှောက်ရေးဂေဟာ', '特别养护老人院'] },
  { v: '老健', l: ['介護老人保健施設（老健）', 'ろうけん（リハビリの しせつ）', 'Geriatric health services facility (rehabilitation)', 'Cơ sở chăm sóc sức khỏe người cao tuổi (phục hồi chức năng)', 'Fasilitas kesehatan lansia (rehabilitasi)', 'वृद्ध स्वास्थ्य सेवा केन्द्र (पुनर्स्थापना)', 'သက်ကြီးရွယ်အို ကျန်းမာရေး စောင့်ရှောက်မှုဌာန (ပြန်လည်ထူထောင်ရေး)', '护理老人保健设施（老健）'] },
  { v: 'GH', l: ['グループホーム', 'グループホーム', 'Group home (dementia care)', 'Nhà nhóm (chăm sóc người sa sút trí tuệ)', 'Group home (perawatan demensia)', 'ग्रुप होम (डिमेन्सिया हेरचाह)', 'အုပ်စုနေအိမ် (သတိမေ့ရောဂါ စောင့်ရှောက်မှု)', '集体之家（认知症护理）'] },
  { v: '有料', l: ['有料老人ホーム', 'ゆうりょう ろうじんホーム', 'Private nursing home', 'Viện dưỡng lão tư nhân', 'Panti jompo swasta', 'निजी नर्सिङ होम', 'ပုဂ္ဂလိက သက်ကြီးရွယ်အို ဂေဟာ', '收费养老院'] },
  { v: 'サ高住', l: ['サービス付き高齢者向け住宅', 'おとしよりの じゅうたく（サービスつき）', 'Senior housing with care services', 'Nhà ở cho người cao tuổi có dịch vụ', 'Hunian lansia dengan layanan', 'सेवासहितको वृद्ध आवास', 'ဝန်ဆောင်မှုပါ သက်ကြီးရွယ်အို နေအိမ်', '附带服务的老年人住宅'] },
  { v: 'デイ', l: ['デイサービス（通所介護）', 'デイサービス（ひるまだけ）', 'Day care service', 'Dịch vụ chăm sóc ban ngày', 'Layanan perawatan siang hari', 'दिवा सेवा (डे सर्भिस)', 'နေ့ခင်း စောင့်ရှောက်မှု ဝန်ဆောင်မှု', '日间照料中心'] },
  { v: '訪問', l: ['訪問介護', 'ほうもん かいご（いえに いく）', 'Home-visit care', 'Chăm sóc tại nhà', 'Perawatan kunjungan rumah', 'घरभेट हेरचाह', 'အိမ်သို့ သွားရောက် စောင့်ရှောက်မှု', '上门护理'] },
  { v: '障害', l: ['障害福祉施設', 'しょうがい ふくし しせつ', 'Disability welfare facility', 'Cơ sở phúc lợi cho người khuyết tật', 'Fasilitas kesejahteraan penyandang disabilitas', 'अपाङ्गता कल्याण केन्द्र', 'မသန်စွမ်းသူ လူမှုဖူလုံရေးဌာန', '残障福利设施'] },
  { v: '病院', l: ['病院', 'びょういん', 'Hospital', 'Bệnh viện', 'Rumah sakit', 'अस्पताल', 'ဆေးရုံ', '医院'] },
  { v: 'その他', l: JOB_KINDS[5].l },
];
const EMPLOYMENT = [
  { v: '正社員', l: ['正社員', 'せいしゃいん', 'Full-time regular employee', 'Nhân viên chính thức', 'Karyawan tetap', 'स्थायी पूर्णकालीन कर्मचारी', 'အမြဲတမ်း ဝန်ထမ်း', '正式员工'] },
  { v: '契約社員', l: ['契約社員', 'けいやく しゃいん', 'Contract employee', 'Nhân viên hợp đồng', 'Karyawan kontrak', 'करार कर्मचारी', 'စာချုပ် ဝန်ထမ်း', '合同工'] },
  { v: 'パート', l: ['パート', 'パート', 'Part-time', 'Bán thời gian', 'Paruh waktu', 'पार्टटाइम', 'အချိန်ပိုင်း', '兼职（小时工）'] },
];
const LICENSES = [
  { v: '介護職員初任者研修', l: ['介護職員初任者研修', 'しょにんしゃ けんしゅう', 'Initial Care Worker Training', 'Khóa đào tạo nhân viên chăm sóc sơ cấp', 'Pelatihan dasar pekerja perawatan', 'प्रारम्भिक हेरचाहकर्मी तालिम', 'အခြေခံ စောင့်ရှောက်မှုဝန်ထမ်း သင်တန်း', '护理职员初任者研修'] },
  { v: '介護福祉士実務者研修', l: ['介護福祉士実務者研修', 'じつむしゃ けんしゅう', 'Practical Care Worker Training', 'Khóa đào tạo thực hành chăm sóc', 'Pelatihan praktisi perawatan', 'व्यावहारिक हेरचाह तालिम', 'လက်တွေ့ စောင့်ရှောက်မှု သင်တန်း', '护理福祉士实务者研修'] },
  { v: '介護福祉士', l: ['介護福祉士', 'かいご ふくしし', 'Certified Care Worker (national license)', 'Điều dưỡng viên có chứng chỉ quốc gia (Kaigo Fukushishi)', 'Pekerja perawatan bersertifikat nasional (Kaigo Fukushishi)', 'प्रमाणित हेरचाहकर्मी (राष्ट्रिय लाइसेन्स)', 'နိုင်ငံတော် အသိအမှတ်ပြု စောင့်ရှောက်မှုဝန်ထမ်း', '介护福祉士（国家资格）'] },
  { v: '看護師', l: ['看護師', 'かんごし', 'Registered nurse (Japanese license)', 'Y tá chính quy (bằng Nhật Bản)', 'Perawat terdaftar (lisensi Jepang)', 'दर्ता भएको नर्स (जापानी लाइसेन्स)', 'မှတ်ပုံတင် သူနာပြု (ဂျပန်လိုင်စင်)', '护士（日本执照）'] },
  { v: '准看護師', l: ['准看護師', 'じゅんかんごし', 'Assistant nurse (Japanese license)', 'Y tá phụ (bằng Nhật Bản)', 'Perawat asisten (lisensi Jepang)', 'सहायक नर्स (जापानी लाइसेन्स)', 'လက်ထောက် သူနာပြု (ဂျပန်လိုင်စင်)', '准护士（日本执照）'] },
  { v: '普通自動車免許', l: ['普通自動車免許', 'くるまの めんきょ', 'Driver\'s license for cars (valid in Japan)', 'Bằng lái ô tô (có hiệu lực tại Nhật)', 'SIM mobil (berlaku di Jepang)', 'कार चलाउने लाइसेन्स (जापानमा मान्य)', 'ကားမောင်းလိုင်စင် (ဂျပန်တွင် အသုံးပြုနိုင်)', '普通汽车驾照（在日本有效）'] },
];
// 在留資格：在留カードの表記（日本語・英語）
const VISAS = [
  ['特定技能1号', 'Specified Skilled Worker (i)'], ['特定技能2号', 'Specified Skilled Worker (ii)'], ['介護', 'Nursing Care'],
  ['技能実習', 'Technical Intern Training'], ['育成就労', 'Employment for Skill Development'], ['留学', 'Student'],
  ['家族滞在', 'Dependent'], ['永住者', 'Permanent Resident'], ['定住者', 'Long-Term Resident'],
  ['日本人の配偶者等', 'Spouse or Child of Japanese National'], ['永住者の配偶者等', 'Spouse or Child of Permanent Resident'],
  ['特定活動', 'Designated Activities'], ['その他', 'Other'],
];
const PREFS = [
  ['北海道', 'Hokkaido'], ['青森県', 'Aomori'], ['岩手県', 'Iwate'], ['宮城県', 'Miyagi'], ['秋田県', 'Akita'], ['山形県', 'Yamagata'],
  ['福島県', 'Fukushima'], ['茨城県', 'Ibaraki'], ['栃木県', 'Tochigi'], ['群馬県', 'Gunma'], ['埼玉県', 'Saitama'], ['千葉県', 'Chiba'],
  ['東京都', 'Tokyo'], ['神奈川県', 'Kanagawa'], ['新潟県', 'Niigata'], ['富山県', 'Toyama'], ['石川県', 'Ishikawa'], ['福井県', 'Fukui'],
  ['山梨県', 'Yamanashi'], ['長野県', 'Nagano'], ['岐阜県', 'Gifu'], ['静岡県', 'Shizuoka'], ['愛知県', 'Aichi'], ['三重県', 'Mie'],
  ['滋賀県', 'Shiga'], ['京都府', 'Kyoto'], ['大阪府', 'Osaka'], ['兵庫県', 'Hyogo'], ['奈良県', 'Nara'], ['和歌山県', 'Wakayama'],
  ['鳥取県', 'Tottori'], ['島根県', 'Shimane'], ['岡山県', 'Okayama'], ['広島県', 'Hiroshima'], ['山口県', 'Yamaguchi'], ['徳島県', 'Tokushima'],
  ['香川県', 'Kagawa'], ['愛媛県', 'Ehime'], ['高知県', 'Kochi'], ['福岡県', 'Fukuoka'], ['佐賀県', 'Saga'], ['長崎県', 'Nagasaki'],
  ['熊本県', 'Kumamoto'], ['大分県', 'Oita'], ['宮崎県', 'Miyazaki'], ['鹿児島県', 'Kagoshima'], ['沖縄県', 'Okinawa'],
];
const JLPT = ['N1', 'N2', 'N3', 'N4', 'N5'];
const COMMUTE_MIN = [15, 30, 45, 60, 90];
const SKILL_TEST_VALUE = '介護技能評価試験';
const RESET_SECONDS = 10;

const EMPTY = {
  name: '', name_kana: '', phone: '', email: '', address: '', birth_date: '',
  prefecture: '', city: '', nearest_station: '', transport: [], max_commute_minutes: '',
  desired_job_kinds: [], desired_facility_types: [], desired_employment: [], desired_wage_type: 'monthly', desired_wage_min: '',
  available_start: '', available_end: '', shift_ok: '', night_max_per_month: '', max_days_per_week: '', available_from: '',
  licenses: [], licenses_other: '', experience_years: '', experience_note: '',
  is_foreign_national: '', visa_status: '', residence_expiry: '', jlpt_level: '', care_japanese_test: '', skill_test: '',
  consent: false, ai_consent: false,
};

const STYLE = `
.intake { min-height: 100vh; background: #f1f5f9; font-size: 18px; line-height: 1.7; padding: 0 0 48px; }
.intake * { font-size: inherit; }
.intake-top { position: sticky; top: 0; z-index: 10; background: #1e293b; color: #f1f5f9; padding: 12px 16px; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
.intake-top .intake-brand { font-size: 15px; opacity: .8; }
.intake-langs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.intake-langs button { min-height: 52px; min-width: 120px; padding: 8px 16px; border-radius: 10px; border: 2px solid #64748b; background: #334155; color: #f1f5f9; font-size: 18px; cursor: pointer; }
.intake-langs button[aria-pressed="true"] { background: #2563eb; border-color: #93c5fd; font-weight: 700; }
.intake-body { max-width: 860px; margin: 0 auto; padding: 16px; }
.intake h1 { font-size: 28px; margin: 12px 0 4px; }
.intake h2 { font-size: 22px; margin: 0 0 12px; color: #1e293b; border-left: 6px solid #2563eb; padding-left: 10px; }
.intake section { background: #fff; border-radius: 12px; padding: 20px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.intake .f { margin-bottom: 18px; }
.intake .f > label, .intake legend { display: block; font-weight: 700; margin-bottom: 6px; color: #1f2937; }
.intake fieldset { border: none; padding: 0; margin: 0 0 18px; }
.intake input[type=text], .intake input[type=tel], .intake input[type=email], .intake input[type=number], .intake input[type=date], .intake input[type=time], .intake select, .intake textarea {
  width: 100%; min-height: 52px; padding: 10px 14px; border: 2px solid #cbd5e1; border-radius: 10px; background: #fff; color: #111827; font-size: 18px; }
.intake input:focus, .intake select:focus, .intake textarea:focus { outline: 3px solid #2563eb; outline-offset: 0; border-color: #2563eb; }
.intake .hint { color: #475569; font-size: 15px; margin-top: 4px; }
.intake .req { color: #dc2626; margin-left: 4px; }
.intake .opts { display: flex; flex-wrap: wrap; gap: 10px; }
.intake .opt { min-height: 52px; padding: 8px 18px; border-radius: 26px; border: 2px solid #cbd5e1; background: #fff; color: #1f2937; cursor: pointer; text-align: left; }
.intake .opt small { display: block; font-size: 13px; color: #64748b; }
.intake .opt[aria-pressed="true"] { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 700; }
.intake .opt[aria-pressed="true"] small { color: #dbeafe; }
.intake .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.intake .inline { display: flex; align-items: center; gap: 10px; }
.intake .inline input, .intake .inline select { flex: 1; }
.intake .consent-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 14px; white-space: pre-wrap; }
.intake .big-check { display: flex; gap: 14px; align-items: flex-start; padding: 14px; border: 2px solid #cbd5e1; border-radius: 10px; cursor: pointer; background: #fff; margin-bottom: 12px; }
.intake .big-check input { width: 32px; height: 32px; flex-shrink: 0; margin-top: 2px; }
.intake .big-check.on { border-color: #16a34a; background: #f0fdf4; }
.intake .submit { width: 100%; min-height: 68px; font-size: 24px; font-weight: 700; border-radius: 12px; border: none; background: #16a34a; color: #fff; cursor: pointer; }
.intake .submit:disabled { opacity: .6; cursor: wait; }
.intake .err { background: #fef2f2; border: 2px solid #fca5a5; color: #b91c1c; border-radius: 10px; padding: 12px 14px; margin: 12px 0; }
.intake .done { text-align: center; padding: 64px 20px; }
.intake .done .msg { font-size: 30px; font-weight: 700; color: #166534; margin: 16px 0; }
.intake .done .mark { font-size: 72px; color: #16a34a; }
.intake .secondary { min-height: 56px; padding: 8px 24px; border-radius: 10px; border: 2px solid #64748b; background: #fff; cursor: pointer; }
@media (max-width: 640px) { .intake .two { grid-template-columns: 1fr; } .intake-langs button { min-width: calc(50% - 4px); } }
`;

function Choices({ id, label, options, value, onChange, lang, multi, showJa }) {
  const idx = IDX[lang];
  const isOn = v => (multi ? value.includes(v) : value === v);
  const toggle = v => {
    if (multi) onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
    else onChange(value === v ? '' : v);
  };
  return (
    <fieldset>
      <legend id={id}>{label}</legend>
      <div className="opts" role="group" aria-labelledby={id}>
        {options.map(o => (
          <button key={o.v} type="button" className="opt" aria-pressed={isOn(o.v)} onClick={() => toggle(o.v)}>
            {o.l[idx] || o.l[2]}
            {showJa && idx > 1 && o.l[0] !== o.l[idx] && <small lang="ja">{o.l[0]}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function Intake() {
  const [lang, setLang] = useState('ja');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [left, setLeft] = useState(RESET_SECONDS);

  const i = IDX[lang];
  const t = key => (T[key] ? T[key][i] || T[key][2] : key);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const yesNo = [{ v: '1', l: T.yes }, { v: '0', l: T.no }];

  const reset = () => {
    setForm(EMPTY);
    setError('');
    setDone(false);
    setLeft(RESET_SECONDS);
    setLang('ja');
    window.scrollTo(0, 0);
  };

  // 送信後 10 秒で初期化（次の人のために入力を残さない）
  useEffect(() => {
    if (!done) return undefined;
    const timer = setInterval(() => setLeft(n => n - 1), 1000);
    return () => clearInterval(timer);
  }, [done]);
  useEffect(() => { if (done && left <= 0) reset(); }, [done, left]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.title = `${T.title[i]} | Rianet`; }, [i]);

  const submit = async () => {
    setError('');
    if (!form.name.trim()) { setError(t('err_name')); return; }
    if (!form.consent) { setError(t('err_consent')); return; }
    const foreign = form.is_foreign_national === '1';
    const licenses = [...form.licenses, ...form.licenses_other.split(/[,、，\n]/).map(s => s.trim()).filter(Boolean)];
    const body = {
      consent: true,
      name: form.name.trim(), name_kana: form.name_kana, phone: form.phone, email: form.email, address: form.address,
      birth_date: form.birth_date, preferred_language: lang,
      prefecture: form.prefecture, city: form.city, nearest_station: form.nearest_station,
      transport: form.transport.join(','), max_commute_minutes: form.max_commute_minutes,
      desired_job_kinds: form.desired_job_kinds.join(','), desired_facility_types: form.desired_facility_types.join(','),
      desired_employment: form.desired_employment.join(','),
      desired_wage_type: form.desired_wage_min ? form.desired_wage_type : '', desired_wage_min: form.desired_wage_min,
      available_start: form.available_start, available_end: form.available_end,
      shift_ok: form.shift_ok === '' ? '' : Number(form.shift_ok),
      night_max_per_month: form.shift_ok === '1' ? form.night_max_per_month : '',
      max_days_per_week: form.max_days_per_week, available_from: form.available_from,
      licenses: licenses.join(','), experience_years: form.experience_years, experience_note: form.experience_note,
      is_foreign_national: form.is_foreign_national === '' ? '' : Number(form.is_foreign_national),
      visa_status: foreign ? form.visa_status : '', residence_expiry: foreign ? form.residence_expiry : '',
      jlpt_level: foreign ? form.jlpt_level : '', care_japanese_test: foreign && form.care_japanese_test !== '' ? Number(form.care_japanese_test) : '',
      skill_test: foreign && form.skill_test === '1' ? SKILL_TEST_VALUE : '',
      ai_consent: form.ai_consent ? 1 : 0,
    };
    // 未回答（空）は送らない（bool 項目が「不可＝0」として保存されるのを防ぐ）
    for (const k of Object.keys(body)) if (body[k] === '' || body[k] == null) delete body[k];
    setBusy(true);
    try {
      await post('/intake', body);
      setForm(EMPTY);
      setLeft(RESET_SECONDS);
      setDone(true);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(`${t('err_send')}${e.message ? `（${e.message}）` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const showRomaji = !['ja', 'easy_ja', 'zh'].includes(lang);

  return (
    <div className="intake" lang={HTML_LANG[lang]}>
      <style>{STYLE}</style>
      <div className="intake-top">
        <div className="intake-brand" lang="ja">株式会社リアネット ／ Language・言語</div>
        <div className="intake-langs" role="group" aria-label="Language / 言語">
          {LANGS.map(l => (
            <button key={l.code} type="button" lang={HTML_LANG[l.code]} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</button>
          ))}
        </div>
      </div>

      <div className="intake-body">
        {done ? (
          <div className="done" role="status" aria-live="polite">
            <div className="mark" aria-hidden="true">✓</div>
            <div className="msg">{t('done')}</div>
            {lang !== 'ja' && <div className="msg" lang="ja" style={{ fontSize: 20, color: '#374151' }}>{T.done[0]}</div>}
            <p className="hint">{t('reset_in').replace('{n}', Math.max(0, left))}</p>
            <button type="button" className="secondary" onClick={reset}>{t('back')}</button>
          </div>
        ) : (
          <>
            <h1>{t('title')}</h1>
            <p>{t('intro')}</p>

            <section>
              <h2>{t('s_basic')}</h2>
              <div className="f">
                <label htmlFor="in-name">{t('name')}<span className="req">*</span></label>
                <input id="in-name" type="text" autoComplete="off" maxLength={50} value={form.name} onChange={e => set('name', e.target.value)} aria-required="true" />
                <div className="hint">{t('name_hint')}</div>
              </div>
              <div className="f">
                <label htmlFor="in-kana">{t('kana')}</label>
                <input id="in-kana" type="text" autoComplete="off" maxLength={50} value={form.name_kana} onChange={e => set('name_kana', e.target.value)} />
              </div>
              <div className="two">
                <div className="f">
                  <label htmlFor="in-phone">{t('phone')}</label>
                  <input id="in-phone" type="tel" inputMode="tel" autoComplete="off" maxLength={30} value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="f">
                  <label htmlFor="in-email">{t('email')}</label>
                  <input id="in-email" type="email" inputMode="email" autoComplete="off" maxLength={100} value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>
              <div className="f">
                <label htmlFor="in-birth">{t('birth')}</label>
                <input id="in-birth" type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
              </div>
            </section>

            <section>
              <h2>{t('s_area')}</h2>
              <div className="f">
                <label htmlFor="in-address">{t('address')}</label>
                <input id="in-address" type="text" autoComplete="off" maxLength={200} value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div className="two">
                <div className="f">
                  <label htmlFor="in-pref">{t('pref')}</label>
                  <select id="in-pref" value={form.prefecture} onChange={e => set('prefecture', e.target.value)}>
                    <option value="">{t('choose')}</option>
                    {PREFS.map(([ja, ro]) => <option key={ja} value={ja}>{showRomaji ? `${ro}（${ja}）` : ja}</option>)}
                  </select>
                </div>
                <div className="f">
                  <label htmlFor="in-city">{t('city')}</label>
                  <input id="in-city" type="text" autoComplete="off" maxLength={50} value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
              </div>
              <div className="f">
                <label htmlFor="in-station">{t('station')}</label>
                <input id="in-station" type="text" autoComplete="off" maxLength={50} value={form.nearest_station} onChange={e => set('nearest_station', e.target.value)} />
              </div>
              <Choices id="lg-transport" label={t('transport')} options={TRANSPORT} value={form.transport} onChange={v => set('transport', v)} lang={lang} multi />
              <div className="f">
                <label htmlFor="in-commute">{t('commute')}</label>
                <select id="in-commute" value={form.max_commute_minutes} onChange={e => set('max_commute_minutes', e.target.value)}>
                  <option value="">{t('choose')}</option>
                  {COMMUTE_MIN.map(m => <option key={m} value={m}>{m} {t('minutes')}</option>)}
                </select>
              </div>
            </section>

            <section>
              <h2>{t('s_job')}</h2>
              <Choices id="lg-jobs" label={t('jobs')} options={JOB_KINDS} value={form.desired_job_kinds} onChange={v => set('desired_job_kinds', v)} lang={lang} multi showJa />
              <Choices id="lg-fac" label={t('facility')} options={FACILITIES} value={form.desired_facility_types} onChange={v => set('desired_facility_types', v)} lang={lang} multi showJa />
              <Choices id="lg-emp" label={t('employment')} options={EMPLOYMENT} value={form.desired_employment} onChange={v => set('desired_employment', v)} lang={lang} multi showJa />
              <fieldset>
                <legend>{t('wage')}</legend>
                <div className="two">
                  <div className="f">
                    <label htmlFor="in-wtype">{t('wage_type')}</label>
                    <select id="in-wtype" value={form.desired_wage_type} onChange={e => set('desired_wage_type', e.target.value)}>
                      <option value="monthly">{t('monthly')}</option>
                      <option value="hourly">{t('hourly')}</option>
                    </select>
                  </div>
                  <div className="f">
                    <label htmlFor="in-wage">{t('amount')}</label>
                    <input id="in-wage" type="number" inputMode="numeric" min={0} step={form.desired_wage_type === 'hourly' ? 10 : 1000}
                      placeholder={form.desired_wage_type === 'hourly' ? '1200' : '220000'} value={form.desired_wage_min} onChange={e => set('desired_wage_min', e.target.value)} />
                  </div>
                </div>
              </fieldset>
            </section>

            <section>
              <h2>{t('s_time')}</h2>
              <fieldset>
                <legend>{t('hours')}</legend>
                <div className="two">
                  <div className="f">
                    <label htmlFor="in-ts">{t('from_t')}</label>
                    <input id="in-ts" type="time" value={form.available_start} onChange={e => set('available_start', e.target.value)} />
                  </div>
                  <div className="f">
                    <label htmlFor="in-te">{t('to_t')}</label>
                    <input id="in-te" type="time" value={form.available_end} onChange={e => set('available_end', e.target.value)} />
                  </div>
                </div>
              </fieldset>
              <Choices id="lg-shift" label={t('shift')} options={yesNo} value={form.shift_ok} onChange={v => set('shift_ok', v)} lang={lang} />
              {form.shift_ok === '1' && (
                <div className="f">
                  <label htmlFor="in-night">{t('night_max')}</label>
                  <div className="inline">
                    <input id="in-night" type="number" inputMode="numeric" min={0} max={31} value={form.night_max_per_month} onChange={e => set('night_max_per_month', e.target.value)} />
                    <span>{t('times')}</span>
                  </div>
                </div>
              )}
              <div className="two">
                <div className="f">
                  <label htmlFor="in-days">{t('days')}</label>
                  <select id="in-days" value={form.max_days_per_week} onChange={e => set('max_days_per_week', e.target.value)}>
                    <option value="">{t('choose')}</option>
                    {[1, 2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d} {t('day_unit')}</option>)}
                  </select>
                </div>
                <div className="f">
                  <label htmlFor="in-from">{t('start')}</label>
                  <input id="in-from" type="date" value={form.available_from} onChange={e => set('available_from', e.target.value)} />
                </div>
              </div>
            </section>

            <section>
              <h2>{t('s_skill')}</h2>
              <Choices id="lg-lic" label={t('licenses')} options={LICENSES} value={form.licenses} onChange={v => set('licenses', v)} lang={lang} multi showJa />
              <div className="f">
                <label htmlFor="in-lico">{t('lic_other')}</label>
                <input id="in-lico" type="text" autoComplete="off" maxLength={150} value={form.licenses_other} onChange={e => set('licenses_other', e.target.value)} />
              </div>
              <div className="f">
                <label htmlFor="in-expy">{t('exp_years')}</label>
                <div className="inline">
                  <input id="in-expy" type="number" inputMode="numeric" min={0} max={60} value={form.experience_years} onChange={e => set('experience_years', e.target.value)} />
                  <span>{t('years')}</span>
                </div>
              </div>
              <div className="f">
                <label htmlFor="in-expn">{t('exp_note')}</label>
                <textarea id="in-expn" rows={4} maxLength={2000} value={form.experience_note} onChange={e => set('experience_note', e.target.value)} />
                <div className="hint">{t('exp_hint')}</div>
              </div>
            </section>

            <section>
              <h2>{t('s_foreign')}</h2>
              <Choices id="lg-foreign" label={t('foreign')} options={yesNo} value={form.is_foreign_national} onChange={v => set('is_foreign_national', v)} lang={lang} />
              {form.is_foreign_national === '1' && (
                <>
                  <div className="f">
                    <label htmlFor="in-visa">{t('visa')}</label>
                    <select id="in-visa" value={form.visa_status} onChange={e => set('visa_status', e.target.value)}>
                      <option value="">{t('choose')}</option>
                      {VISAS.map(([ja, en]) => <option key={ja} value={ja}>{lang === 'ja' || lang === 'easy_ja' ? ja : `${ja} / ${en}`}</option>)}
                    </select>
                    <div className="hint">{t('visa_hint')}</div>
                  </div>
                  <div className="f">
                    <label htmlFor="in-exp">{t('expiry')}</label>
                    <input id="in-exp" type="date" value={form.residence_expiry} onChange={e => set('residence_expiry', e.target.value)} />
                    <div className="hint">{t('visa_hint')}</div>
                  </div>
                  <Choices id="lg-jlpt" label={t('jlpt')} options={[...JLPT.map(n => ({ v: n, l: Array(8).fill(n) })), { v: 'なし', l: T.none }]}
                    value={form.jlpt_level} onChange={v => set('jlpt_level', v)} lang={lang} />
                  <Choices id="lg-carejp" label={t('care_jp')} options={yesNo} value={form.care_japanese_test} onChange={v => set('care_japanese_test', v)} lang={lang} />
                  <Choices id="lg-skill" label={t('skill')} options={yesNo} value={form.skill_test} onChange={v => set('skill_test', v)} lang={lang} />
                </>
              )}
            </section>

            <section>
              <h2>{t('s_consent')}</h2>
              <div className="consent-box">{t('consent_text')}</div>
              {lang !== 'ja' && (
                <details style={{ marginBottom: 14 }}>
                  <summary lang="ja">日本語（原文）</summary>
                  <div className="consent-box" lang="ja">{T.consent_text[0]}</div>
                </details>
              )}
              <label className={`big-check${form.consent ? ' on' : ''}`} htmlFor="in-consent">
                <input id="in-consent" type="checkbox" checked={form.consent} onChange={e => set('consent', e.target.checked)} aria-required="true" />
                <span>{t('consent_check')}<span className="req">*</span></span>
              </label>
              <h2 style={{ marginTop: 20 }}>{t('ai_title')}</h2>
              <label className={`big-check${form.ai_consent ? ' on' : ''}`} htmlFor="in-ai">
                <input id="in-ai" type="checkbox" checked={form.ai_consent} onChange={e => set('ai_consent', e.target.checked)} />
                <span>{t('ai_check')}</span>
              </label>
            </section>

            {error && <div className="err" role="alert">{error}</div>}
            <button type="button" className="submit" disabled={busy} onClick={submit}>{busy ? t('sending') : t('submit')}</button>
          </>
        )}
      </div>
    </div>
  );
}
