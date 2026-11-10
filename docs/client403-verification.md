# Renderer vũ khí và đòn cơ bản: client HSO 4.0.3

## Nguồn và phạm vi

Đã lấy client Java qua liên kết JAVA trên trang nhà phát hành https://gomobi.vn/home/game/Knight-Age-7.html, chuyển hướng HTTP từ wap.teamobi.com/game/jar/116/4 đến http://dl.teamobi.com/wap/bin/KnightOnline_v403.jar.

Manifest ghi 4.0.3. SHA-256: `f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6`.

Phân tích tĩnh bằng CFR và javap; không chạy client hoặc đăng nhập server. Không đưa code decompile vào repo. `reference/hso403/client.json` lưu hash bytecode, các bảng số phục vụ tương thích, metadata WPS và nguồn; bốn PNG WPS giữ nguyên từ JAR. Các PNG đã xác minh được đóng gói trong `public/game/client403`.

Đây là bằng chứng theo **client 4.0.3**, không khẳng định mọi client HSO lịch sử dùng cùng animation. Để kiểm tra tương thích, đã so **72 PNG và 72 tail metadata nguyên byte** (part0–17 của cả bốn phái) với dữ liệu x1 trong workspace: trùng toàn bộ. Các thiết kế part18–23 dùng cùng bộ đọc giao thức đã xác minh; geometry từng PNG được kiểm tra riêng.

## Mapping vũ khí thường đã xác nhận

Chuỗi xử lý:

1. Server `Player.player_wear`: item.type 8–11 vào slot0.
2. Server `Service.send_wear`: gửi slot, clazz, type, icon, part.
3. Client `MainObject.setWearingEquip`: lấy weaponType từ part của slot0.
4. Client `CRes.getFromRms`: request message -52 với type = 50 + clazz và id = weaponType.
5. Server `MessageHandler`, case -52: trả packet `{type}_{id}` theo zoom.
6. Client `CRes.getImgWeaPone`: đọc bốn nhóm: ba cặp signed x/y, sau đó region x/width. Chiều cao là chiều cao ảnh logical.
7. Client `MainObject.paintWeapon`: lấy đúng nhóm theo Direction (down0/up1/left2/right3), dùng offset row min(bodyFrame,2), không xoay/mirror ảnh vũ khí thường.

Do đó chỉ các cặp (clazz, part) thực sự có item3 vũ khí thường được đưa vào renderer: **96 cặp**, không phải tùy chọn mọi sheet cho mọi phái. Lọc class/level theo server được giữ lại. PNG x4 lỗi geometry có fallback x1 ghi rõ, không phóng ảnh x1 rồi gọi là HD.

## Tấn công không dùng sheet đứng yên để xoay

Client `CRes.GetWPSplashInfo` đọc sheet `/wps/{kiem|songkiem|phapsu|sung}/0` và metadata gồm 4 hướng × 8 frame × 6 byte: crop X/Y unsigned, offset X/Y signed, width/height unsigned.

`MainListSkill.mSkillAllClasses[clazz][0]` trỏ các skill nội bộ 15/15/31/31; sau phép xử lý của `ListSkill`, cả bốn đòn cơ bản đi vào SplashSkill type0. Port hiện tại chỉ bật đường xác minh này cho **skill server #0**.

- Tick0–3: bodyFrame4, weaponFrame4.
- Tick4–7: bodyFrame5, weaponFrame4–7 tương ứng tick.
- Tick8: Action về đứng, bodyFrame0 và weaponFrame0.
- `TemCanvas.run`: mục tiêu 40ms/tick (25FPS). Preview lặp để kiểm tra; không mô phỏng thời gian hồi chiêu và không thêm hit event.

`CharPartInfo.PART_OF_FRAME` xác nhận bodyFrame0–5 ứng với crop0/0/1/2/3/4 cho áo/quần. Anchor dùng bodyFrame, không coi cropIndex bằng anchorIndex. Khi nhìn phải, client lật hình side, dùng `-dxSide - width` và dySide.

Thứ tự trước/sau cơ thể theo `MainObject.paint`: Direction up luôn vẽ weapon sau các lớp cơ thể; các hướng còn lại đổi thứ tự theo clazz và bodyFrame (xạ thủ frame4, các phái khác frame5). Canvas preview áp dụng cùng điều kiện. “Sau các lớp” nghĩa là vẽ sau trong draw order, tức hiện phía trước; không suy từ tên hướng.

