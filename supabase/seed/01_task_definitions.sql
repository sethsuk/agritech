-- Five task definitions for the pilot.
-- Apply AFTER migrations are run: psql $DATABASE_URL -f supabase/seed/01_task_definitions.sql

INSERT INTO public.task_definitions
  (task_def_id, task_type, display_name, photo_policy_mode, photo_policy_audit_rates,
   requires_qr_scan, min_completion_seconds, min_qr_to_submit_seconds, fields)
VALUES

-- 1. Fertilizer application
('fertilizer_application_v1', 'fertilizer',
 '{"th":"ใส่ปุ๋ย","my":"မြေဩဇာထည့်ခြင်း","en":"Fertilizer application","icon":"🌱"}',
 'audit_only',
 '{"trusted":0.01,"standard":0.05,"audit":0.15}',
 TRUE, 12, 20,
 '[
   {"field_id":"fertilizer_type","type":"dropdown","label_icon":"🧪",
    "label":{"th":"ชนิดปุ๋ย","my":"မြေဩဇာအမျိုးအစား","en":"Fertilizer type"},
    "required":true,
    "options":[
      {"value":"NPK-16-16-16","icon":"⚗️","label":{"th":"NPK 16-16-16","my":"NPK 16-16-16","en":"NPK 16-16-16"}},
      {"value":"NPK-8-24-24","icon":"🌸","label":{"th":"NPK 8-24-24","my":"NPK 8-24-24","en":"NPK 8-24-24"}},
      {"value":"organic_compost","icon":"🍂","label":{"th":"ปุ๋ยหมัก","my":"မြေဩဇာ","en":"Organic compost"}}
    ]},
   {"field_id":"amount_kg","type":"numeric_counter","label_icon":"⚖️",
    "label":{"th":"ปริมาณ (กก.)","my":"ပမာဏ (ကီလို)","en":"Amount (kg)"},
    "required":true,"min":0,"max":50,"warn_above":20,"step":0.5}
 ]'
),

-- 2. Watering
('watering_v1', 'watering',
 '{"th":"รดน้ำ","my":"ရေလောင်းခြင်း","en":"Watering","icon":"💧"}',
 'audit_only',
 '{"trusted":0.01,"standard":0.05,"audit":0.15}',
 TRUE, 8, 15,
 '[
   {"field_id":"duration_minutes","type":"numeric_counter","label_icon":"⏱️",
    "label":{"th":"ระยะเวลา (นาที)","my":"အချိန် (မိနစ်)","en":"Duration (minutes)"},
    "required":true,"min":0,"max":120,"warn_above":60,"step":5}
 ]'
),

-- 3. Bloom logging
('bloom_log_v1', 'bloom_log',
 '{"th":"บันทึกการออกดอก","my":"ပန်းပွင့်မှတ်တမ်း","en":"Bloom logging","icon":"🌸"}',
 'always',
 NULL,
 TRUE, 15, 25,
 '[
   {"field_id":"color","type":"color_picker","label_icon":"🎨",
    "label":{"th":"สีเชือก","my":"အရောင်","en":"Ribbon color"},
    "required":true,
    "options":[
      {"value":"red","icon":"🔴","label":{"th":"แดง","my":"အနီ","en":"Red"}},
      {"value":"blue","icon":"🔵","label":{"th":"น้ำเงิน","my":"အပြာ","en":"Blue"}},
      {"value":"yellow","icon":"🟡","label":{"th":"เหลือง","my":"အဝါ","en":"Yellow"}},
      {"value":"white","icon":"⚪","label":{"th":"ขาว","my":"အဖြူ","en":"White"}}
    ]},
   {"field_id":"flower_count","type":"numeric_counter","label_icon":"🌼",
    "label":{"th":"จำนวนดอก","my":"ပန်းအရေအတွက်","en":"Flower count"},
    "required":true,"min":0,"max":500,"warn_above":200,"step":1}
 ]'
),

