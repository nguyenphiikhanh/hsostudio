# Thiết kế part từ PNG mẫu

Mở **Character Lab → Trang bị → Thiết kế part · PNG / JSON / MySQL**. Hỗ trợ quần, áo, vũ khí thường theo phái, thú cưỡi và pet, gồm rig nhiều mảnh đã có trong Studio. PNG nhập chỉ preview nháp, không sửa dữ liệu gốc.

## Tải mẫu và đưa thiết kế mới vào preview

1. Chọn **Loại part** và **Mẫu frame/rig**. Loại này độc lập bộ trang bị đang mặc; chọn Áo khi nhập áo, không để mặc định Quần. Tải PNG/JSON mẫu từ phần Tải tài nguyên mẫu gốc.
2. Vẽ lại trên PNG, giữ nguyên vị trí mọi sprite/crop/điểm nối. Có thể đổi density x1–x4, nhưng kích thước logical không đổi. Áo#0 là292×172 x4 (73×43 logical); áo#1 là312×168 x4 (78×42 logical). Quần#0 là252×208 x4 (63×52 logical), không dùng làm kích thước áo.
3. Chọn **PNG thiết kế chính**, đặt ID thiết kế, tên, ID vật phẩm H5. Chọn nguồn chỉ số HSO nếu có; đây chỉ là nguồn tham khảo, không phải bảng SQL đích.
4. Bấm **Preview / cập nhật nháp**. Cùng ID cập nhật nháp; ID khác tạo bản riêng. Kiểm tra đủ bốn hướng và các trạng thái. Bỏ preview trả lớp trước, Xóa nháp xóa bản trong tab.
5. Tải ZIP PNG/JSON để giữ thiết kế; xem/sao chép SQL H5 khi cần đăng ký vào database server mới.

PNG được kiểm tra signature, giải mã thực tế, kích thước và density; không tự kéo giãn ảnh sai bố cục. Vũ khí có PNG đứng/đi và PNG WPS tấn công riêng. Nếu chưa tải WPS, vũ khí nháp bị ẩn khi đánh để không dùng nhầm ảnh mẫu. Geometry, nhịp và giới hạn rig được kế thừa; không đoán anchor/seat mới theo hình.

Nháp giữ qua đổi menu/tab nhưng reload sẽ mất. Tối đa20 thiết kế/tab, PNG tối đa20MB,8192px mỗi cạnh và32triệu pixel. Không ghi vào SQLite/PNG nguồn/MySQL/file Java từ trình duyệt.

## Lưu và mở lại

Tải từng PNG hoặc JSON vẫn được giữ. **SQL không tải thành file** và không còn nằm trong ZIP.

```text
shirt-9000-design.zip
  assets/parts/shirt/9000/x4/<sha256>/sheet.png
  design.json
  h5-content.json
  README.md
```

Vũ khí có thêm splash.png ở đường dẫn riêng khi đã tải WPS. `design.json` giữ nháp/provenance/resources/hash để mở lại; `h5-content.json` là payload dùng trong SQL cho game H5. Không có blob URL hoặc PNG nhúng vào JSON.

Mở lại: chọn đúng loại/phái, nhập JSON nháp rồi chọn các PNG có SHA-256 khớp. JSON đổi frame/rig hoặc khác bản mẫu bị từ chối; workflow này không phải trình rig tự do. JSON nháp từ trước vẫn đọc được; sau khi preview lại, SQL đích là schema H5 mới.

**Xuất cho Phaser** xuất tư thế đang xem gồm PNG nháp đã áp dụng. **Xuất thư viện part** vẫn dùng danh mục gốc và ghi lớp nháp vào character.omittedLayers; ZIP thiết kế là nơi lưu các thiết kế mới.

## Sao chép SQL chạy MySQL

1. Mở **Khởi tạo MySQL H5 · chạy một lần** và sao chép/chạy toàn bộ script trong database H5 đã chọn. MySQL8.0.21+, khuyến nghị8.4; công cụ chạy script cần hỗ trợ DELIMITER.
2. Chép thư mục assets/ trong ZIP vào asset root server, giữ nguyên đường dẫn.
3. Trong từng thiết kế, mở **SQL MySQL H5 · xem / sao chép** và bấm **Sao chép SQL**. Chạy câu CALL hiển thị trong MySQL.

Nếu clipboard bị trình duyệt từ chối, ô SQL được chọn sẵn để Ctrl+C/Cmd+C. Không có tự động kết nối/chạy SQL từ Studio.

SQL chỉ ghi h5_* tables: đăng ký part, asset path/hash, rig, animation và vật phẩm; không INSERT item3/item4 hay yêu cầu sửa switch Java của server HSO cũ. ID mới 0–2147483647, tên dùng utf8mb4. Trùng ID sẽ rollback, không ghi đè. Gợi ý ID chưa kiểm tra database H5 của bạn. **SQL mẫu H5** chỉ đăng ký part mẫu, không tự tạo item.

Backend H5 chưa được triển khai bởi tính năng này. Nó cần đọc contract, phục vụ PNG, làm mới content_revision và hỗ trợ renderer tương ứng. Đăng ký nội dung không tự cấp đồ, thêm shop/rơi đồ hoặc sinh hành vi chiến đấu mới. Chi tiết schema, transaction và kiểm chứng MySQL tại [h5-content-schema.md](h5-content-schema.md).