## Hành vi Studio

- Chọn vật phẩm thật ở **Vũ khí thường HSO** để thêm lớp vũ khí đã ánh xạ.
- Chọn **Tấn công** và **kỹ năng #0**: tự chuyển sang frame client 25FPS, khóa FPS thủ công và ẩn điều khiển pose A/B.
- Skill catalog client hiện có mapping body/WPS cho các slot 0–20. Preview effect chính áp dụng cho các nhóm đánh #1–#8, khống chế #17 và diện rộng #19–#20. Passive/buff không có chuỗi đánh vũ khí.
- Đi bộ đã dùng A_Move 10 tick ở 25 FPS và cùng mapping crop/anchor/mirror client cho nhân vật có hoặc không có vũ khí. Nhịp thở vẫn là xử lý Studio. Xem walk-verification.md.
- WPS trong JAR này chỉ có x1. PNG đứng/đi ưu tiên x4 nguồn server; không tự tạo WPS HD.
- Xuất tư thế giữ sprite thực tế đang xem (WPS hoặc vũ khí thường) và draw order.
- Xuất thư viện part giữ clip body cơ bản theo client khi đang ở chế độ đó, 25FPS và provenance/hash. Thư viện vẫn chưa equip texture vũ khí/WPS; weapon được ghi vào omittedLayers. Không nhầm export tư thế với runtime trang bị vũ khí hoàn chỉnh.

## Chưa triển khai

Vũ khí thời trang wear17 dùng renderer hiệu ứng riêng; hiệu ứng phụ và thời điểm sát thương chưa được port. Các effect ID 116–123 đi qua nhánh `GameScreen.StartAddEffectSkill` rồi chuyển sang EffectSkill ID 11/20/34/49/51/53/54/55/60/62/65/66/77/91/114/115; preview dùng các FrameImage chính của nhánh đó. Bảng mapping body/WPS và effect ID đủ 84 ô nằm trong `reference/hso403/client.json`.


## Chiêu #1: đối chiếu và bản khôi phục

Chuỗi dữ liệu: `MainListSkill.mSkillAllClasses[clazz][1] → mPlash/mFramePlash/mEffectKill → ListSkill.setFireSkill/updateEffSkill → SplashSkill/EffectSkill`. `ListSkill` chia nguyên plash và trigger cho 2 ở clazz3; vì vậy gunner **16 → 8** và **9 → 4**, không được giữ type16 rồi chỉ tăng FPS.

| clazz | Internal ID | Plash sau xử lý | Windup | Thân kết thúc tại tick | Effect ID | Trigger |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 23 | 1 | 6 | 10 | 28 | 9 |
| 1 | 44 | 1 | 6 | 10 | 55 | 9 |
| 2 | 46 | 1 | 6 | 10 | 59 | 9 |
| 3 | 19 | 8 | 10 | 14 | 23 | 4 |

Trước windup dùng body4/WPS4; bốn tick tiếp dùng body5/WPS4–7, sau đó body0/WPS0. Trigger hiệu ứng được kiểm tra trước SplashSkill.update. Tick đánh số từ 0, mỗi tick40ms.

Các nhánh được port cho mục tiêu tĩnh cao40 (Player.hOne):

- Effect28 `create_Kiem_Lv2`: g53, frame=f/2, 6 tick; vị trí chân mục tiêu+hOne/4, anchor17 tại y-frameHeight.
- Effect55: g51 ở tâm mục tiêu trong 6 tick đầu; các line có hướng, màu, số lượng, vận tốc và tuổi thọ theo `EffectSkill.update case55` / `Model.Line.update`.
- Effect59: g17 bay với vMax14 theo phép chia nguyên `create_Speed`; tiếp theo g24 tại mục tiêu trong6 tick.
- Effect23 `create_Sung_Lv3`: bốn đạn g47, lệch đích ngẫu nhiên0–12, vMax22; frame/transform từ các bảng bullet. Khi hết đạn và f>=5 tạo EffectEnd12/g60 trong4 tick.

`ImageEffect.getEffectImgFromRMS` xác nhận request type110; `FrameImage` xác nhận sprite strip dọc qua `arrInfoEff`. Sáu PNG x4 được lấy nguyên từ server và kiểm tra chính xác kích thước/density, checksum lưu trong reference. Bytecode EffectSkill, EffectEnd, FrameImage, ImageEffect được bổ sung vào hash reference của cùng JAR đã khóa.