-- 4. Pest inspection
('pest_inspection_v1', 'pest_inspection',
 '{"th":"ตรวจหาศัตรูพืช","my":"ပိုးမွှားစစ်ဆေးခြင်း","en":"Pest inspection","icon":"🐛"}',
 'always',
 NULL,
 TRUE, 15, 25,
 '[
   {"field_id":"severity","type":"severity_picker","label_icon":"⚠️",
    "label":{"th":"ความรุนแรง","my":"ပြင်းထန်မှု","en":"Severity"},
    "required":true,
    "options":[
      {"value":"none","icon":"✅","label":{"th":"ไม่พบ","my":"မရှိ","en":"None"}},
      {"value":"mild","icon":"🟡","label":{"th":"เล็กน้อย","my":"အနည်းငယ်","en":"Mild"}},
      {"value":"moderate","icon":"🟠","label":{"th":"ปานกลาง","my":"အလယ်အလတ်","en":"Moderate"}},
      {"value":"severe","icon":"🔴","label":{"th":"รุนแรง","my":"ပြင်းထန်","en":"Severe"}}
    ]}
 ]'
),

-- 5. Soil acidity check
('soil_acidity_check_v1', 'soil_check',
 '{"th":"ตรวจค่ากรดดิน","my":"မြေဆီလွှာစစ်ဆေးခြင်း","en":"Soil acidity check","icon":"🧪"}',
 'audit_only',
 '{"trusted":0.01,"standard":0.05,"audit":0.15}',
 TRUE, 15, 25,
 '[
   {"field_id":"ph","type":"numeric_counter","label_icon":"🧪",
    "label":{"th":"ค่า pH","my":"pH တန်ဖိုး","en":"pH"},
    "required":true,"min":3.5,"max":8.0,"default_value":6.5,"warn_below":4.5,"warn_above":7.5,"step":0.1},
   {"field_id":"moisture_pct","type":"numeric_counter","label_icon":"💧",
    "label":{"th":"ความชื้น (%)","my":"စိုထိုင်းမှု (%)","en":"Moisture (%)"},
    "required":true,"min":0,"max":100,"warn_above":90,"step":1}
 ]'
),

-- 6. Harvest logging
('harvest_log_v1', 'harvest',
 '{"th":"บันทึกการเก็บเกี่ยว","my":"ရိတ်သိမ်းမှတ်တမ်း","en":"Harvest logging","icon":"🛒"}',
 'always',
 NULL,
 TRUE, 20, 30,
 '[
   {"field_id":"set_color","type":"color_picker","label_icon":"🎨",
    "label":{"th":"สีชุด","my":"အရောင်","en":"Set color"},
    "required":true,
    "options":[
      {"value":"red","icon":"🔴","label":{"th":"แดง","my":"အနီ","en":"Red"}},
      {"value":"blue","icon":"🔵","label":{"th":"น้ำเงิน","my":"အပြာ","en":"Blue"}},
      {"value":"yellow","icon":"🟡","label":{"th":"เหลือง","my":"အဝါ","en":"Yellow"}},
      {"value":"white","icon":"⚪","label":{"th":"ขาว","my":"အဖြူ","en":"White"}}
    ]},
   {"field_id":"fruit_count","type":"numeric_counter","label_icon":"🥭",
    "label":{"th":"จำนวนผล","my":"သီးအရေအတွက်","en":"Fruit count"},
    "required":true,"min":0,"max":200,"step":1},
   {"field_id":"grade","type":"dropdown","label_icon":"⭐",
    "label":{"th":"เกรด","my":"အဆင့်","en":"Grade"},
    "required":true,
    "options":[
      {"value":"A","icon":"🥇","label":{"th":"A","my":"A","en":"A"}},
      {"value":"B","icon":"🥈","label":{"th":"B","my":"B","en":"B"}},
      {"value":"C","icon":"🥉","label":{"th":"C","my":"C","en":"C"}},
      {"value":"reject","icon":"❌","label":{"th":"ไม่ผ่าน","my":"ပယ်ဖျက်","en":"Reject"}}
    ]}
 ]'
);
