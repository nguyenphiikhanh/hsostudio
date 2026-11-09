# Thiết kế part từ PNG mẫu

Trong **Character Lab → Trang bị → Thiết kế part · PNG / JSON / MySQL**. Hỗ trợ quần, áo, vũ khí thường theo phái, thú cưỡi và thú cưng, gồm rig nhiều mảnh đã có trong Studio.

## Tải tài nguyên gốc

1. Chọn loại part và mẫu frame/rig. Vũ khí theo Phái nhân vật hiện tại.
2. Mở **Tải tài nguyên mẫu gốc**: tải từng PNG, JSON, SQL hoặc ZIP mẫu.
3. PNG là nguyên byte nguồn đóng gói, không phải ảnh chụp preview hoặc hình ghép. Vũ khí có PNG chính và PNG WPS tấn công riêng. JSON giữ crop, anchor/rig, đơn vị x1, density, nguồn và checksum.
4. SQL mẫu là INSERT sao lưu template item3/item4 đang chọn, không phải bảng chứa ảnh. Nếu chọn part không có item tương ứng, SQL chỉ có chú thích, không bịa template. Chọn một vật phẩm thực sự dùng part đó để có SQL nguồn.

## Đưa thiết kế mới vào preview

1. Vẽ lại trên PNG mẫu, giữ nguyên vị trí các frame và bố cục sheet. Có thể dùng density x1–x4 với kích thước logical giữ nguyên. Ví dụ mẫu 292×172 x4 tương ứng 73×43 logical, chấp nhận 73×43 x1 hoặc 292×172 x4; không chấp nhận thêm viền hoặc chuyển frame sang vị trí khác.
2. Chọn **PNG thiết kế chính**. Studio kiểm tra header PNG, giải mã thực tế, kích thước và density trước khi nhận ảnh. PNG lỗi không làm mất preview cũ.
3. Đặt **ID thiết kế / part mới**, tên và **ID vật phẩm MySQL**. Chọn vật phẩm mẫu để kế thừa chỉ số/loại/phái/icon. Không tự sinh chỉ số gameplay.
4. Bấm **Preview / cập nhật nháp**. Bốn hướng và animation dùng ảnh mới với geometry của mẫu; không gọi rig được kế thừa là metadata gốc của thiết kế mới. Crop/anchor không tự đoán theo hình mới.
5. Cùng ID có thể cập nhật PNG/tên trên nháp. ID mới tạo bản riêng. Có thể Preview lại, Bỏ preview để trả lớp trước đó, hoặc Xóa nháp. Đổi tab/menu giữ các bản trong bộ nhớ.

Với vũ khí, PNG đứng/đi không chứa ảnh WPS của đòn đánh. Cần thêm **PNG WPS tấn công** giữ layout WPS mẫu để xem ảnh vũ khí mới khi đánh. Thiếu WPS thì vũ khí nháp bị ẩn ở trạng thái đánh; không mượn PNG WPS mẫu để giả là thiết kế mới. Timeline thân/skill và hiệu ứng vẫn kế thừa mẫu hiện có, không sinh ra kỹ năng mới. Các hạn chế của rig thú và điểm ngồi chưa xác minh được giữ nguyên.

## Lưu và mở lại

Mỗi thiết kế có nút tải từng PNG, JSON, SQL, hoặc ZIP:

```text
pants-122-design.zip
  sheet.png
  splash.png       # chỉ khi vũ khí có WPS đã tải lên
  design.json
  item.mysql.sql
  README.md
```

`design.json` có `schema: hso-part-design`, `version: 1`, nguồn/template, định nghĩa đầy đủ, thông tin PNG/hash và template MySQL. Không lưu blob URL của trình duyệt. Để mở lại: chọn đúng loại/phái, nhập JSON nháp, chọn lại các PNG đúng SHA-256, rồi Preview. JSON sửa frame/rig hoặc khác phiên bản mẫu bị từ chối; đây là workflow kế thừa layout, không phải trình rig tùy ý.

Nháp không ghi vào SQLite, PNG gốc, MySQL hoặc file Java. Reload mất nháp chưa tải. Tối đa 20 thiết kế trong tab, mỗi PNG tối đa 20 MB, 8192px mỗi cạnh và 32 triệu pixel. Các URL/ảnh tạm được giải phóng khi không dùng hoặc đóng workspace.

**Xuất cho Phaser** vẫn xuất tư thế đang xem, gồm PNG thiết kế đã áp dụng. **Xuất thư viện part** vẫn dùng danh mục gốc: lớp nháp không tự trở thành part runtime; được ghi trong `character.omittedLayers`. Dùng ZIP thiết kế để giữ PNG/JSON/MySQL; chưa tự đăng ký vào thư viện gốc hoặc bộ chọn HSO.

## MySQL HSO: điều gì được xuất và còn thiếu

Đã đối chiếu schema `hso/hsoodtest.sql` và code trong `hso/src/main/java`. Bằng chứng/hash nguồn được đóng gói trong `partDesignServer.json`, vì vậy chạy/build Studio không cần thư mục hso, JAR hoặc Python.

- Quần/áo/vũ khí: INSERT đúng 9 cột của `item3`; giữ chỉ số, loại/phái/icon/cấp/màu của vật phẩm mẫu, thay ID/tên và part mới.
- Thú cưỡi: INSERT đúng 10 cột của `item4` theo vật phẩm mẫu.
- Pet: INSERT template trứng trong `item3`. Bảng `pet` trong dump không phải registry ngoại hình được `Pet.get_pet()` sử dụng; không thêm một hàng vào bảng này rồi khẳng định có pet mới.
- Tên xuất vào template phải tương thích charset utf8 3-byte của schema gốc; emoji 4-byte bị từ chối. SQL dùng INSERT, không UPDATE/REPLACE/DELETE. ID trùng phải báo lỗi ở database đích. Chuỗi dùng UTF-8 hex để giữ tiếng Việt, dấu nháy và dấu gạch chéo mà không phụ thuộc chế độ escape MySQL.
- ID gợi ý và kiểm tra trùng dựa trên catalog đóng gói và nháp, không biết database đang chạy. ID vật phẩm giới hạn 0–32767 theo `getShort`; part quần/áo/vũ khí 0–127 theo `getByte` và tinyint signed. ID ảnh nguồn chưa có item (như sheet vũ khí 24) vẫn được giữ chỗ, không gợi ý ghi đè. Đây chưa phải xác nhận client có đủ bảng cho mọi ID mới.

**Chạy SQL không đủ đưa thiết kế vào HSO.** Server lưu PNG/metadata bên ngoài MySQL; packet -52 và bảng lookup client cần tài nguyên/metadata native. JSON của Studio chưa phải packet binary. `UseItem.use_item_mount()` và `Pet.get_pet()` có mapping theo ID trong Java, cần bổ sung riêng cho vật phẩm mới; Studio không sửa các file này. Nháp thú để `itemIds: []` và `serverAppearanceStatus: not-registered`, không giữ alias vật phẩm gốc như thể đã đăng ký ngoại hình mới. ID thiết kế thú trong JSON không tự đồng nghĩa typeMount/id_horse/icon pet mới. Giữ/đối chiếu giới hạn bảng client, seat và thứ tự danh sách server.

`Manager.load_database()` dùng danh sách truy cập theo ID; khi tích hợp cần ID vật phẩm liên tục và thứ tự nạp khớp ID. Công cụ chỉ xuất dữ liệu, không thay loader. SQL đã được kiểm tra schema/cột, kiểu dữ liệu và literal; chưa thực thi trên MySQL hoặc chạy thử server/client HSO.
