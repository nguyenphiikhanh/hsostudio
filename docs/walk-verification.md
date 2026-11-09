# Đi bộ: đối chiếu client 4.0.3

## Lỗi trước khi sửa

Renderer cũ dùng crop index như anchor index khi không có vũ khí: bước crop1 lấy anchor1 thay vì body frame2, crop2 lấy anchor2 thay vì body frame3. Cùng nhân vật đó khi thêm vũ khí mới đi qua phép đổi 0→0, 1→2, 2→3. Hướng phải còn phụ thuộc nhánh này để lấy anchor side và tính -dx-width. Vì thế việc gắn/bỏ vũ khí thay đổi vị trí các bộ phận dù đang cùng pose.

Chu kỳ preview cũ 0→1→0→2 ở 8 FPS được suy ra trước khi có client; chưa dùng A_Move gốc.

## Nguồn xác minh

Phân tích tĩnh JAR 4.0.3 đã đóng gói, SHA-256 `f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6`, qua javap; không dùng client khác phiên bản hoặc chạy đăng nhập. Bảng số và hash bytecode ở `reference/hso403/walk.json`.

- Constructor MainObject: A_Move = `[2,2,2,0,0,3,3,3,0,0]`.
- Static ArrMount1 có cùng 10 giá trị; resetMount trả A_Move về bảng này khi không cưỡi.
- updateActionPerson, Action1: tăng f, wrap theo A_Move.length và đọc frame=A_Move[f] khi không có idHorse và không phi hành. Nhánh này không kiểm tra vũ khí.
- Player.update gọi updateActionPerson mỗi update.
- TemCanvas.run đặt mục tiêu 40ms/update, tức 25 FPS.
- CharPartInfo.PART_OF_FRAME type quần/áo: `[0,0,1,2,3,4]`. Vì vậy body2 dùng crop1, body3 dùng crop2, nhưng dx/dy vẫn lấy body2/body3 cho mọi bộ phận.
- CharPartInfo.paint nhìn phải (Direction3): lấy crop/anchor side (Direction2), x=-dxSide-width, y=dySide; lật ngang region. Không dùng offset hàng Direction3 như renderer suy ra cũ.

## Hành vi sau sửa

| Tick | Body frame | Crop quần/áo |
|---|---|---|
| 0–2 | 2 | 1 |
| 3–4 | 0 | 0 |
| 5–7 | 3 | 2 |
| 8–9 | 0 | 0 |

Mỗi tick40ms, một chu kỳ400ms. Head/hair/eyes giữ crop theo hướng và đổi anchor theo cùng body frame. Preview bắt đầu ở A_Move[0] cho việc so sánh và step có thể lặp lại; client thật giữ biến f giữa một số trạng thái nên thời điểm bắt đầu chu kỳ có thể khác.

Preview đứng/đi dùng cùng cách đổi crop→body frame và mirror, độc lập trang bị. Nhịp thở đứng yên vẫn do Studio dựng; không đưa A_Stand vào thay đổi lần này. Tốc độ thở đã chọn được nhớ khi quay về idle. Đi bộ khóa 25FPS; pet/danh hiệu dùng cùng đồng hồ client và không kéo chậm bước chân. Rig thú cưỡi, phi hành, biến hình và di chuyển trong nước không thuộc chu kỳ này.

## Xuất và kiểm tra

- animations.json.states.walk có clientWalk=true, provenance/hash, fps25 và clientBodyFrame của từng tick; runtime Phaser dùng cùng resolver. ZIP cũ với clip legacy vẫn đọc được.
- Xuất tư thế giữ body-frame anchor đang preview. H5 arena cũng cắt ba crop bước chân bằng anchor body0/2/3 và phát chu kỳ10tick.
- Kiểm thử độc lập theo bảng bytecode cho430 part hiện có và biến thể provenance custom-design, cả bốn hướng và cả bốn phái vũ khí. Geometry giữ nguyên khi gắn/bỏ vũ khí; offset chỉnh nháp được giữ.
- Kiểm thử UI bước từng tick, đứng→đi, có/không vũ khí, thêm pet và tải ZIP tư thế. Bộ thư viện xuất được chạy bằng Phaser thực tế để so crop/anchor160 mẫu (4 bộ phận × 4 hướng × 10tick).

Chạy/build không cần Java hoặc JAR; các công cụ này chỉ được dùng để đối chiếu nguồn trong lần sửa.
