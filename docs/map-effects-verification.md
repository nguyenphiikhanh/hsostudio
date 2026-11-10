# Đối chiếu hiệu ứng map HSO 4.0.3

Ngày kiểm tra: 2026-11-10. Nước/thác đã được triển khai trong Studio và exporter, có hai tùy chọn bật/tắt riêng (mặc định tắt).

Nguồn: `KnightOnline_v403.jar`, SHA-256 `f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6`. Đọc bytecode bằng javap cho `Thread_More.LoadMap`, `GameObjects.ThacNuoc`, `GameScreen.GameScreen`, `Map.MapBackGround`, `Map.BackGround`, `netcommand.global.ReadMessenge`; kiểm tra PNG header và toàn bộ 91 layout đóng gói. Không thêm phụ thuộc Java/Python vào project.

## Nước: đổi nguồn ảnh, không cuộn sheet theo thời gian

`LoadMap.paint` lấy tile index `i = tileId - 1`. Với tileset cũ, vùng nước là `fWater <= tileId < fStand`. Với tileset mới, vùng vẽ nước là `fStartWater <= tileId <= fEndWater`.

Ảnh nước được chọn khi `(gameTick % 14 < 7 && col % 2 == 0) || (gameTick % 14 > 7 && col % 2 != 0)`. Các thời điểm còn lại dùng ảnh terrain; tick dư 7 dùng terrain ở cả hai loại cột. Đây là điều kiện bất đối xứng của bytecode, không được thay bằng hai nửa chu kỳ đều nhau.

Trong ảnh nước, đặt `k = tileId - start`, cắt ô tại `x = floor(k / 10) * 24`, `y = (k % 10) * 24`, kích thước 24×24 logical. Terrain cắt tại x=0, y=(tileId−1)×24. Ở nhịp client 40ms/tick, chu kỳ nước dài 560ms. Không phải sprite animation liên tiếp nhiều frame.

Các tileset mới có vùng nước: 9=[19,26], 10=[4,25], 11=[20,37], 12=[35,44]. Không dùng `tileset.info` thay các hằng số override trong client. Tileset 14 không có vùng nước động.

Client thử `/tilewater<id>.png`, rồi cache loại 102, rồi yêu cầu server image ID `10500 + id`. Do đó mã ID ảnh server không chứng minh rằng PNG thực tế đủ kích thước.

### Kiểm tra ảnh đang đóng gói

| Tileset | PNG nước x4 | Kết quả với các ô thực sự được dùng |
| --- | --- | --- |
| 0,1,3,4,6,10 | Đủ kích thước crop | Có thể triển khai renderer theo quy tắc gốc; vẫn cần kiểm chứng hình ảnh |
| 9 | 192×384 px | 45 lượt ô trong các layout yêu cầu crop ngoài ảnh |
| 11 | 4×4 px | 767 lượt ô nước không thể crop |
| 12 | 4×4 px | 924 lượt ô nước không thể crop |

JAR có `x1/tilewater9.png` 24×192, `tilewater11.png` và `tilewater12.png` 48×240; các kích thước này đủ cho vùng crop gốc tương ứng. Ảnh đã được sao chép nguyên bản vào public/game/maps/effects, ghi provenance/checksum/density trong manifest và thông báo fallback x1. Chưa xác nhận các bản x4 thiếu ô là lỗi dữ liệu hay khác phiên bản; không tự kéo giãn hoặc vẽ bù.

## Thác: actor nền riêng

`LoadMap.loadmap` tạo `ThacNuoc` theo tile:

| Tileset | Tile ID | ID sheet thác |
| --- | --- | --- |
| 9 | 27..31 | tileId−27 → 0..4 |
| 10 | 18..19 | tileId−18+5 → 5..6 |
| 11 | 38..39 | tileId−38+7 → 7..8 |

Tọa độ = col×24, row×24. Chín file `x1/tilethac0.png`..`tilethac8.png` trong JAR đều 24×96 px: bốn frame dọc 24×24. `ThacNuoc.update` tăng index modulo 4 khi `gameTick % 4 == 0`. Mỗi frame khoảng 160ms, vòng khoảng 640ms (6.25 frame/giây); pha ban đầu phụ thuộc tick lúc khởi tạo actor.

`GameScreen.paint` vẽ terrain trước, sau đó mới vẽ các actor thác; không thay tile nền bằng sheet thác. Chưa đối chiếu toàn bộ thứ tự với actor và hiệu ứng khác để tuyên bố khôi phục cả cảnh.

Các map có tile tạo thác:

- Tileset 9: #51 Cổng thiên đàng (167 ô), #102 Lôi đài (21), #91 Khu đồi cỏ (27).
- Tileset 10: #62 Địa ngục tầng 1 (61), #52 Cổng địa ngục (102), #88 Khu hang động (2).
- Tileset 11: #63 Rừng medusa (14), #64 Rừng Chimera (4), #66 Thác reo (16).

Tên lớp `ThacNuoc` không có nghĩa mọi sheet đều mô tả nước; cần giữ mapping gốc kể cả trong map địa ngục.

## Background và hiệu ứng cuối packet

Luồng gameplay gọi `MapBackGround.paint` trước terrain, `updateCloud` trong update. `setBackGround(byte type, short height)` có profile 1..3, ảnh `bg1_*`, `bg2_*`, `bg3_*` và `may0/1`; lớp vẽ phụ thuộc camera, mây có vị trí/vận tốc riêng. Low-graphics có nhánh giản lược. `ReadMessenge` đọc type và height từ message rồi gọi setBackGround; type âm xóa background. Không suy luận profile chỉ từ tileset. Chưa đối chiếu hoàn chỉnh hai trường này với từng payload map đã đóng gói.

`Map.BackGround` còn có API vẽ trời, biển, thuyền và nền nổi, nhưng chỉ thấy tên lớp/hàm không đủ chứng minh chúng chạy trên map gameplay. Chưa gán những asset đó vào map.

Cuối `LoadMap.load_ItemMap`, nếu còn bytes và không low-graphics, client đọc số effect (short), sau đó từng cặp chuỗi có độ dài byte. Trên nhánh `!isj2me`, gọi `GameScreen.addEffectAuto`. Chưa giải mã ý nghĩa từng chuỗi hoặc khẳng định những effect này hoạt động trên bản Java MIDP.

## Phạm vi khôi phục tiếp theo

Nước và thác có quy tắc crop/tick/mapping đủ cụ thể để triển khai, dùng ảnh gốc và fallback có nhãn. Cần kiểm chứng các nhịp 0..13, cột chẵn/lẻ, tất cả crop, đồng hồ pause/resume và bản xuất Phaser. Background và hiệu ứng payload cần đối chiếu thêm cấu hình theo map trước khi dựng. Runtime giữ nền tĩnh tick dư 7 khi tắt; khi bật chạy nước/thác trên cùng đồng hồ 40ms. Pha thác khởi đầu frame 0 trong Studio, không khẳng định trùng pha lúc vào map trên Java. Bản xuất có setAnimations và dọn update listener khi destroy/shutdown. Unit kiểm tra đủ crop/pha trên 91 map và 414 ô thác; Chrome kiểm tra bật/tắt, dừng và ZIP Phaser thực tế.