Preview có seed cố định để kiểm thử và xem từng frame; dùng quy tắc ngẫu nhiên cùng khoảng giá trị, không tái lập RNG Java từng lần chạy. Mục tiêu là fixture tĩnh, không khôi phục AI/collider/quái. Vòng32tick là thời gian xem của Studio, không phải clip/cooldown client. Thư viện chỉ xuất timeline thân với provenance, internalSkillId, plashType và effectTick; FX/weapon runtime không nằm trong ZIP part.

Chưa port: Effect29 tụ lực, EffectEnd9 bụi đá, rung màn hình, tương tác nước, âm thanh, sát thương và mục tiêu di chuyển. UI ghi rõ phạm vi này.

## Chiêu #2: Hỏa kiếm, Độc kiếm, Đá tuyết, Phóng điện

`MainListSkill.mSkillAllClasses[clazz][2]` xác định internal skill ID **41/36/20/18**. `mEffectKill` ánh xạ lần lượt sang effect **52/46/25/22**. Ba phái đầu dùng plash 1 và trigger frame 9; Xạ thủ dùng plash 16, frame 9, sau `ListSkill.setFireSkill` chia đôi thành plash 8 và trigger tick 4. Vì các giá trị body/WPS plash trùng chiêu #1, preview dùng cùng chu kỳ client 4.0.3: body frame 4 trước windup, body 5 cùng WPS 4–7 ở nhịp đánh, rồi body/WPS 0.

| clazz | Server skill | Internal ID | Plash sau xử lý | Effect ID | Tick hiệu ứng | FrameImage |
|---:|---|---:|---:|---:|---:|---|
| 0 | Hỏa kiếm | 41 | 1 | 52 | 9 | 83, 68 |
| 1 | Độc kiếm | 36 | 1 | 46 | 9 | 70, 72 |
| 2 | Đá tuyết | 20 | 1 | 25 | 9 | 57, 3 |
| 3 | Phóng điện | 18 | 8 | 22 | 4 | 74 |

Các ảnh `110_83/68/70/72/57/3/74` lấy nguyên từ packet server x4. `arrInfoEff` trong client 4.0.3 xác nhận kích thước frame và số frame; SHA-256 đã lưu trong `reference/hso403/client.json`. Preview tái hiện sprite/đường bay chính cho mục tiêu tĩnh, còn chuyển động hạt ngẫu nhiên, tương tác nước, âm thanh, sát thương và cooldown chưa mô phỏng.

## Chiêu #3: Rồng đất, Tia chớp, Sóng xung kích, Súng phóng lựu

`MainListSkill.mSkillAllClasses[clazz][3]` ánh xạ internal ID **21/22/39/24**; `mEffectKill` cho effect **26/27/49/31**. Xạ thủ chia đôi plash/frame từ **11/11** xuống **5/5**. `SplashSkill.setPlash` cho windup 8 tick với plash 5 và 6 tick với plash 1. FrameImage lấy từ nhánh `EffectSkill.set_New_Effect`; kích thước và số frame lấy từ `arrInfoEff`.

| clazz | Kỹ năng | Internal ID | Plash | Trigger | Effect | FrameImage |
|---:|---|---:|---:|---:|---:|---|
| 0 | Rồng đất | 21 | 5 | 11 | 26 | 8, 53 |
| 1 | Tia chớp | 22 | 1 | 9 | 27 | 50 |
| 2 | Sóng xung kích | 39 | 5 | 11 | 49 | 23, 24 |
| 3 | Súng phóng lựu | 24 | 5 | 5 | 31 | 31, 97 |

Preview cho thấy sprite/đường bay chính của các nhánh **EffectSkill 26/27/49/31** trong một mục tiêu tĩnh. Cụm sprite, hướng bay phụ, mảnh ngẫu nhiên, sát thương, âm thanh và cooldown chưa được tái hiện đầy đủ; không dùng preview này như mô phỏng gameplay.

## Chiêu #4: Thiên thạch, Xúc tu gai độc, Rồng băng giá, Tia công phá

