# Đối chiếu mắt gốc client HSO 4.0.3

Kết luận: client có mắt tách riêng, không phải mắt đã ghép trong ảnh đầu. Dump server thiếu PNG type4 dùng được nhưng JAR đóng gói đủ **16 PNG x1 và 16 metadata60byte**. Thông báo cũ “mắt preview là placeholder” phản ánh cách dựng trước đây của Studio, không phản ánh đầy đủ tài nguyên client.

## Bằng chứng

Client khóa SHA256 `f023b34e0ba0a3dcf44249ed5f90b78f0427deee4668562b8e3a0e9e349b18c6`.

- `FilePack.charAvatar[4] = eye`.
- `CharPartInfo.loadNew` ưu tiên `/c/eye/b{id}_eye.png` và `/c/eye/b{id}_eye_data`; resolver ảnh dùng resource `/x1/` của JAR.
- Có `x1/c/eye/b0_eye.png` đến `b15_eye.png`, không có bộ x2/x3/x4 tương ứng trong JAR này.
- Metadata gồm ba crop down/up/side ×4 byte unsigned và 24 cặp anchor signed, nhóm bốn hướng ×6 body frame. `CharPartInfo.PART_OF_FRAME[4]` toàn0: mỗi hướng giữ cùng crop mắt, vị trí thay theo body frame.
- Nhìn phải, `CharPartInfo.paint` dùng ảnh side và x=-dxSide-width, dySide; không đoán vị trí từ ảnh đầu.
- `MainObject.paint` bỏ part type4 ở hướng up. Mắt được vẽ sau tóc và trước mũ trong chuỗi layer thông thường.
- `MainObject.setInfo` đổi eye ID server nhỏ hơn8 thành ID+8. Vì vậy nhân vật mẫu dùng mắt gốc #8, không dùng #0 (ảnh trạng thái).
- `MainObject.updateEye/setEye` đổi ID mắt khi chớp mắt, bị đánh hoặc tấn công. Studio hiện cho chọn từng resource gốc; **chưa tái lập tự động toàn bộ state machine và RNG chớp mắt**.

`reference/hso403/eyes.json` lưu nguồn, hash JAR, hash class, hash PNG, metadata nguyên byte, crop và offsets đã giải mã. `tests/clientEyes.test.js` so PNG/metadata byte-for-byte với JAR gốc; kiểm tra bốn hướng và sáu body frame cho cả16 resource.

## Studio và ZIP

Mắt mặc định **Mắt gốc #8** dùng nguyên PNG x1 trong `public/game/client403/eyes`. Không phóng ảnh lên rồi gọi là x4. Tất cả tọa độ vẫn dùng logical x1; mắt vẫn giữ kích thước đúng cạnh các ảnh cơ thể x4.

`characterParts()` bỏ mắt placeholder khỏi danh mục đang dùng và thêm16 mắt từ reference đã đóng gói. Catalog SQLite gốc không bị viết lại. Asset placeholder cũ còn trên đĩa để tương thích dữ liệu cũ, nhưng không còn là mắt mặc định hay part trong thư viện mới.

Thư viện mới có **430 part = 414 part trước đây +16 mắt client**. `parts/eyes/<id>/` chứa PNG gốc, atlas và part.json với provenance `official-client-4.0.3`, ba crop/24 anchor, density1. Chọn Không dùng để bỏ mắt. Builder/runtime v1 vẫn hỗ trợ schema mắt cũ một crop/một anchor và provenance editor-placeholder.

Thông báo x1 hiện chỉ giải thích giới hạn độ phân giải của ảnh gốc. Không còn nói mắt đang được Studio tự vẽ.

## Dữ liệu đóng gói

16 PNG và reference đã được nhập và lưu trong repo. Studio không còn công cụ nhập JAR; chạy/build dùng trực tiếp các file đã đóng gói, không cần Java, server HSO, Python hay thư mục scripts.
