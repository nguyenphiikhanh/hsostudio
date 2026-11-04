# Đối chiếu tấn công HSO và bản thử Studio

Trạng thái: đọc được dữ liệu server; chuỗi animation trong Studio là thử nghiệm có thể chỉnh, chưa khôi phục được bảng animation client.

## 1. Bằng chứng từ server

- `hso/src/main/java/core/Manager.java`: nạp bốn file `data/msg/msg_29_chienbinh`, `msg_29_satthu`, `msg_29_phapsu`, `msg_29_xathu`.
- `hso/src/main/java/client/Player.java`, `load_skill()`: chọn packet theo clazz 0–3 và đọc cấu trúc bên dưới. Thư mục Java `client/` ở đây là code server quản lý người chơi/session, không phải renderer game.
- `hso/src/main/java/core/Service.java`, `send_skill()`: gửi nguyên packet theo phái bằng message 29.
- `hso/src/main/java/map/MapService.java`, `use_skill()`: đọc skill ID, yêu cầu `wear[0]` có vũ khí, kiểm tra level/MP/cooldown và tính sát thương. Cooldown dùng `System.currentTimeMillis()`, với giá trị delay điều chỉnh `delay * 199 / 200`.
- `fire_mob()` gửi message 9 gồm người đánh, skill ID, mục tiêu, sát thương và HP. Đây không phải bảng thứ tự sprite.

Parser `scripts/combat_catalog.py` đọc **21 kỹ năng × 4 phái = 84**, kiểm tra hết byte, ID duy nhất liên tục và SHA-256 packet. Dữ liệu được lưu trong cùng SQLite và xuất trong `combat.json`; không tải JSON sidecar riêng.

| clazz | Phái | item3.type vũ khí | Số item | Skill 0 | delay cấp đầu | typePaint | subEff | performDur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Chiến binh | 8 | 141 | Trọng kiếm | 1000 | 0 | -1 | 0 |
| 1 | Sát thủ | 9 | 141 | Đoản kiếm | 1000 | 0 | -1 | 0 |
| 2 | Pháp sư | 11 | 141 | Gậy tự vệ | 1000 | 0 | -1 | 0 |
| 3 | Xạ thủ | 10 | 141 | Bắn thường | 1000 | 0 | -1 | 0 |

Tên kỹ năng và tất cả cấp kỹ năng lấy từ packet, không suy ra bằng tên vật phẩm. `performDur` bằng 0 trong cả 84 kỹ năng. `typePaint` 0/1 và `subEff` được giữ nguyên; chưa tìm thấy code giải nghĩa chúng thành một chuỗi crop/ảnh hiệu ứng. Không coi `subEff` là ID file PNG. Delay là cooldown, không phải thời lượng animation hay thời điểm hit.

## 2. Cấu trúc packet được đối chiếu

Theo thứ tự đọc của `Player.load_skill()` (big endian):

- byte: số kỹ năng.
- Mỗi kỹ năng: byte id, byte icon, Java modified UTF name, byte type, short range, Java modified UTF detail, byte typeBuff, byte subEff, byte số cấp.
- Mỗi cấp: short mpLost, short LvRe, int delay, int timeBuff, byte per_Sub_Eff, short time_Sub_Eff, short plus_Hp, short plus_Mp; byte số option; mỗi option có unsigned byte id và int param; byte nTarget; short range_lan.
- Sau các cấp: short performDur và byte typePaint.

Parser không lấy thứ tự record làm skill ID: nó sắp theo id để khớp `skills[skill.id]`. Không bỏ qua byte dư hoặc chấp nhận packet bị cắt.

## 3. Sprite gốc và điểm chưa xác nhận

Áo/quần có 15 rectangle và 24 cặp offset signed trong packet. Rig preview đang suy ra ba nhóm crop front/back/side × 5 pose và bốn nhóm anchor × 6 pose. Các nhóm này đã dùng cho đứng/đi nhưng chưa có client để xác nhận toàn bộ ý nghĩa.

Pose crop 3/4 chưa dùng trong walking, có hình tay/thân khác tư thế đứng. Chúng là **ứng viên**, không mặc định là frame đánh gốc. Crop có 5 pose nhưng anchor có 6 pose nên không được khẳng định hai bảng cùng index cho mọi động tác. Bản thử cho chỉnh crop A/B (0–4) và anchor A/B (0–5) riêng.

Các packet ảnh x4 `50_*`, `51_*`, `52_*`, `53_*` có 25 PNG mỗi họ và 32 byte sau PNG. Một số ảnh quan sát giống vũ khí, nhưng chưa có bằng chứng liên kết các họ này sang item3.type 8–11, item.part, tay cầm hoặc hướng. 141 item mỗi nhóm vũ khí cũng không đồng nghĩa 141 sheet trong các họ này. `Service.get_id_weapon()` xử lý cosmetic `wear[17].part + 41`, không chứng minh ánh xạ cho vũ khí thường ở wear[0].

Ảnh hiệu ứng có nhiều cấu trúc packet. Không gán họ 110/111/112/113 hoặc số file bằng `subEff`/skill ID chỉ vì trùng số.

## 4. Phạm vi bản thử

- Giữ toàn bộ PNG/crop/offset gốc, x4 và fallback đã kiểm chứng.
- Chuỗi mặc định `0 → 3 → 4 → 0`, 8 FPS là **Studio trial**, chỉnh được. Các phái dùng cùng chuỗi thử; dữ liệu server của từng phái hiển thị riêng.
- Preview lặp để đối chiếu; có pause/step và bốn hướng, với hướng phải lật từ side như preview cũ.
- Tắt thở khi thử tấn công; không áp dụng hiệu ứng giãn áo của idle vào đòn đánh.
- ZIP v1 có `animations.states.attack` với `experimental: true`, `provenance: studio-trial`, `repeat: 0`, clazz/skill ID và cấu hình crop/anchor. `combat.json` chứa dữ liệu server và nguồn/hash.
- Phaser runtime chỉ bật crop mở rộng khi clip mang cờ experimental. `setState('attack', direction)` phát một lần, giữ pose cuối trung tính; gọi lại để phát lại, gọi `setState('idle')` để quay về thở.
- Panel bộ phận chỉ đối chiếu vật phẩm vũ khí thật theo phái/cấp/slot; không dựng sheet lên nhân vật khi ánh xạ texture hoặc điểm cầm chưa xác minh. Không dựng hiệu ứng, không có hit event, không dùng cooldown để đoán FPS. Bản H5 arena vẫn dùng cơ chế đánh mẫu trước đó; bản thử này dành cho kiểm tra Studio và runtime thư viện.

## 5. Cách thử

1. Chạy `npm run prepare:game`, mở/tải lại Studio.
2. Chọn Trạng thái **Tấn công · thử nghiệm**.
3. Chọn phái, kỹ năng và cấp để đối chiếu dữ liệu server.
4. Pause và bước từng frame. Thử pose A/B, anchor A/B; thay áo/quần để đánh giá liên kết trên nhiều thiết kế.
5. Xuất thư viện part. Dùng `character.setState('attack', 'left')` trong ví dụ Phaser; xem nhãn thử nghiệm trong animations.json và combat.json.

Cần client, video gốc có frame rõ, hoặc bảng tác giả xác nhận để nâng một chuỗi cụ thể từ thử nghiệm thành animation đã xác minh. Chỉnh pose trong Studio không tự đổi trạng thái xác minh.