`MainListSkill.mSkillAllClasses[clazz][4]` ánh xạ internal ID **5/37/51/40**; `mEffectKill` cho effect **11/47/64/51**. Ba phái đầu dùng plash 5, trigger tick 11. Xạ thủ có raw plash/frame **6/11**; `ListSkill.setFireSkill` chia đôi thành plash 3, trigger tick 5. Type 3 dùng nhánh riêng của `SplashSkill.update`: hai tick đầu body 5/WPS 4, tiếp bốn tick body 4/WPS 4–7, rồi về 0.

| clazz | Kỹ năng | Internal ID | Plash sau xử lý | Trigger | Effect | FrameImage |
|---:|---|---:|---:|---:|---:|---|
| 0 | Thiên thạch | 5 | 5 | 11 | 11 | 30, 31, 40 |
| 1 | Xúc tu gai độc | 37 | 5 | 11 | 47 | 87, 75 |
| 2 | Rồng băng giá | 51 | 5 | 11 | 64 | 95, 53 |
| 3 | Tia công phá | 40 | 3 | 5 | 51 | 21, 59 |

Các sprite x4 và kích thước frame lấy từ `arrInfoEff`; SHA-256 lưu trong `reference/hso403/client.json`. Preview thể hiện nhóm sprite chính trên mục tiêu tĩnh; hiệu ứng phụ và chuyển động ngẫu nhiên chưa được port đầy đủ.

## Các chiêu đánh còn lại và chiêu khống chế/diện rộng

`EffectSkill.set_New_Effect` cung cấp FrameImage cho chiêu #5–#8 và #17. Với effect server **116–123**, `GameScreen.StartAddEffectSkill` chuyển ID thành các effect client bên dưới trước khi tạo sprite. Các hàng trong bảng là danh sách sprite x4 chính hiển thị theo thứ tự phái: **Chiến binh / Sát thủ / Pháp sư / Xạ thủ**.

| Slot | Effect ID server | FrameImage chính theo phái |
|---:|---|---|
| #5 | 53 / 34 / 12 / 62 | `85,53` / `33,18` / tia nứt vẽ theo nhánh `create_Crack_Earth` / `47` |
| #6 | 54 / 40 / 61 / 82 | `83,68` / `15,17,26` / `71,5,92` / `127,75` |
| #7 | 53 / 34 / 60 / 65 | `85,53` / `33,18` / tia điện vẽ theo nhánh effect 60 / `65,94` |
| #8 | 11 / 20 / 61 / 66 | `30,31,40` / `91,118–121` / `71,5,92` / nhát sáng minh họa; nhánh 66 không gắn FrameImage |
| #17 | 110 / 112 / 109 / 111 | `115` / `127,75` / `92` / `127,75` |
| #19 | 116 / 117 / 119 / 118 | `85,53,114,116,115` / `91,118–121` / `24,7` / `65,94,47` |
| #20 | 120 / 121 / 123 / 122 | `83,68,30,31,40` / `33,18,51` / `23,24` / `21,59` |

Preview dùng trigger tick trong catalog client, sprite frame tuần tự và fixture mục tiêu tĩnh. Các tia trong nhánh không có FrameImage là hình minh họa cố định; đường bay nhiều mục tiêu, số lượng/hướng ngẫu nhiên, hiệu ứng trạng thái phụ, sát thương, âm thanh và cooldown không được tái hiện. Slot passive/buff không bật renderer đánh.


## Bộ chọn ngoại hình và biến thể

Mỗi phái có24 ngoại hình vũ khí thường, tương ứng141 template vật phẩm. Bộ chọn chính gom theo `(phái hiện tại, part)`; bộ chọn biến thể giữ nguyên toàn bộ ID/tên/cấp/màu. Không gộp hoặc xóa vật phẩm trong catalog, không thêm part24 vì dump không có item thường tương ứng.

Preview mặc định cho chọn mọi cấp. Checkbox “Áp dụng điều kiện trang bị” bật lại kiểm tra cấp của server; khi bật và vật phẩm đang chọn không đủ điều kiện, Studio bỏ lựa chọn và lớp vũ khí. Việc bỏ giới hạn cấp trong preview không thay quy tắc game. Đổi phái xóa lựa chọn cũ, ánh xạ ảnh/animation vẫn theo phái hiện tại.

9 vật phẩm thời trang vẫn chọn được để đối chiếu ở chế độ preview. Chúng chưa có renderer được xác minh; lựa chọn này báo rõ chưa thay đổi ảnh trên nhân vật và giữ vũ khí thường. Không dùng icon hoặc part+41 để giả làm sheet thường. Hệ thống hiện **chưa đầy đủ renderer thời trang**.

