# Renderer vũ khí và đòn cơ bản: client HSO 4.0.3

## Nguồn và phạm vi

Đã lấy client Java qua liên kết JAVA trên trang nhà phát hành https://gomobi.vn/home/game/Knight-Age-7.html, chuyển hướng HTTP từ wap.teamobi.com/game/jar/116/4 đến http://dl.teamobi.com/wap/bin/KnightOnline_v403.jar.

Manifest ghi 4.0.3. SHA-256: `f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6`.

Phân tích tĩnh bằng CFR và javap; không chạy client hoặc đăng nhập server. Không đưa code decompile vào repo. `reference/hso403/client.json` lưu hash bytecode, các bảng số phục vụ tương thích, metadata WPS và nguồn; bốn PNG WPS giữ nguyên từ JAR. `scripts/import_client403.py /path/to/original.jar` nhập lại chỉ khi checksum khớp.

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
- Chiêu khác vẫn giữ bộ đối chiếu thân thử nghiệm; vũ khí bị ẩn ở đường chưa xác minh, không dùng sheet đứng yên thay animation.
- Preview đứng/đi vẫn giữ chu kỳ Studio hiện có; khi có vũ khí dùng mapping crop/anchor và mirror client để khớp rig. Nhịp thở là xử lý Studio, không khẳng định là nguyên bản.
- WPS trong JAR này chỉ có x1. PNG đứng/đi ưu tiên x4 nguồn server; không tự tạo WPS HD.
- Xuất tư thế giữ sprite thực tế đang xem (WPS hoặc vũ khí thường) và draw order.
- Xuất thư viện part giữ clip body cơ bản theo client khi đang ở chế độ đó, 25FPS và provenance/hash. Thư viện vẫn chưa equip texture vũ khí/WPS; weapon được ghi vào omittedLayers. Không nhầm export tư thế với runtime trang bị vũ khí hoàn chỉnh.

## Chưa triển khai

Vũ khí thời trang wear17 dùng renderer hiệu ứng riêng; các chiêu skill1–20, projectile/hit effect và thời điểm sát thương chưa được port. Dữ liệu/mapping vừa tìm thấy không nâng các đường đó thành “đã xác minh”.