Kiểm thử Chrome duyệt96 ngoại hình của bốn phái tại cấp1, chọn biến thể, đối chiếu9 món thời trang, kiểm tra bật/tắt điều kiện và WPS. Kiểm thử unit xác nhận564 template thường được giữ đủ trong96 nhóm.

## Dữ liệu kỹ năng từ server

### Bằng chứng từ server

- `hso/src/main/java/core/Manager.java`: nạp bốn file `data/msg/msg_29_chienbinh`, `msg_29_satthu`, `msg_29_phapsu`, `msg_29_xathu`.
- `hso/src/main/java/client/Player.java`, `load_skill()`: chọn packet theo clazz 0–3 và đọc cấu trúc bên dưới. Thư mục Java `client/` ở đây là code server quản lý người chơi/session, không phải renderer game.
- `hso/src/main/java/core/Service.java`, `send_skill()`: gửi nguyên packet theo phái bằng message 29.
- `hso/src/main/java/map/MapService.java`, `use_skill()`: đọc skill ID, yêu cầu `wear[0]` có vũ khí, kiểm tra level/MP/cooldown và tính sát thương. Cooldown dùng `System.currentTimeMillis()`, với giá trị delay điều chỉnh `delay * 199 / 200`.
- `fire_mob()` gửi message 9 gồm người đánh, skill ID, mục tiêu, sát thương và HP. Đây không phải bảng thứ tự sprite.

Catalog đóng gói sẵn chứa **21 kỹ năng × 4 phái = 84**, đã kiểm tra hết byte, ID duy nhất liên tục và SHA-256 packet. Dữ liệu được lưu trong cùng SQLite và xuất trong `combat.json`; không tải JSON sidecar riêng.

| clazz | Phái | item3.type vũ khí | Số item | Skill 0 | delay cấp đầu | typePaint | subEff | performDur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Chiến binh | 8 | 141 | Trọng kiếm | 1000 | 0 | -1 | 0 |
| 1 | Sát thủ | 9 | 141 | Đoản kiếm | 1000 | 0 | -1 | 0 |
| 2 | Pháp sư | 11 | 141 | Gậy tự vệ | 1000 | 0 | -1 | 0 |
| 3 | Xạ thủ | 10 | 141 | Bắn thường | 1000 | 0 | -1 | 0 |

Tên kỹ năng và tất cả cấp kỹ năng lấy từ packet, không suy ra bằng tên vật phẩm. `performDur` bằng 0 trong cả 84 kỹ năng. `typePaint` 0/1 và `subEff` được giữ nguyên; chưa tìm thấy code giải nghĩa chúng thành một chuỗi crop/ảnh hiệu ứng. Không coi `subEff` là ID file PNG. Delay là cooldown, không phải thời lượng animation hay thời điểm hit.

### Cấu trúc packet được đối chiếu

Theo thứ tự đọc của `Player.load_skill()` (big endian):

- byte: số kỹ năng.
- Mỗi kỹ năng: byte id, byte icon, Java modified UTF name, byte type, short range, Java modified UTF detail, byte typeBuff, byte subEff, byte số cấp.
- Mỗi cấp: short mpLost, short LvRe, int delay, int timeBuff, byte per_Sub_Eff, short time_Sub_Eff, short plus_Hp, short plus_Mp; byte số option; mỗi option có unsigned byte id và int param; byte nTarget; short range_lan.
- Sau các cấp: short performDur và byte typePaint.

Parser không lấy thứ tự record làm skill ID: nó sắp theo id để khớp `skills[skill.id]`. Không bỏ qua byte dư hoặc chấp nhận packet bị cắt.

### Chế độ thử pose

Khi chưa dùng renderer vũ khí/clip client đã xác minh, Studio vẫn có chuỗi thử pose A/B và anchor A/B từ crop gốc. Chuỗi này giữ nhãn `experimental: true`, `provenance: studio-trial`; chỉnh pose không tự biến nó thành animation HSO đã xác minh. Không suy FPS, thời điểm hit hay liên kết PNG từ cooldown, subEff hoặc tên file. Runtime phát đòn thử một lần rồi giữ pose cuối; `setState('idle')` quay về đứng. Các mục client/body/WPS đã xác minh được mô tả ở các phần phía trên.
